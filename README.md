# @status-machina/knexjs-pg-pattern

> ⚠️ **WARNING: Experimental Library**  
> This library is in early development and is **not stable**. The API, functionality, and implementation details are subject to significant changes. Not recommended for production use at this time.

# @status-machina/knexjs-pg-pattern

_A library providing event sourcing patterns for PostgreSQL using Knex.js._

## Getting Started

### Install

```bash
npm install @status-machina/knexjs-pg-pattern
# Install peer dependencies
npm install knex@3.1.0 pg zod@3.24.2
```

## Overview

This library views events like a story being told:

- Events are read in chronological order, like pages in a book
- Projections evolve as new events arrive, like our understanding of characters and plot
- Early events may gain significance later, just as early plot points become important
- Validators ensure event consistency, like an editor checking plot continuity

Don't let event sourcing intimidate you. If you've ever:

- Written in a journal
- Told a story to a friend
- Watched a TV series
- Read a book
- Played a video game

You already understand event sourcing! The only difference is we're letting computers do what humans do naturally: process a sequence of events to build understanding.

Consider a simple todo list:

- You create the list (event: LIST_CREATED)
- You add an item (event: ITEM_ADDED)
- You mark it complete (event: ITEM_COMPLETED)
- You remove it (event: ITEM_REMOVED)

Each action is an event, just like each scene in a story moves the plot forward. And just like a story can be understood differently by different readers, we can build different projections from the same events:

- A "completion rate" projection might focus on completed vs. total items
- An "activity log" projection might list all actions in order
- A "current state" projection might only care about non-removed items

## Key Components

### Event Client

The central interface for all database operations. It's the only way you should interact with events and projections, particularly for writing to the database.

### Validators

Validators ensure your commands result in valid events before they're written:

- Handle business rules and invariants
- Typically validate one command that produces one event
- Fit naturally in an API -> command -> command handler -> validator -> event flow

### Projections

Projections combine events to tell specific aspects of your story:

- Build any view of the data you need
- Can be optimized with database snapshots for long event streams
- Perfect for CQRS architectures

## Implementation Guide

### Create Required Tables

The library requires two tables: `events` and `projections`. First, generate the migration files:

```bash
# Generate the initial migration
npx knex migrate:make create_event_sourcing_tables
```

Then use the provided migrations in your newly created file (timestamp_create_event_sourcing_tables.ts):

```typescript
import {
  createEventsTableMigration,
  createProjectionsTableMigration,
} from '@status-machina/knexjs-pg-pattern';
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(createEventsTableMigration.up);
  await knex.raw(createProjectionsTableMigration.up);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(createProjectionsTableMigration.down);
  await knex.raw(createEventsTableMigration.down);
}
```

Run the migration:

```bash
npx knex migrate:latest
```

### Adding Data Indexes

To improve query performance, you can create indexes on specific JSON fields. First, generate a new migration:

```bash
npx knex migrate:make add_event_sourcing_indexes
```

Then use the provided index creators in your migration file (timestamp_add_event_sourcing_indexes.ts):

```typescript
import {
  createEventDataIndexMigration,
  createProjectionDataIndexMigration,
} from '@status-machina/knexjs-pg-pattern';
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create an index on events.data->>'userId'
  const eventIndex = createEventDataIndexMigration({ key: 'userId' });
  await knex.raw(eventIndex.up);

  // Create an index on projections.data->>'status'
  const projectionIndex = createProjectionDataIndexMigration({
    key: 'status',
    indexName: 'custom_status_idx', // optional
  });
  await knex.raw(projectionIndex.up);
}

export async function down(knex: Knex): Promise<void> {
  const eventIndex = createEventDataIndexMigration({ key: 'userId' });
  const projectionIndex = createProjectionDataIndexMigration({
    key: 'status',
    indexName: 'custom_status_idx',
  });

  await knex.raw(projectionIndex.down);
  await knex.raw(eventIndex.down);
}
```

Run the migration:

```bash
npx knex migrate:latest
```

### Setting Up Events

The `test/example/events/` directory in this repository demonstrates best practices. Events should:

- Have clear, descriptive names
- Use Zod schemas for validation
- Export both event and input types

#### Example:

```typescript
import { z } from 'zod';
import {
  createEventSchema,
  createEventInputSchema,
} from '@status-machina/knexjs-pg-pattern';

const eventData = z.object({
  listId: z.string(),
  itemId: z.string(),
  title: z.string(),
});

export const ITEM_ADDED = 'ITEM_ADDED' as const;

export const itemAddedSchema = createEventSchema(ITEM_ADDED, eventData);
export const itemAddedInputSchema = createEventInputSchema(
  ITEM_ADDED,
  eventData,
);

export type ItemAddedEvent = z.infer<typeof itemAddedSchema>;
export type ItemAddedEventInput = z.infer<typeof itemAddedInputSchema>;
```

### Writing Validators

Validators ensure business rules are met before events are written:

```typescript
import { SingleStreamValidator } from '@status-machina/knexjs-pg-pattern';

// Define reducers outside the class for reusability and testing
const toIncompleteItemIdsInList = (
  ids: string[],
  event: UserEvent,
): string[] => {
  switch (event.type) {
    case eventTypes.ITEM_ADDED:
      return [...ids, event.data.itemId];
    case eventTypes.ITEM_REMOVED:
      return ids.filter((id) => id !== event.data.itemId);
    case eventTypes.ITEM_COMPLETED:
      return ids.filter((id) => id !== event.data.itemId);
    case eventTypes.ITEM_MARKED_INCOMPLETE:
      return [
        ...ids.filter((id) => id !== event.data.itemId),
        event.data.itemId,
      ];
    default:
      return ids;
  }
};

export class AddItemValidator extends SingleStreamValidator<
  typeof eventUnion,
  typeof eventInputUnion
> {
  constructor(
    eventClient: EventClient<typeof eventUnion, typeof eventInputUnion>,
    listId: string,
  ) {
    super(
      eventClient,
      [
        eventTypes.ITEM_ADDED,
        eventTypes.ITEM_REMOVED,
        eventTypes.ITEM_COMPLETED,
        eventTypes.ITEM_MARKED_INCOMPLETE,
      ],
      {
        listId: { eq: listId },
      },
    );
  }

  private async ensureIncompleteItemCountIsLessThanThree() {
    const ids = await this.reduceEvents(toIncompleteItemIdsInList, []);
    if (ids.length > 3) {
      throw new Error('Incomplete item count is greater than three');
    }
  }

  async isValid(): Promise<boolean> {
    await this.ensureIncompleteItemCountIsLessThanThree();
    return true;
  }
}
```

### Using Validators

Validators are typically used in command handlers to validate and save events:

```typescript
async function addItemCommandHandler(
  eventClient: EventClient<typeof eventUnion, typeof eventInputUnion>,
  command: AddItemCommand,
): Promise<void> {
  const event = {
    type: eventTypes.ITEM_ADDED,
    data: {
      listId: command.listId,
      itemId: command.itemId,
      title: command.title,
    },
  };

  // Validator will check business rules and save the event if valid
  await new AddItemValidator(eventClient, command.listId).apply(event).save();
}
```

### Writing Projections

Projections build views from events. The base class provides helper methods for working with events:

```typescript
import { SingleStreamProjection } from '@status-machina/knexjs-pg-pattern';

const listSchema = z.object({
  listId: z.string(),
  name: z.string(),
  completedItems: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      createdAt: z.string(),
    }),
  ),
  incompleteItems: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      createdAt: z.string(),
    }),
  ),
  removedItems: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      createdAt: z.string(),
    }),
  ),
});

type ListJson = z.infer<typeof listSchema>;

const toInitialState = (listId: string): ListJson => ({
  listId,
  name: '',
  completedItems: [],
  incompleteItems: [],
  removedItems: [],
});

const toName = (state: ListJson, event: UserEvent): string => {
  switch (event.type) {
    case eventTypes.LIST_CREATED:
      return event.data.name;
    default:
      return state.name;
  }
};

const toCompletedItems = (
  state: ListJson,
  event: UserEvent,
): ListJson['completedItems'] => {
  switch (event.type) {
    case eventTypes.ITEM_COMPLETED: {
      const item = state.incompleteItems.find(
        (i) => i.id === event.data.itemId,
      );
      if (!item) return state.completedItems;
      return [...state.completedItems, item];
    }
    case eventTypes.ITEM_REMOVED:
      return state.completedItems.filter((i) => i.id !== event.data.itemId);
    case eventTypes.ITEM_MARKED_INCOMPLETE:
      return state.completedItems.filter((i) => i.id !== event.data.itemId);
    default:
      return state.completedItems;
  }
};

const toIncompleteItems = (
  state: ListJson,
  event: UserEvent,
): ListJson['incompleteItems'] => {
  switch (event.type) {
    case eventTypes.ITEM_ADDED:
      return [
        ...state.incompleteItems,
        {
          id: event.data.itemId,
          text: event.data.title,
          createdAt: new Date().toISOString(),
        },
      ];
    case eventTypes.ITEM_COMPLETED:
      return state.incompleteItems.filter((i) => i.id !== event.data.itemId);
    case eventTypes.ITEM_REMOVED:
      return state.incompleteItems.filter((i) => i.id !== event.data.itemId);
    case eventTypes.ITEM_MARKED_INCOMPLETE: {
      const item = state.completedItems.find((i) => i.id === event.data.itemId);
      if (!item) return state.incompleteItems;
      const isAlreadyIncomplete = state.incompleteItems.some(
        (i) => i.id === item.id,
      );
      if (isAlreadyIncomplete) return state.incompleteItems;
      return [...state.incompleteItems, item];
    }
    default:
      return state.incompleteItems;
  }
};

const toRemovedItems = (
  state: ListJson,
  event: UserEvent,
): ListJson['removedItems'] => {
  switch (event.type) {
    case eventTypes.ITEM_REMOVED: {
      const item = [...state.completedItems, ...state.incompleteItems].find(
        (i) => i.id === event.data.itemId,
      );
      if (!item) return state.removedItems;
      const isAlreadyRemoved = state.removedItems.some((i) => i.id === item.id);
      if (isAlreadyRemoved) return state.removedItems;
      return [...state.removedItems, item];
    }
    default:
      return state.removedItems;
  }
};

const toNextState = (state: ListJson, event: UserEvent): ListJson => ({
  ...state,
  name: toName(state, event),
  completedItems: toCompletedItems(state, event),
  incompleteItems: toIncompleteItems(state, event),
  removedItems: toRemovedItems(state, event),
});

export class ListProjection extends SingleStreamProjection<
  z.ZodType<UserEvent>,
  z.ZodType<UserEventInput>,
  z.ZodType<ListJson>
> {
  readonly _id: string;
  readonly jsonSchema = listSchema;

  constructor(
    eventClient: EventClient<z.ZodType<UserEvent>, z.ZodType<UserEventInput>>,
    listId: string,
    options: { loadExisting?: boolean } = {},
  ) {
    super(eventClient, options);
    this._id = listId;
  }

  get id(): string {
    return this._id;
  }

  get type(): string {
    return 'list';
  }

  get types(): Array<UserEvent['type']> {
    return [
      eventTypes.LIST_CREATED,
      eventTypes.ITEM_ADDED,
      eventTypes.ITEM_COMPLETED,
      eventTypes.ITEM_MARKED_INCOMPLETE,
      eventTypes.ITEM_REMOVED,
    ];
  }

  get filter() {
    return {
      listId: { eq: this.id },
    };
  }

  async asJson(): Promise<ListJson> {
    const existingState = await this.getExistingState();
    const events = await this.getEvents();
    return events.reduce(toNextState, existingState ?? toInitialState(this.id));
  }
}
```

#### Available helper methods:

- `getExistingState()`: Returns the last saved state if `loadExisting` is true
- `reduceEvents(reducer, initialValue)`: Reduce all events to a single value
- `reduceOnlyDbEvents(reducer, initialValue)`: Reduce only stored events (excludes applied events)
- `apply(event)`: Add new events to be processed
- `refresh()`: Clear cached data and reload from database
- `save()`: Save current state to database (throws if there are applied events)

### Using Projections

Projections are typically used in query handlers to read the current state:

```typescript
async function getListQueryHandler(
  eventClient: EventClient<typeof eventUnion, typeof eventInputUnion>,
  listId: string,
): Promise<ListJson> {
  // Get the current state of the list
  return await new ListProjection(eventClient, listId, {
    loadExisting: true,
  }).asJson();
}

async function updateListProjectionHandler(
  eventClient: EventClient<typeof eventUnion, typeof eventInputUnion>,
  listId: string,
): Promise<void> {
  // Update the saved projection state
  await new ListProjection(eventClient, listId).save();
}
```

### CQRS Implementation

This library naturally supports CQRS:

1. Commands go through validators
2. Valid commands produce events
3. Events update projections
4. Queries read from projections

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
