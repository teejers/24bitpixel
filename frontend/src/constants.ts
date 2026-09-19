import { chain, chainName } from "./wagmi";
import deployments from "./config/deployments.json";

export { CONTRACT_ABI } from "./contract-abi";

export interface Deployment {
  address: `0x${string}`;
  /** Block the contract was deployed at — history fetches start here. */
  deployBlock: bigint;
  /** Block explorer base URL, or null for local chains with no explorer. */
  explorer: string | null;
}

/** Where the contract lives on each chain (see config/deployments.json). */
export const DEPLOYMENTS: Record<number, Deployment> = Object.fromEntries(
  Object.values(deployments).map((d) => [
    d.chainId,
    {
      address: d.address as `0x${string}`,
      deployBlock: BigInt(d.deployBlock),
      explorer: d.explorer,
    },
  ])
);

const deployment = DEPLOYMENTS[chain.id];
if (!deployment || deployments[chainName].chainId !== chain.id) {
  throw new Error(`No deployment configured for chain ${chain.id} (${chain.name})`);
}

export const DEPLOYMENT = deployment;
export const CONTRACT_ADDRESS = deployment.address;
export const EXPLORER_URL = deployment.explorer;
