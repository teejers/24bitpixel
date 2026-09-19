/** Fetching the contract's event history from an RPC, and the snapshot
 *  of it baked into each build (see scripts/snapshot-history.ts). Shared
 *  by the browser (hooks/useTimeline) and the snapshot script. */
import { type AbiEvent, type Log, type PublicClient } from "viem";
import { CONTRACT_ABI } from "../contract-abi";
import { type TimelineEvent, parseEventLog } from "./timeline";

export const CONTRACT_EVENTS = CONTRACT_ABI.filter(
  (item) => item.type === "event"
) as unknown as AbiEvent[];

/** Blocks per eth_getLogs call. Free endpoints cap the range at 10k
 *  (drpc, mevblocker) or 50k (PublicNode Sepolia); 9k fits them all. */
export const LOG_CHUNK = 9_000n;

type RpcClient = Pick<PublicClient, "getLogs" | "getTransactionReceipt">;

/** Every contract event in [fromBlock, toBlock], in chain order. */
export async function fetchEvents(
  client: RpcClient,
  address: `0x${string}`,
  fromBlock: bigint,
  toBlock: bigint
): Promise<TimelineEvent[]> {
  const out: TimelineEvent[] = [];
  for (let from = fromBlock; from <= toBlock; from += LOG_CHUNK) {
    const to = from + LOG_CHUNK - 1n < toBlock ? from + LOG_CHUNK - 1n : toBlock;
    const logs = await client.getLogs({
      address,
      events: CONTRACT_EVENTS,
      fromBlock: from,
      toBlock: to,
    });
    for (const log of logs) {
      const e = parseEventLog(
        log as Log & { eventName?: string; args?: Record<string, unknown> }
      );
      if (e) out.push(e);
    }
  }
  return out;
}

/** Actual network fee (gasUsed x effective price) per transaction hash.
 *  Several clients can be given: a public endpoint may answer "not found"
 *  for a receipt it has pruned (a plain null, so a fallback transport
 *  can't help), in which case the next client is asked. A receipt no
 *  client returns is left out and counted in `failed`. */
export async function fetchGasFees(
  clients: RpcClient | RpcClient[],
  hashes: Iterable<string>,
  isCancelled: () => boolean = () => false
): Promise<{ fees: Map<string, bigint>; failed: number; lastError?: string }> {
  const list = Array.isArray(clients) ? clients : [clients];
  const fees = new Map<string, bigint>();
  let failed = 0;
  let lastError: string | undefined;
  for (const hash of new Set(hashes)) {
    if (isCancelled()) break;
    for (const client of list) {
      try {
        const receipt = await client.getTransactionReceipt({
          hash: hash as `0x${string}`,
        });
        fees.set(hash, receipt.gasUsed * receipt.effectiveGasPrice);
        break;
      } catch (err) {
        lastError =
          (err as { shortMessage?: string }).shortMessage ?? (err as Error).message;
      }
    }
    if (!fees.has(hash)) failed += 1;
  }
  return { fees, failed, lastError };
}

// --- Snapshot: history as JSON (bigints as decimal strings) ---

export interface SerializedEvent {
  type: TimelineEvent["type"];
  bitId: number;
  blockNumber: string;
  logIndex: number;
  transactionHash: string;
  color?: number;
  timestamp?: string;
  gasFee?: string;
  args: Record<string, string | number | boolean>;
}

export interface HistorySnapshot {
  chainId: number;
  address: string;
  /** Every event up to and including this block is in `events`. */
  toBlock: string;
  takenAt: string;
  events: SerializedEvent[];
}

/** Event args that are uint256 in the ABI, restored to bigint on load. */
const BIGINT_ARGS = new Set(["bitId", "price", "newPrice", "oldPrice", "timestamp"]);

export function serializeEvent(e: TimelineEvent): SerializedEvent {
  const args: SerializedEvent["args"] = {};
  for (const [k, v] of Object.entries(e.args)) {
    args[k] = typeof v === "bigint" ? v.toString() : (v as string | number | boolean);
  }
  return {
    type: e.type,
    bitId: e.bitId,
    blockNumber: e.blockNumber.toString(),
    logIndex: e.logIndex,
    transactionHash: e.transactionHash,
    ...(e.color !== undefined ? { color: e.color } : {}),
    ...(e.timestamp !== undefined ? { timestamp: e.timestamp.toString() } : {}),
    ...(e.gasFee !== undefined ? { gasFee: e.gasFee.toString() } : {}),
    args,
  };
}

export function deserializeEvent(s: SerializedEvent): TimelineEvent {
  const args: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s.args)) {
    args[k] = BIGINT_ARGS.has(k) && typeof v === "string" ? BigInt(v) : v;
  }
  return {
    type: s.type,
    bitId: s.bitId,
    blockNumber: BigInt(s.blockNumber),
    logIndex: s.logIndex,
    transactionHash: s.transactionHash,
    color: s.color,
    timestamp: s.timestamp !== undefined ? BigInt(s.timestamp) : undefined,
    gasFee: s.gasFee !== undefined ? BigInt(s.gasFee) : undefined,
    args,
  };
}
