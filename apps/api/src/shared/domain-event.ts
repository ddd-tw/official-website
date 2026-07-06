/** Base shape of every domain event raised by an aggregate. */
export interface DomainEvent {
  readonly type: string;
  readonly occurredAt: Date;
}

export type DomainEventHandler<E extends DomainEvent = DomainEvent> = (event: E) => Promise<void>;

/**
 * Minimal in-process dispatcher. Command handlers dispatch the events an
 * aggregate raised *within the same transaction*, so policies (e.g.
 * TicketIssuancePolicy) participate atomically.
 */
export class DomainEventDispatcher {
  private readonly handlers = new Map<string, DomainEventHandler[]>();

  subscribe<E extends DomainEvent>(type: E["type"], handler: DomainEventHandler<E>): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler as DomainEventHandler);
    this.handlers.set(type, list);
  }

  async dispatch(events: readonly DomainEvent[]): Promise<void> {
    for (const event of events) {
      for (const handler of this.handlers.get(event.type) ?? []) {
        await handler(event);
      }
    }
  }
}
