import { useEffect, useState } from "react";
import { useChainModal, useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { formatEther } from "viem";
import { useBitStates } from "../hooks/useBitStates";
import { useToggleBit } from "../hooks/useToggleBit";
import { useSetPrice } from "../hooks/useSetPrice";
import { useBuyBit } from "../hooks/useBuyBit";
import { chain } from "../wagmi";

interface BitActionsProps {
  bitId: number;
}

/** The tx lifecycle shape shared by the toggle/price/buy hooks. */
interface TxState {
  isPending: boolean;
  isConfirming: boolean;
  isSuccess: boolean;
  hash?: string;
  error: Error | null;
}

interface TxMessage {
  text: string;
  isError: boolean;
}

/** The message for one action's button: confirm (wallet open) -> in
 *  progress (mining) -> complete, or the error that ended it. Complete and
 *  error messages linger; `dismissed` holds the ones already clicked away. */
function txMessage(
  label: string,
  tx: TxState,
  dismissed: ReadonlySet<unknown>
): TxMessage | null {
  if (tx.isPending) return { text: `Confirm ${label} →`, isError: false };
  if (tx.isConfirming)
    return { text: `${label} in progress ...`, isError: false };
  if (tx.error && !dismissed.has(tx.error)) {
    const raw =
      (tx.error as { shortMessage?: string }).shortMessage ?? tx.error.message;
    return {
      text: /user rejected|user denied/i.test(raw) ? "Request cancelled" : raw,
      isError: true,
    };
  }
  if (tx.isSuccess && tx.hash && !dismissed.has(tx.hash))
    return { text: `${label} complete`, isError: false };
  return null;
}

function TxMessageLine({ msg }: { msg: TxMessage | null }) {
  if (!msg) return null;
  return (
    <p className={msg.isError ? "status error" : "status"}>{msg.text}</p>
  );
}

/** Actions for the pinned bit, floating just below its cell: a one-click
 *  buy for bits you don't own; toggle + price controls for your own. Each
 *  button reports its own tx directly beneath itself. */
export function BitActions({ bitId }: BitActionsProps) {
  const { address, chain: walletChain } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { openChainModal } = useChainModal();
  const { bits } = useBitStates();
  const toggleTx = useToggleBit();
  const priceTx = useSetPrice();
  const buyTx = useBuyBit();
  const txs = [toggleTx, priceTx, buyTx];

  const bit = bits?.[bitId];
  const priceEth = bit ? formatEther(bit.price) : "";
  const isOwner =
    !!address && !!bit && address.toLowerCase() === bit.owner.toLowerCase();

  // The price input starts at the current asking price; UPDATE PRICE wakes
  // up only once the value is a valid price different from it.
  const [priceInput, setPriceInput] = useState(priceEth);
  useEffect(() => {
    setPriceInput(priceEth);
  }, [bitId, priceEth]);

  const parsed = Number(priceInput);
  const changed =
    priceInput !== "" &&
    priceInput !== priceEth &&
    !Number.isNaN(parsed) &&
    parsed > 0;

  const busy = txs.some((tx) => tx.isPending || tx.isConfirming);

  // A request the wallet never showed (a mobile-wallet relay drop) leaves
  // isPending stuck forever and the buttons dead. After 8s waiting on the
  // wallet, offer a cancel that resets the hooks so the user can retry.
  const awaitingWallet = txs.some((tx) => tx.isPending);
  const [walletSlow, setWalletSlow] = useState(false);
  useEffect(() => {
    if (!awaitingWallet) {
      setWalletSlow(false);
      return;
    }
    const t = setTimeout(() => setWalletSlow(true), 8000);
    return () => clearTimeout(t);
  }, [awaitingWallet]);

  // Complete and error messages stay up until the next click anywhere.
  const [dismissed, setDismissed] = useState<ReadonlySet<unknown>>(new Set());
  const dismissables = txs.flatMap((tx) => [
    ...(tx.isSuccess && tx.hash && !dismissed.has(tx.hash) ? [tx.hash] : []),
    ...(tx.error && !dismissed.has(tx.error) ? [tx.error] : []),
  ]);
  // Re-attached every render so the listener always sees the current set.
  useEffect(() => {
    if (dismissables.length === 0) return;
    const dismiss = () =>
      setDismissed((prev) => new Set([...prev, ...dismissables]));
    document.addEventListener("click", dismiss);
    return () => document.removeEventListener("click", dismiss);
  });

  const toggleMsg = txMessage("toggle", toggleTx, dismissed);
  const priceMsg = txMessage("price update", priceTx, dismissed);
  const buyMsg = txMessage("purchase", buyTx, dismissed);

  return (
    <div className="bit-actions">
      {!address ? (
        <button onClick={openConnectModal}>Login to buy or toggle</button>
      ) : walletChain?.id !== chain.id ? (
        /* Wrong network: switching is its own visible step here. Baking the
           switch into a buy/toggle request loses it on mobile wallets. */
        <button onClick={openChainModal}>
          Switch wallet to {chain.name}
        </button>
      ) : isOwner ? (
        <>
          {/* A just-finished purchase flips this panel to the owner view;
              keep its message visible until the usual click-away. */}
          <TxMessageLine msg={buyMsg} />
          <button onClick={() => toggleTx.toggle(bitId)} disabled={busy}>
            Toggle bit
          </button>
          <TxMessageLine msg={toggleMsg} />
          <span className="price-label">Price:</span>
          <div className="price-row">
            <input
              type="text"
              inputMode="decimal"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              aria-label="New price in ETH"
            />
            <span>ETH</span>
          </div>
          <button
            onClick={() => priceTx.setPrice(bitId, priceInput)}
            disabled={busy || !changed}
          >
            Update price
          </button>
          <TxMessageLine msg={priceMsg} />
        </>
      ) : (
        <>
          <button
            onClick={() => bit && buyTx.buy(bitId, priceEth, priceEth)}
            disabled={busy || !bit}
          >
            Buy bit {String(bitId).padStart(2, "0")} for {priceEth} ETH
          </button>
          <TxMessageLine msg={buyMsg} />
        </>
      )}
      {awaitingWallet && walletSlow && (
        <>
          <p className="status">No prompt in your wallet?</p>
          <button onClick={() => txs.forEach((tx) => tx.reset())}>
            Cancel and retry
          </button>
        </>
      )}
    </div>
  );
}
