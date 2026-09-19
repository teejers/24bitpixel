import rpcs from "../config/rpcs.json";

export type ChainName = "hardhat" | "sepolia" | "mainnet";

/** RPC endpoints for a chain, in the order to try them. `extra` is an
 *  optional comma-separated list (VITE_RPC_URL) that goes first — a
 *  dedicated endpoint with its own key, say — ahead of the public ones. */
export function rpcUrlsFor(chain: ChainName, extra?: string): string[] {
  const own = (extra ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([...own, ...rpcs[chain]])];
}
