import { SingleStreamValidator } from '../../../src/validators';
import { eventUnion, eventTypes, UserEvent } from '../events';
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

export class CompleteItemValidator extends SingleStreamValidator<
  typeof eventUnion
> {
  constructor(
    eventClient: EventClient<typeof eventUnion>,
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

  private async ensureIncomplete() {
    const status = await this.reduceOnlyDbEvents(toCompletionStatus, undefined);
    if (status !== 'incomplete') {
      throw new Error('Item is not incomplete');
    }
  }

  private async ensurePresentInList() {
    const present = await this.reduceEvents<boolean>(toPresentInList, false);
    if (!present) {
      throw new Error('Item is not present in list');
    }
  }

  async isValid(): Promise<boolean> {
    await this.ensurePresentInList();
    await this.ensureIncomplete();
    return true;
  }
}
