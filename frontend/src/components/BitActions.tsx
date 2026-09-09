import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { formatEther } from "viem";
import { useBitStates } from "../hooks/useBitStates";
import { useToggleBit } from "../hooks/useToggleBit";
import { useSetPrice } from "../hooks/useSetPrice";
import { useBuyBit } from "../hooks/useBuyBit";

interface BitActionsProps {
  bitId: number;
}

/** Actions for the pinned bit, floating just below its cell: a one-click
 *  buy for bits you don't own; toggle + price controls for your own. */
export function BitActions({ bitId }: BitActionsProps) {
  const { address } = useAccount();
  const { bits } = useBitStates();
  const toggleTx = useToggleBit();
  const priceTx = useSetPrice();
  const buyTx = useBuyBit();

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

  const busy =
    toggleTx.isPending || toggleTx.isConfirming ||
    priceTx.isPending || priceTx.isConfirming ||
    buyTx.isPending || buyTx.isConfirming;
  const error = toggleTx.error ?? priceTx.error ?? buyTx.error;

  // Tx status: confirm (wallet open) -> in progress (mining) -> complete.
  // The complete message stays up until the user clicks anywhere.
  const [dismissedHash, setDismissedHash] = useState<string | undefined>();
  const completedTx = [toggleTx, priceTx, buyTx].find(
    (tx) => tx.isSuccess && tx.hash && tx.hash !== dismissedHash
  );
  const completedHash = completedTx?.hash;
  useEffect(() => {
    if (!completedHash) return;
    const dismiss = () => setDismissedHash(completedHash);
    document.addEventListener("click", dismiss);
    return () => document.removeEventListener("click", dismiss);
  }, [completedHash]);

  // Toggle reports directly below its button.
  const toggleStatus = toggleTx.isPending
    ? "Confirm toggle →"
    : toggleTx.isConfirming
      ? "Toggle in progress ..."
      : completedTx === toggleTx
        ? "Toggle complete"
        : null;

  // Price updates and purchases still report below their buttons.
  const statusActions = [
    { label: "price update", tx: priceTx },
    { label: "purchase", tx: buyTx },
  ];
  const pending = statusActions.find((a) => a.tx.isPending);
  const confirming = statusActions.find((a) => a.tx.isConfirming);
  const completed = statusActions.find((a) => a.tx === completedTx);
  const status = pending
    ? `Confirm ${pending.label} →`
    : confirming
      ? `${confirming.label} in progress ...`
      : completed
        ? `${completed.label} complete`
        : null;

  return (
    <div className="bit-actions">
      {!address ? (
        <p className="status">Login to buy or toggle</p>
      ) : isOwner ? (
        <>
          <button onClick={() => toggleTx.toggle(bitId)} disabled={busy}>
            Toggle bit
          </button>
          {toggleStatus && <p className="status">{toggleStatus}</p>}
          <span className="price-label">Price</span>
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
        </>
      ) : (
        <button
          onClick={() => bit && buyTx.buy(bitId, priceEth, priceEth)}
          disabled={busy || !bit}
        >
          Buy bit {String(bitId).padStart(2, "0")} for {priceEth} ETH
        </button>
      )}
      {status && <p className="status">{status}</p>}
      {error && (
        <p className="error">
          {(error as { shortMessage?: string }).shortMessage ?? error.message}
        </p>
      )}
    </div>
  );
}
