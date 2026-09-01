import { useReadContract } from "wagmi";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../constants";

export interface BitData {
  owner: string;
  price: bigint;
  state: boolean;
}

export function useBitStates() {
  const result = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "getAllBitInfo",
    query: {
      refetchInterval: 12_000,
    },
  });

  const bits: BitData[] | undefined = result.data
    ? Array.from({ length: 24 }, (_, i) => ({
        owner: result.data[0][i]!,
        price: result.data[1][i]!,
        state: result.data[2][i]!,
      }))
    : undefined;

  return { ...result, bits };
}
