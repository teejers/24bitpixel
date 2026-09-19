import { useEffect, useState } from "react";
import { useReadContract } from "wagmi";
import { chain } from "../wagmi";

/** Chainlink ETH/USD price feeds (8 decimals). Local Hardhat has none. */
const FEEDS: Record<number, `0x${string}`> = {
  1: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
  11155111: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
};

const FEED_ABI = [
  {
    name: "latestRoundData",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
] as const;

const REFRESH_MS = 60_000;

/** The current ETH price in US dollars, or undefined while unknown.
 *  Read on-chain from Chainlink where a feed exists; on the local chain
 *  it falls back to CoinGecko so the layout can still be seen in dev. */
export function useEthUsd(): number | undefined {
  const feed = FEEDS[chain.id];
  const onChain = useReadContract({
    address: feed,
    abi: FEED_ABI,
    functionName: "latestRoundData",
    query: { enabled: !!feed, refetchInterval: REFRESH_MS },
  });

  const [fallback, setFallback] = useState<number | undefined>();
  useEffect(() => {
    if (feed) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
        );
        const json = (await res.json()) as { ethereum?: { usd?: number } };
        if (!cancelled && json.ethereum?.usd) setFallback(json.ethereum.usd);
      } catch {
        // No price: the USD figure is simply left out.
      }
    };
    load();
    const id = setInterval(load, REFRESH_MS * 5);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [feed]);

  if (feed) {
    const answer = onChain.data?.[1];
    return answer !== undefined && answer > 0n ? Number(answer) / 1e8 : undefined;
  }
  return fallback;
}
