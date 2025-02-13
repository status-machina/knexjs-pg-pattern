export type EventClient = {
  saveEvent: (event: Event) => Promise<void>;
  saveEvents: (events: Event[]) => Promise<void>;
  getLatestEvent: (params: GetLatestEventParams) => Promise<Event | null>;
  getEventStream: (params: GetEventStreamParams) => Promise<Event[]>;
  getEventStreams: (params: GetEventStreamsParams) => Promise<Record<string, Event[]>>;
  saveProjection: (params: SaveProjectionParams) => Promise<void>;
  forceUpdateProjection: (params: UpdateProjectionParams) => Promise<void>;
  conditionalUpdateProjection: (params: ConditionalUpdateProjectionParams) => Promise<void>;
  getProjection: (params: GetProjectionParams) => Promise<Projection | null>;
  queryProjections: (params: QueryProjectionsParams) => Promise<Projection[]>;
  saveEventWithStreamValidation: (params: SaveEventWithValidationParams) => Promise<void>;
}

export type Event = {
  id: string;
  type: string;
  data: unknown;
  timestamp: number;
}

export type Projection = {
  id: string;
  type: string;
  data: unknown;
  lastEventId: string;
}

type GetLatestEventParams = {
  type: string;
  filter?: Record<string, unknown>;
}

type GetEventStreamParams = {
  types: string[];
  filter?: Record<string, unknown>;
}

type GetEventStreamsParams = {
  streams: Array<{
    types: string[];
    filter?: Record<string, unknown>;
  }>;
}

type SaveProjectionParams = {
  type: string;
  id: string;
  data: unknown;
  eventId: string;
}

type UpdateProjectionParams = {
  type: string;
  id: string;
  data: unknown;
}

type ConditionalUpdateProjectionParams = UpdateProjectionParams & {
  eventId: string;
}

type GetProjectionParams = {
  type: string;
  id: string;
}

type QueryProjectionsParams = {
  type: string;
  filter?: Record<string, unknown>;
}

type SaveEventWithValidationParams = {
  event: Event;
  streams: GetEventStreamParams[];
}

export const createEventClient = (): EventClient => {
  return {
    saveEvent: async (event) => {
      // Save single event to database
    },

    saveEvents: async (events) => {
      // Save multiple events in batch
    },

    getLatestEvent: async (params) => {
      // Get most recent event of specific type with optional filtering
      return null;
    },

    getEventStream: async (params) => {
      // Get chronological stream of events
      return [];
    },

    getEventStreams: async (params) => {
      // Get multiple event streams simultaneously
      return {};
    },

    saveProjection: async (params) => {
      // Save/update projection conditionally based on event ID
    },

    forceUpdateProjection: async (params) => {
      // Update projection unconditionally
    },

    conditionalUpdateProjection: async (params) => {
      // Update projection if new event ID is more recent
    },

    getProjection: async (params) => {
      // Get single projection by type and ID
      return null;
    },

    queryProjections: async (params) => {
      // Search projections by type with optional filtering
      return [];
    },

    saveEventWithStreamValidation: async (params) => {
      // Save event with concurrency check against specified streams
    }
  };
};
