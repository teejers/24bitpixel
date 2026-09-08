import { useState } from "react";
import { useAccount } from "wagmi";
import { formatEther } from "viem";
import { useBitStates } from "../hooks/useBitStates";
import { useToggleBit } from "../hooks/useToggleBit";
import { useSetPrice } from "../hooks/useSetPrice";
import { useBuyBit } from "../hooks/useBuyBit";
import { type TimelineEvent } from "../utils/timeline";
import { ExplorerLink } from "./ExplorerLink";

interface BitPanelProps {
  bitId: number;
  events: TimelineEvent[];
}

function shortAddress(addr: string): string {
  return `${addr.slice(0, 8)}...`;
}

function formatDate(ts: bigint): string {
  const d = new Date(Number(ts) * 1000);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

/** Info frame for the selected bit: the facts and actions, sitting above the history. */
export function BitPanel({ bitId, events }: BitPanelProps) {
  const { address } = useAccount();
  const { bits } = useBitStates();
  const toggleTx = useToggleBit();
  const priceTx = useSetPrice();
  const buyTx = useBuyBit();

  const [newPriceEth, setNewPriceEth] = useState("");

  const bit = bits?.[bitId];
  const isOwner =
    !!address && !!bit && address.toLowerCase() === bit.owner.toLowerCase();

  const lastSale = [...events]
    .reverse()
    .find((e) => e.type === "BitBought" && e.bitId === bitId);

  const priceEth = bit ? formatEther(bit.price) : "...";
  const busy =
    toggleTx.isPending || toggleTx.isConfirming ||
    priceTx.isPending || priceTx.isConfirming ||
    buyTx.isPending || buyTx.isConfirming;
  const error = toggleTx.error ?? priceTx.error ?? buyTx.error;

  function submitPrice() {
    if (!newPriceEth) return;
    priceTx.setPrice(bitId, newPriceEth);
    setNewPriceEth("");
  }

  /** One-click buy at the owner's asking price. The contract needs a new
   *  asking price with every purchase (always-for-sale), so it carries
   *  over the price just paid; the new owner can change it afterwards. */
  function buyAtAskingPrice() {
    if (!bit) return;
    const askEth = formatEther(bit.price);
    buyTx.buy(bitId, askEth, askEth);
  }

  return (
    <div className="bit-info">
      <div className="facts">
        <p>Bit : {String(bitId).padStart(2, "0")}</p>
        <p>
          Owner :{" "}
          {bit ? (
            <ExplorerLink value={bit.owner} kind="address">
              {shortAddress(bit.owner)}
            </ExplorerLink>
          ) : (
            "..."
          )}
          {isOwner ? " (you)" : ""}
        </p>
        <p>Price : {priceEth} ETH</p>
        <p>
          Last sale :{" "}
          {lastSale?.timestamp ? formatDate(lastSale.timestamp) : "—"}
        </p>
      </div>

      <div className="actions">
        {isOwner && (
          <div className="row">
            <button onClick={() => toggleTx.toggle(bitId)} disabled={busy}>
              Toggle
            </button>
          </div>
        )}
        {address ? (
          isOwner ? (
            <div className="row">
              <input
                type="text"
                inputMode="decimal"
                placeholder="ETH"
                value={newPriceEth}
                onChange={(e) => setNewPriceEth(e.target.value)}
                aria-label="New price in ETH"
              />
              <button onClick={submitPrice} disabled={busy || !newPriceEth}>
                Set price
              </button>
            </div>
          ) : (
            <div className="row">
              <button onClick={buyAtAskingPrice} disabled={busy || !bit}>
                Buy for {priceEth} ETH
              </button>
            </div>
          )
        ) : (
          <p className="status">Login to buy or toggle</p>
        )}
        {busy && <p className="status">Waiting for transaction...</p>}
        {error && <p className="error">{(error as { shortMessage?: string }).shortMessage ?? error.message}</p>}
      </div>
    </div>
  );
}
