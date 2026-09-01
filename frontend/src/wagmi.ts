import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { hardhat, mainnet, sepolia } from "wagmi/chains";

/**
 * Each build of the site talks to exactly ONE chain, chosen at build time:
 *   local dev            -> hardhat   (default)
 *   staging  (test site) -> VITE_CHAIN=sepolia
 *   production           -> VITE_CHAIN=mainnet
 * Set in frontend/.env.production / .env.staging or on the build command line.
 */
const CHAINS = { hardhat, sepolia, mainnet } as const;

const chainName = (import.meta.env.VITE_CHAIN ?? "hardhat") as keyof typeof CHAINS;
export const chain = CHAINS[chainName] ?? hardhat;

// Dedicated RPC endpoint (Alchemy/Infura). Falls back to the chain's public
// RPC, which is fine for dev but rate-limited in production.
const rpcUrl =
  import.meta.env.VITE_RPC_URL ??
  (chain.id === hardhat.id ? "http://127.0.0.1:8545" : undefined);

export const config = getDefaultConfig({
  appName: "24 Bit Pixel",
  projectId: import.meta.env.VITE_WALLETCONNECT_ID ?? "YOUR_WALLETCONNECT_PROJECT_ID",
  chains: [chain],
  transports: {
    [chain.id]: http(rpcUrl),
  },
});
