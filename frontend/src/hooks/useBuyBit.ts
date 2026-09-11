import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../constants";
import { chain } from "../wagmi";

export function useBuyBit() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function buy(bitId: number, newPriceEth: string, paymentEth: string) {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "buyBit",
      args: [BigInt(bitId), parseEther(newPriceEth)],
      value: parseEther(paymentEth),
      // See useToggleBit: pins the chain so wallets switch instead of
      // silently dropping the request.
      chainId: chain.id,
    });
  }

  return { buy, isPending, isConfirming, isSuccess, error, hash, reset };
}
