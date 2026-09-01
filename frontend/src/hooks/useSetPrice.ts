import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../constants";

export function useSetPrice() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function setPrice(bitId: number, priceEth: string) {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "setPrice",
      args: [BigInt(bitId), parseEther(priceEth)],
    });
  }

  return { setPrice, isPending, isConfirming, isSuccess, error, hash };
}
