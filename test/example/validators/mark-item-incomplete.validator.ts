import { SingleStreamValidator } from '../../../src/validators';
import { eventUnion, eventTypes, UserEvent, eventInputUnion } from '../events';
import type { EventClient } from '../../../src';

type CompletionStatus = 'complete' | 'incomplete' | undefined;

const toCompletionStatus = (
  status: CompletionStatus,
  event: UserEvent,
): CompletionStatus => {
  switch (event.type) {
    case eventTypes.ITEM_COMPLETED:
      return 'complete';
    case eventTypes.ITEM_MARKED_INCOMPLETE:
      return 'incomplete';
    case eventTypes.ITEM_ADDED:
      return status === undefined ? 'incomplete' : status;
    default:
      return status;
  }
};

const toPresentInList = (status: boolean, event: UserEvent): boolean => {
  switch (event.type) {
    case eventTypes.ITEM_ADDED:
      return true;
    case eventTypes.ITEM_REMOVED:
      return false;
    default:
      return status;
  }
};

export class MarkItemIncompleteValidator extends SingleStreamValidator<
  typeof eventUnion,
  typeof eventInputUnion
> {
  constructor(
    eventClient: EventClient<typeof eventUnion, typeof eventInputUnion>,
    listId: string,
    itemId: string,
  ) {
    super(
      eventClient,
      [
        eventTypes.ITEM_COMPLETED,
        eventTypes.ITEM_MARKED_INCOMPLETE,
        eventTypes.ITEM_ADDED,
        eventTypes.ITEM_REMOVED,
      ],
      {
        listId: { eq: listId },
        itemId: { eq: itemId },
      },
    );
  }

  private async ensureComplete() {
    const status = await this.reduceOnlyDbEvents(toCompletionStatus, undefined);
    if (status !== 'complete') {
      throw new Error('Item is not complete');
    }
  }

  private async ensurePresentInList() {
    const present = await this.reduceOnlyDbEvents<boolean>(
      toPresentInList,
      false,
    );
    if (!present) {
      throw new Error('Item is not present in list');
    }
  }

  async isValid(): Promise<boolean> {
    await this.ensurePresentInList();
    await this.ensureComplete();
    return true;
  }
}
