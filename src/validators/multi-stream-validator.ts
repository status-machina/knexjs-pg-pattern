import { z } from 'zod';
import { EventClient } from '../event-client';
import { DataFilter } from '../query-types';
import type { EventInput } from '../event-schema';

type StreamConfig = {
  types: string[];
  filter?: DataFilter;
};

export abstract class MultiStreamValidator<
  TEventUnion extends z.ZodType,
  TProjection extends {
    id: string;
    type: string;
    data: unknown;
    lastEventId: string;
  },
> {
  protected eventClient: EventClient<TEventUnion, TProjection>;
  protected streams: StreamConfig[];
  private cachedEventsPromise?: Promise<Array<z.infer<TEventUnion>>>;
  private appliedEvents: Array<z.infer<TEventUnion>> = [];

  constructor(
    eventClient: EventClient<TEventUnion, TProjection>,
    streams: StreamConfig[],
  ) {
    this.eventClient = eventClient;
    this.streams = streams;
  }

  protected async getEvents(): Promise<Array<z.infer<TEventUnion>>> {
    if (!this.cachedEventsPromise) {
      this.cachedEventsPromise = this.eventClient.getEventStreams({
        streams: this.streams,
      });
    }

    const cachedEvents = await this.cachedEventsPromise;
    return [...cachedEvents, ...this.appliedEvents];
  }

  protected async reduceOnlyDbEvents<T>(
    reducer: (acc: T, event: z.infer<TEventUnion>) => T,
    defaultValue: T,
  ): Promise<T> {
    if (!this.cachedEventsPromise) {
      this.cachedEventsPromise = this.eventClient.getEventStreams({
        streams: this.streams,
      });
    }
    const cachedEvents = await this.cachedEventsPromise;
    return cachedEvents.reduce(reducer, defaultValue);
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
    this.cachedEventsPromise = this.eventClient.getEventStreams({
      streams: this.streams,
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
      streams: this.streams,
    });
  }
}
