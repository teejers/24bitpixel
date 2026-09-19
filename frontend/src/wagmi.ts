import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { fallback, http } from "wagmi";
import { hardhat, mainnet, sepolia } from "wagmi/chains";
import { rpcUrlsFor, type ChainName } from "./utils/rpc";

/**
 * Each build of the site talks to exactly ONE chain, chosen at build time:
 *   local dev            -> hardhat   (default)
 *   staging  (test site) -> VITE_CHAIN=sepolia
 *   production           -> VITE_CHAIN=mainnet
 * Set in frontend/.env.production / .env.staging or on the build command line.
 */
const CHAINS = { hardhat, sepolia, mainnet } as const;

const requested = import.meta.env.VITE_CHAIN ?? "hardhat";
export const chainName: ChainName =
  requested in CHAINS ? (requested as ChainName) : "hardhat";
export const chain = CHAINS[chainName];

// Reads go through a chain of endpoints (config/rpcs.json): when one
// refuses or fails a request, the next is tried. VITE_RPC_URL, if set,
// is a comma-separated list tried ahead of the public ones.
const urls = rpcUrlsFor(chainName, import.meta.env.VITE_RPC_URL);

export const config = getDefaultConfig({
  appName: "24 Bit Pixel",
  projectId: import.meta.env.VITE_WALLETCONNECT_ID ?? "YOUR_WALLETCONNECT_PROJECT_ID",
  chains: [chain],
  transports: {
    [chain.id]: fallback(
      urls.map((url) => http(url, { retryCount: 1 })),
      { retryCount: 0 }
    ),
  },
});
