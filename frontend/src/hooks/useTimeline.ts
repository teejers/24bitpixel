import { useCallback, useEffect, useRef, useState } from "react";
import { usePublicClient, useWatchContractEvent } from "wagmi";
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
        const logs = await publicClient!.getLogs({
          address: CONTRACT_ADDRESS,
          events: CONTRACT_EVENTS,
          fromBlock: DEPLOYMENT.deployBlock,
          toBlock: "latest",
        });

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

  // Watch for new events — deduplicated via seenTxs
  const eventNames = ["BitToggled", "BitBought", "PriceSet"] as const;

  for (const eventName of eventNames) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useWatchContractEvent({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      eventName,
      onLogs(logs) {
        const newEvents = logs
          .map((log) =>
            parseEventLog(log as Log & { eventName?: string; args?: Record<string, unknown> })
          )
          .filter((e): e is TimelineEvent => e !== null);

        addEvents(newEvents);
      },
    });
  }

  return { events, isLoading };
}
