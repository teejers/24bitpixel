import { type Log } from "viem";

export type TimelineEventType = "BitToggled" | "BitBought" | "PriceSet";

export interface TimelineEvent {
  type: TimelineEventType;
  bitId: number;
  blockNumber: bigint;
  transactionHash: string;
  color?: number;
  timestamp?: bigint;
  args: Record<string, unknown>;
}

const EVENT_TYPES: readonly string[] = ["BitToggled", "BitBought", "PriceSet"];

export function parseEventLog(log: Log & { eventName?: string; args?: Record<string, unknown> }): TimelineEvent | null {
  if (!log.eventName || !log.args) return null;
  if (!EVENT_TYPES.includes(log.eventName)) return null;

  const type = log.eventName as TimelineEventType;
  const args = log.args as Record<string, unknown>;
  const bitId = Number(args["bitId"] ?? 0);

  return {
    type,
    bitId,
    blockNumber: log.blockNumber ?? 0n,
    transactionHash: log.transactionHash ?? "0x",
    color: args["newColor"] !== undefined ? Number(args["newColor"]) : undefined,
    timestamp: args["timestamp"] as bigint | undefined,
    args,
  };
}

/** The address responsible for an event: toggler, buyer, or price-setter. */
export function eventActor(event: TimelineEvent): string | undefined {
  switch (event.type) {
    case "BitToggled":
      return event.args["toggler"] as string | undefined;
    case "BitBought":
      return event.args["newOwner"] as string | undefined;
    case "PriceSet":
      return event.args["owner"] as string | undefined;
  }
}

/** The ETH amount attached to an event: sale price or newly set price. */
export function eventPrice(event: TimelineEvent): bigint | undefined {
  switch (event.type) {
    case "BitBought":
      return event.args["price"] as bigint | undefined;
    case "PriceSet":
      return event.args["newPrice"] as bigint | undefined;
    case "BitToggled":
      return undefined;
  }
}
