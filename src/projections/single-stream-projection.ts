import { z } from 'zod';
import { EventClient } from '../event-client';
import { DataFilter } from '../query-types';
import type { EventInput } from '../event-schema';

export abstract class SingleStreamProjection<
  TEventUnion extends z.ZodType,
  TEventInputUnion extends z.ZodType,
  TJson extends z.ZodType,
> {
  protected eventClient: EventClient<TEventUnion, TEventInputUnion>;
  private cachedEventsPromise?: Promise<Array<z.infer<TEventUnion>>>;
  private appliedEvents: Array<z.infer<TEventUnion>> = [];
  private existingProjectionPromise?: Promise<{
    data: z.infer<TJson>;
    lastEventId: bigint;
  } | null>;
  private readonly loadExisting: boolean;

  abstract get id(): string;
  abstract get type(): string;
  abstract get jsonSchema(): TJson;
  abstract get types(): Array<z.infer<TEventUnion>['type']>;
  abstract get filter(): DataFilter | undefined;

  constructor(
    eventClient: EventClient<TEventUnion, TEventInputUnion>,
    options: { loadExisting?: boolean } = {},
  ) {
    this.eventClient = eventClient;
    this.loadExisting = options.loadExisting ?? false;
  }

  private loadExistingProjection(): Promise<{
    data: z.infer<TJson>;
    lastEventId: bigint;
  } | null> {
    if (!this.existingProjectionPromise) {
      this.existingProjectionPromise = this.loadExisting
        ? this.eventClient
            .getProjection({
              type: this.type,
              id: this.id,
            })
            .then((projection) =>
              projection
                ? {
                    data: this.jsonSchema.parse(projection.data),
                    lastEventId: projection.lastEventId,
                  }
                : null,
            )
        : Promise.resolve(null);
    }
    return this.existingProjectionPromise;
  }

  protected async getExistingState(): Promise<z.infer<TJson> | null> {
    const projection = await this.loadExistingProjection();
    return projection?.data ?? null;
  }

  protected async getEvents(): Promise<Array<z.infer<TEventUnion>>> {
    if (!this.cachedEventsPromise) {
      const query = {
        types: this.types,
        filter: this.filter,
      };

      const projection = await this.loadExistingProjection();
      if (projection?.lastEventId) {
        this.cachedEventsPromise = this.eventClient.getEventStream({
          ...query,
          afterId: projection.lastEventId,
        });
      } else {
        this.cachedEventsPromise = this.eventClient.getEventStream(query);
      }
    }

    const cachedEvents = await this.cachedEventsPromise;
    return [...(cachedEvents ?? []), ...this.appliedEvents];
  }

  protected async reduceOnlyDbEvents<T>(
    reducer: (acc: T, event: z.infer<TEventUnion>) => T,
    defaultValue: T,
  ): Promise<T> {
    if (!this.cachedEventsPromise) {
      const query = {
        types: this.types,
        filter: this.filter,
      };

      const projection = await this.loadExistingProjection();
      if (projection?.lastEventId) {
        this.cachedEventsPromise = this.eventClient.getEventStream({
          ...query,
          afterId: projection.lastEventId,
        });
      } else {
        this.cachedEventsPromise = this.eventClient.getEventStream(query);
      }
    }
    const cachedEvents = await this.cachedEventsPromise;
    return (cachedEvents ?? []).reduce(reducer, defaultValue);
  }

  protected async reduceEvents<T>(
    reducer: (acc: T, event: z.infer<TEventUnion>) => T,
    defaultValue: T,
  ): Promise<T> {
    const events = await this.getEvents();
    return events.reduce(reducer, defaultValue);
  }

  public apply(
    event:
      | EventInput<z.infer<TEventUnion>>
      | Array<EventInput<z.infer<TEventUnion>>>,
  ): this {
    if (Array.isArray(event)) {
      this.appliedEvents.push(...event);
    } else {
      this.appliedEvents.push(event as z.infer<TEventUnion>);
    }
    return this;
  }

  async refresh(): Promise<this> {
    this.cachedEventsPromise = undefined;
    this.existingProjectionPromise = undefined;
    await this.loadExistingProjection();
    return this;
  }

  abstract asJson(): Promise<z.infer<TJson>>;

  async save(): Promise<void> {
    if (this.appliedEvents.length > 0) {
      throw new Error('Cannot save projection with applied events');
    }

    const json = await this.asJson();
    const validatedJson = this.jsonSchema.parse(json);

    const cachedEvents = this.cachedEventsPromise
      ? await this.cachedEventsPromise
      : [];
    const projection = await this.loadExistingProjection();
    if (cachedEvents.length === 0 && !projection?.lastEventId) {
      throw new Error('Cannot save projection with no events');
    }

    const lastEventId =
      cachedEvents.length > 0
        ? cachedEvents[cachedEvents.length - 1].id
        : projection!.lastEventId;

    await this.eventClient.saveProjection({
      type: this.type,
      id: this.id,
      data: validatedJson,
      eventId: lastEventId,
    });
  }
}
