import { z } from 'zod';
import { EventClient } from '../event-client';
import { DataFilter } from '../query-types';
import type { EventInput } from '../event-schema';

export abstract class SingleStreamValidator<
  TEventUnion extends z.ZodType,
  TEventInputUnion extends z.ZodType,
> {
  protected eventClient: EventClient<TEventUnion, TEventInputUnion>;
  protected types: Array<z.infer<TEventUnion>['type']>;
  protected filter?: DataFilter;
  private cachedEventsPromise?: Promise<Array<z.infer<TEventUnion>>>;
  private appliedEvents: Array<z.infer<TEventUnion>> = [];

  constructor(
    eventClient: EventClient<TEventUnion, TEventInputUnion>,
    types: Array<z.infer<TEventUnion>['type']>,
    filter?: DataFilter,
  ) {
    this.eventClient = eventClient;
    this.types = types;
    this.filter = filter;
  }

  protected async getEvents(): Promise<Array<z.infer<TEventUnion>>> {
    if (!this.cachedEventsPromise) {
      this.cachedEventsPromise = this.eventClient.getEventStream({
        types: this.types,
        filter: this.filter,
      });
    }

    const cachedEvents = await this.cachedEventsPromise;
    return [...(cachedEvents ?? []), ...this.appliedEvents];
  }

  protected async reduceOnlyDbEvents<T>(
    reducer: (acc: T, event: z.infer<TEventUnion>) => T,
    defaultValue: T,
  ): Promise<T> {
    if (!this.cachedEventsPromise) {
      this.cachedEventsPromise = this.eventClient.getEventStream({
        types: this.types,
        filter: this.filter,
      });
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
    this.cachedEventsPromise = this.eventClient.getEventStream({
      types: this.types,
      filter: this.filter,
    });
    await this.cachedEventsPromise;
    return this;
  }

  abstract isValid(): Promise<boolean>;

  async save(): Promise<Array<z.infer<TEventUnion>>> {
    if (this.appliedEvents.length === 0) {
      return [];
    }

    const isValid = await this.isValid();
    if (!isValid) {
      throw new Error('Validation failed');
    }

    const cachedEvents = this.cachedEventsPromise
      ? await this.cachedEventsPromise
      : [];
    const latestEventId = cachedEvents.length
      ? BigInt(cachedEvents[cachedEvents.length - 1].id)
      : 0n;

    return this.eventClient.saveEventsWithStreamValidation({
      events: this.appliedEvents,
      latestEventId,
      streams: [{ types: this.types, filter: this.filter }],
    });
  }
}
