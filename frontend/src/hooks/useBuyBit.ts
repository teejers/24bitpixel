import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../constants";

export function useBuyBit() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function buy(bitId: number, newPriceEth: string, paymentEth: string) {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "buyBit",
      args: [BigInt(bitId), parseEther(newPriceEth)],
      value: parseEther(paymentEth),
    });
  }

  return { buy, isPending, isConfirming, isSuccess, error, hash };
}
