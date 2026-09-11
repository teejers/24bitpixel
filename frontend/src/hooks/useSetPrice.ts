import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../constants";
import { chain } from "../wagmi";

export function useSetPrice() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function setPrice(bitId: number, priceEth: string) {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "setPrice",
      args: [BigInt(bitId), parseEther(priceEth)],
      // See useToggleBit: pins the chain so wallets switch instead of
      // silently dropping the request.
      chainId: chain.id,
    });
  }

  return { setPrice, isPending, isConfirming, isSuccess, error, hash };
}
