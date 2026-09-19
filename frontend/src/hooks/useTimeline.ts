import { useCallback, useEffect, useRef, useState } from "react";
import { usePublicClient } from "wagmi";
import { CONTRACT_ADDRESS, CONTRACT_ABI, DEPLOYMENT } from "../constants";
import { type TimelineEvent, parseEventLog } from "../utils/timeline";
import { type AbiEvent, type Log } from "viem";

// Decode historical logs against the contract's events
const CONTRACT_EVENTS = CONTRACT_ABI.filter(
  (item) => item.type === "event"
) as unknown as AbiEvent[];

/** How often to look for new events (one mainnet block is 12s). */
const POLL_MS = 12_000;
/** Retry cadence while the very first full fetch keeps failing. */
const RETRY_MS = 3_000;
/** Blocks re-scanned on every poll. Public RPCs are load-balanced, and a
 *  node that lags a few blocks behind the one that answered
 *  eth_blockNumber would otherwise make us skip its unseen events. */
const OVERLAP_BLOCKS = 100n;
/** Every Nth poll replays the whole history from the deploy block and
 *  merges it in, healing a first fetch that came back short. */
const RESYNC_EVERY = 25;

function eventKey(e: TimelineEvent): string {
  return `${e.transactionHash}-${e.type}-${e.bitId}`;
}

function byChain(a: TimelineEvent, b: TimelineEvent): number {
  if (a.blockNumber !== b.blockNumber) return a.blockNumber < b.blockNumber ? -1 : 1;
  return a.logIndex - b.logIndex;
}

export function useTimeline() {
  const publicClient = usePublicClient();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  // True until the first full replay from the deploy block succeeds.
  const [isLoading, setIsLoading] = useState(true);
  const seen = useRef(new Set<string>());
  // Head block as of the last successful fetch; null until the first
  // full replay lands, so a failed first load keeps retrying in full.
  const lastBlock = useRef<bigint | null>(null);
  const inFlight = useRef(false);
  const pollCount = useRef(0);

  /** Merge new events in, deduplicated and kept in chain order. */
  const addEvents = useCallback((incoming: TimelineEvent[]) => {
    const unseen = incoming.filter((e) => {
      const key = eventKey(e);
      if (seen.current.has(key)) return false;
      seen.current.add(key);
      return true;
    });
    if (unseen.length > 0) {
      setEvents((prev) => [...prev, ...unseen].sort(byChain));
    }
  }, []);

  /** Fetch logs up to the current head: the whole history when `full`,
   *  otherwise just the blocks since the last fetch (plus an overlap). */
  const sync = useCallback(
    async (full: boolean) => {
      if (!publicClient || inFlight.current) return;
      inFlight.current = true;
      try {
        const latest = await publicClient.getBlockNumber();
        const from =
          full || lastBlock.current === null
            ? DEPLOYMENT.deployBlock
            : lastBlock.current - OVERLAP_BLOCKS;
        const fromBlock = from < DEPLOYMENT.deployBlock ? DEPLOYMENT.deployBlock : from;
        if (!full && lastBlock.current !== null && latest <= lastBlock.current) return;

        const logs = await publicClient.getLogs({
          address: CONTRACT_ADDRESS,
          events: CONTRACT_EVENTS,
          fromBlock,
          toBlock: latest,
        });
        const parsed = logs
          .map((log) =>
            parseEventLog(log as Log & { eventName?: string; args?: Record<string, unknown> })
          )
          .filter((e): e is TimelineEvent => e !== null);
        addEvents(parsed);

        if (lastBlock.current === null || latest > lastBlock.current) {
          lastBlock.current = latest;
        }
        if (full || fromBlock === DEPLOYMENT.deployBlock) setIsLoading(false);
      } catch (err) {
        // Transient RPC hiccup (rate limit, timeout): keep lastBlock as-is
        // so the next tick re-covers the same range.
        console.warn("Timeline fetch failed, will retry:", err);
      } finally {
        inFlight.current = false;
      }
    },
    [publicClient, addEvents]
  );

  // First load, then keep polling. A setTimeout chain (not setInterval) so
  // the cadence can tighten while the initial replay is still failing.
  useEffect(() => {
    if (!publicClient) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      pollCount.current += 1;
      const full = lastBlock.current === null || pollCount.current % RESYNC_EVERY === 0;
      await sync(full);
      if (cancelled) return;
      timer = setTimeout(tick, lastBlock.current === null ? RETRY_MS : POLL_MS);
    };
    tick();

    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [publicClient, sync]);

  // Fill in each event's actual gas fee from its transaction receipt.
  // Receipts that fail (rate-limited RPC) are retried a little later.
  const gasCache = useRef(new Map<string, bigint>());
  const [gasRetry, setGasRetry] = useState(0);
  useEffect(() => {
    if (!publicClient) return;
    const missing = events.filter((e) => e.gasFee === undefined);
    if (missing.length === 0) return;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      const fees = new Map<string, bigint>();
      let failed = false;
      for (const e of missing) {
        if (cancelled) return;
        let fee = gasCache.current.get(e.transactionHash);
        if (fee === undefined) {
          try {
            const receipt = await publicClient.getTransactionReceipt({
              hash: e.transactionHash as `0x${string}`,
            });
            fee = receipt.gasUsed * receipt.effectiveGasPrice;
            gasCache.current.set(e.transactionHash, fee);
          } catch {
            failed = true;
            continue;
          }
        }
        fees.set(e.transactionHash, fee);
      }
      if (cancelled) return;
      if (fees.size > 0) {
        setEvents((prev) =>
          prev.map((e) =>
            e.gasFee === undefined && fees.has(e.transactionHash)
              ? { ...e, gasFee: fees.get(e.transactionHash) }
              : e
          )
        );
      }
      if (failed) {
        retryTimer = setTimeout(() => setGasRetry((n) => n + 1), 5_000);
      }
    })();
    return () => {
      cancelled = true;
      if (retryTimer !== undefined) clearTimeout(retryTimer);
    };
  }, [events, publicClient, gasRetry]);

  return { events, isLoading };
}
