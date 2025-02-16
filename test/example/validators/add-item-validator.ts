import { SingleStreamValidator } from '../../../src/validators';
import { eventUnion, eventTypes, UserEvent } from '../events';
import type { Projection } from '../../../src';
import type { EventClient } from '../../../src';

const toIncompleteItemIdsInList = (ids: string[], event: UserEvent): string[] => {
  switch (event.type) {
    case eventTypes.ITEM_ADDED:
      return [...ids, event.data.itemId];
    case eventTypes.ITEM_REMOVED:
      return ids.filter(id => id !== event.data.itemId);
    case eventTypes.ITEM_COMPLETED:
      return ids.filter(id => id !== event.data.itemId);
    case eventTypes.ITEM_MARKED_INCOMPLETE:
      return [...ids.filter(id => id !== event.data.itemId), event.data.itemId];
    default:
      return ids;
  }
};

export class AddItemValidator extends SingleStreamValidator<typeof eventUnion, Projection<string, unknown>> {
  constructor(
    eventClient: EventClient<typeof eventUnion, Projection<string, unknown>>,
    listId: string
  ) {
    super(eventClient, [
      eventTypes.ITEM_ADDED,
      eventTypes.ITEM_REMOVED,
      eventTypes.ITEM_COMPLETED,
      eventTypes.ITEM_MARKED_INCOMPLETE
    ], {
      listId: { eq: listId }
    });
  }

  private async ensureIncompleteItemCountIsLessThanThree() {
    const ids = await this.reduceEvents(toIncompleteItemIdsInList, []);
    if (ids.length > 3) {
      throw new Error('Incomplete item count is greater than three');
    }
    return;
  }

  async isValid(): Promise<boolean> {
    await this.ensureIncompleteItemCountIsLessThanThree();
    return true;
  }
} 