import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { SingleStreamValidator } from '../src/validators/single-stream-validator';
import { EventClient } from '../src/event-client';
import { z } from 'zod';
import { ulid } from 'ulidx';

const eventSchema = z.object({
  type: z.literal('TEST_EVENT'),
  data: z.object({
    id: z.string(),
  }),
});

const eventUnion = z.discriminatedUnion('type', [eventSchema]);

class TestValidator extends SingleStreamValidator<
  typeof eventUnion,
  typeof eventUnion
> {
  async isValid(): Promise<boolean> {
    return true;
  }
}

class InvalidTestValidator extends SingleStreamValidator<
  typeof eventUnion,
  typeof eventUnion
> {
  async isValid(): Promise<boolean> {
    return false;
  }
}

type MockedClient = {
  getEventStream: Mock;
} & Omit<EventClient<typeof eventUnion, typeof eventUnion>, 'getEventStream'>;

describe('SingleStreamValidator', () => {
  let client: MockedClient;

  beforeEach(() => {
    client = {
      getEventStream: vi.fn(),
    } as MockedClient;
  });

  describe('apply', () => {
    it('should handle empty array', () => {
      const validator = new TestValidator(client, ['TEST_EVENT']);
      validator.apply([]);
      expect(validator['appliedEvents']).toHaveLength(0);
    });
  });

  describe('refresh', () => {
    it('should handle error in getEventStream', async () => {
      const validator = new TestValidator(client, ['TEST_EVENT']);
      const error = new Error('Test error');
      client.getEventStream.mockRejectedValueOnce(error);

      await expect(validator.refresh()).rejects.toThrow(error);
    });
  });

  describe('save', () => {
    it('should return empty array when no events are applied', async () => {
      const validator = new TestValidator(client, ['TEST_EVENT']);
      const result = await validator.save();
      expect(result).toEqual([]);
    });

    it('should throw error when cached events are not loaded', async () => {
      const validator = new TestValidator(client, ['TEST_EVENT']);
      const event = {
        type: 'TEST_EVENT' as const,
        data: { id: ulid() },
      };
      validator.apply(event);

      await expect(validator.save()).rejects.toThrow();
    });

    it('should throw error when validation fails', async () => {
      const validator = new InvalidTestValidator(client, ['TEST_EVENT']);
      const event = {
        type: 'TEST_EVENT' as const,
        data: { id: ulid() },
      };
      validator.apply(event);
      await validator.refresh();

      await expect(validator.save()).rejects.toThrow('Validation failed');
    });

    it('should throw error when cached events promise rejects', async () => {
      const validator = new TestValidator(client, ['TEST_EVENT']);
      const event = {
        type: 'TEST_EVENT' as const,
        data: { id: ulid() },
      };
      validator.apply(event);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (validator as any).cachedEventsPromise = Promise.reject(
        new Error('Cached events error'),
      );

      await expect(validator.save()).rejects.toThrow('Cached events error');
    });
  });
});
