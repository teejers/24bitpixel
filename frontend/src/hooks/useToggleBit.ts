import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../constants";
import { chain } from "../wagmi";

export function useToggleBit() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function toggle(bitId: number) {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "toggleBit",
      args: [BigInt(bitId)],
      // Pin the target chain: wagmi prompts a network switch first if the
      // wallet is elsewhere. Without this, MetaMask mobile silently drops
      // requests aimed at a chain its session isn't on.
      chainId: chain.id,
    });
  }

  return { toggle, isPending, isConfirming, isSuccess, error, hash, reset };
}
