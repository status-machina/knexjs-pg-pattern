import { z } from 'zod';
import { eventTypes, UserEvent } from '../events';
import {
  SingleStreamProjection,
  EventClient,
} from '@status-machina/knexjs-pg-pattern';

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
