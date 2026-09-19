import { useCallback, useEffect, useRef, useState } from "react";
import { usePublicClient } from "wagmi";
import { CONTRACT_ADDRESS, DEPLOYMENT } from "../constants";
import { chain, chainName } from "../wagmi";
import { type TimelineEvent } from "../utils/timeline";
import {
  type HistorySnapshot,
  deserializeEvent,
  fetchEvents,
  fetchGasFees,
} from "../utils/history";

/** How often to look for new events (one mainnet block is 12s). */
const POLL_MS = 12_000;
/** Retry cadence while the first fetch keeps failing. */
const RETRY_MS = 3_000;
/** Blocks re-scanned on every poll. Public RPCs are load-balanced, and a
 *  node that lags a few blocks behind the one that answered
 *  eth_blockNumber would otherwise make us skip its unseen events. */
const OVERLAP_BLOCKS = 100n;
/** Every Nth poll replays everything since the snapshot and merges it
 *  in, healing an earlier fetch that came back short. */
const RESYNC_EVERY = 25;
/** How many times to go back for gas receipts an endpoint wouldn't give. */
const GAS_RETRIES = 5;

// The history baked into this build: one JSON file per chain, produced
// by scripts/snapshot-history.ts. Loaded lazily so a build only ships
// the chain it talks to. Missing (local dev) means start at the deploy block.
const SNAPSHOTS = import.meta.glob<{ default: HistorySnapshot }>(
  "../data/history.*.json"
);

async function loadSnapshot(): Promise<HistorySnapshot | null> {
  const load = SNAPSHOTS[`../data/history.${chainName}.json`];
  if (!load) return null;
  try {
    const snap = (await load()).default;
    const sameContract =
      snap.chainId === chain.id &&
      snap.address.toLowerCase() === CONTRACT_ADDRESS.toLowerCase();
    return sameContract ? snap : null;
  } catch {
    return null;
  }
}

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
  // True until some history is on screen: the snapshot, or the first
  // successful fetch when there is none.
  const [isLoading, setIsLoading] = useState(true);
  const seen = useRef(new Set<string>());
  // The block the history is complete through before any live fetch:
  // the snapshot's last block, else the block before deployment.
  const base = useRef<bigint | null>(null);
  // Head block as of the last successful fetch; null until the first
  // one lands, so a failed first load keeps retrying in full.
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

  /** Fetch logs up to the current head: everything since the snapshot
   *  when `full`, otherwise the blocks since the last fetch plus overlap. */
  const sync = useCallback(
    async (full: boolean) => {
      if (!publicClient || inFlight.current || base.current === null) return;
      inFlight.current = true;
      try {
        const latest = await publicClient.getBlockNumber();
        const floor = base.current + 1n;
        const from =
          full || lastBlock.current === null
            ? floor
            : lastBlock.current - OVERLAP_BLOCKS;
        const fromBlock = from < floor ? floor : from;
        if (!full && lastBlock.current !== null && latest <= lastBlock.current) return;

        if (fromBlock <= latest) {
          addEvents(await fetchEvents(publicClient, CONTRACT_ADDRESS, fromBlock, latest));
        }
        if (lastBlock.current === null || latest > lastBlock.current) {
          lastBlock.current = latest;
        }
        setIsLoading(false);
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

  // Seed from the snapshot, then keep polling. A setTimeout chain (not
  // setInterval) so the cadence can tighten while the first fetch fails.
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

    (async () => {
      const snap = await loadSnapshot();
      if (cancelled) return;
      if (snap) {
        addEvents(snap.events.map(deserializeEvent));
        base.current = BigInt(snap.toBlock);
        setIsLoading(false);
      } else {
        base.current = DEPLOYMENT.deployBlock - 1n;
      }
      tick();
    })();

    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [publicClient, sync, addEvents]);

  // Fill in each live event's gas fee from its receipt (snapshot events
  // already carry theirs). Receipts that fail are retried a little later.
  const gasCache = useRef(new Map<string, bigint>());
  const [gasRetry, setGasRetry] = useState(0);
  useEffect(() => {
    if (!publicClient) return;
    const missing = events.filter((e) => e.gasFee === undefined);
    if (missing.length === 0) return;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      const toFetch = missing
        .map((e) => e.transactionHash)
        .filter((h) => !gasCache.current.has(h));
      const { fees, failed } = await fetchGasFees(
        publicClient,
        toFetch,
        () => cancelled
      );
      if (cancelled) return;
      for (const [h, fee] of fees) gasCache.current.set(h, fee);
      const known = gasCache.current;
      if (missing.some((e) => known.has(e.transactionHash))) {
        setEvents((prev) =>
          prev.map((e) =>
            e.gasFee === undefined && known.has(e.transactionHash)
              ? { ...e, gasFee: known.get(e.transactionHash) }
              : e
          )
        );
      }
      if (failed > 0 && gasRetry < GAS_RETRIES) {
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
