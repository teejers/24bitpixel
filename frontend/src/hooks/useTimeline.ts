import { useCallback, useEffect, useRef, useState } from "react";
import { usePublicClient } from "wagmi";
import { CONTRACT_ADDRESS, CONTRACT_ABI, DEPLOYMENT } from "../constants";
import { type TimelineEvent, parseEventLog } from "../utils/timeline";
import { type AbiEvent, type Log } from "viem";

// Decode historical logs against the contract's events
const CONTRACT_EVENTS = CONTRACT_ABI.filter(
  (item) => item.type === "event"
) as unknown as AbiEvent[];

export function useTimeline() {
  const publicClient = usePublicClient();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const seenTxs = useRef(new Set<string>());
  // Last block whose logs we've fetched; new-event polling resumes from here.
  const lastBlock = useRef<bigint | null>(null);

  const addEvents = useCallback((newEvents: TimelineEvent[]) => {
    const unseen = newEvents.filter((e) => {
      const key = `${e.transactionHash}-${e.type}-${e.bitId}`;
      if (seenTxs.current.has(key)) return false;
      seenTxs.current.add(key);
      return true;
    });
    if (unseen.length > 0) {
      setEvents((prev) => [...prev, ...unseen]);
    }
  }, []);

  // Fetch historical events once
  useEffect(() => {
    if (!publicClient) return;

    async function fetchEvents() {
      setIsLoading(true);
      try {
        const latest = await publicClient!.getBlockNumber();
        const logs = await publicClient!.getLogs({
          address: CONTRACT_ADDRESS,
          events: CONTRACT_EVENTS,
          fromBlock: DEPLOYMENT.deployBlock,
          toBlock: latest,
        });
        lastBlock.current = latest;

        const parsed = logs
          .map((log) =>
            parseEventLog(log as Log & { eventName?: string; args?: Record<string, unknown> })
          )
          .filter((e): e is TimelineEvent => e !== null);

        // Seed the seen set
        for (const e of parsed) {
          seenTxs.current.add(`${e.transactionHash}-${e.type}-${e.bitId}`);
        }
        setEvents(parsed);
      } catch (err) {
        console.error("Failed to fetch timeline events:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchEvents();
  }, [publicClient]);

  // Fill in each event's actual gas fee from its transaction receipt
  const gasCache = useRef(new Map<string, bigint>());
  useEffect(() => {
    if (!publicClient) return;
    const missing = events.filter((e) => e.gasFee === undefined);
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      const fees = new Map<string, bigint>();
      for (const e of missing) {
        let fee = gasCache.current.get(e.transactionHash);
        if (fee === undefined) {
          try {
            const receipt = await publicClient.getTransactionReceipt({
              hash: e.transactionHash as `0x${string}`,
            });
            fee = receipt.gasUsed * receipt.effectiveGasPrice;
            gasCache.current.set(e.transactionHash, fee);
          } catch {
            continue;
          }
        }
        fees.set(e.transactionHash, fee);
      }
      if (!cancelled && fees.size > 0) {
        setEvents((prev) =>
          prev.map((e) =>
            e.gasFee === undefined && fees.has(e.transactionHash)
              ? { ...e, gasFee: fees.get(e.transactionHash) }
              : e
          )
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [events, publicClient]);

  // Watch for new events — deduplicated via seenTxs. Polls getLogs over the
  // blocks since the last fetch: eth_newFilter-based watchers silently drop
  // events on load-balanced public RPCs, so we can't use useWatchContractEvent.
  useEffect(() => {
    if (!publicClient) return;
    const id = setInterval(async () => {
      const from = lastBlock.current;
      if (from === null) return; // historical fetch hasn't finished yet
      try {
        const latest = await publicClient.getBlockNumber();
        if (latest <= from) return;
        const logs = await publicClient.getLogs({
          address: CONTRACT_ADDRESS,
          events: CONTRACT_EVENTS,
          fromBlock: from + 1n,
          toBlock: latest,
        });
        lastBlock.current = latest;
        const newEvents = logs
          .map((log) =>
            parseEventLog(log as Log & { eventName?: string; args?: Record<string, unknown> })
          )
          .filter((e): e is TimelineEvent => e !== null);
        addEvents(newEvents);
      } catch {
        // Transient RPC hiccup — leave lastBlock as-is and retry next tick.
      }
    }, 12_000);
    return () => clearInterval(id);
  }, [publicClient, addEvents]);

  return { events, isLoading };
}
