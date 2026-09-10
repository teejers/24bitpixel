import { Fragment, useEffect, useRef } from "react";
import { formatEther } from "viem";
import { type TimelineEvent, eventActor, eventPrice } from "../utils/timeline";
import { colorToHex } from "../utils/color";
import { ExplorerLink } from "./ExplorerLink";

interface HistoryProps {
  events: TimelineEvent[];
  isLoading: boolean;
}

const EVENT_LABEL: Record<TimelineEvent["type"], string> = {
  BitToggled: "TOGGLE",
  BitBought: "BUY",
  PriceSet: "PRICE",
};

function formatTimestamp(ts?: bigint): string {
  if (!ts) return "—";
  const d = new Date(Number(ts) * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}/${p(d.getDate())}/${String(d.getFullYear()).slice(2)} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function shortAddress(addr?: string): string {
  return addr ? `${addr.slice(0, 12)}` : "—";
}

/** Gas fees are tiny fractions of an ETH — show up to 6 decimals, trimmed. */
function formatGas(fee?: bigint): string {
  if (fee === undefined) return "—";
  const eth = Number(formatEther(fee))
    .toFixed(6)
    .replace(/0+$/, "")
    .replace(/\.$/, "");
  return `${eth} ETH`;
}

/** Everything that has ever happened to the pixel, newest first.
 *  A grid: columns size to their content, the leftover width becomes
 *  equal gaps between them. The RECORDS label is the first column. */
/** Must match the .grid top padding in index.css (desktop and mobile). */
const GRID_PAD_TOP = 8;
/** Breathing room between the top bar and the pinned header — matches
 *  the 6px between the header and its rule below. */
const HEADER_TOP_GAP = 6;

export function History({ events, isLoading }: HistoryProps) {
  const gridRef = useRef<HTMLDivElement>(null);

  // Feed the page scroll into --freeze: how far past the pin line (the
  // top bar's bottom edge) the header's natural spot has risen. CSS
  // translates the header (and its paper backdrop) down by this much
  // and clips rows above it, so the records ride up over the scene and
  // the header holds just under the black bar.
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const update = () => {
      const bar = document.querySelector(".topbar");
      if (!bar) return;
      const target = bar.getBoundingClientRect().bottom + HEADER_TOP_GAP;
      const off = Math.max(
        0,
        Math.round(target - grid.getBoundingClientRect().top - GRID_PAD_TOP)
      );
      grid.style.setProperty("--freeze", `${off}px`);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const sorted = [...events].sort((a, b) =>
    a.blockNumber === b.blockNumber ? 0 : a.blockNumber > b.blockNumber ? -1 : 1
  );

  // The pixel color as of each event. Only TOGGLE events carry a color, so
  // replay oldest-first and carry the latest color into BUY/PRICE rows.
  const colorAt = new Map<TimelineEvent, number>();
  let running = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const e = sorted[i]!;
    if (e.color !== undefined) running = e.color;
    colorAt.set(e, running);
  }

  return (
    <div className="history">
      <div className="frame">
        <div className="grid" ref={gridRef}>
          {/* Absolutely positioned (skips grid placement): the paper band
              behind the frozen header that rows disappear under */}
          <span className="head-cover" />
          <span className="th color-col">Color</span>
          <span className="th">Timestamp</span>
          <span className="th">Event</span>
          <span className="th">Bit</span>
          <span className="th">Address</span>
          <span className="th">Price</span>
          <span className="th gas-col">Gas</span>
          <span className="rule" />
          {sorted.map((e) => {
            const price = eventPrice(e);
            const actor = eventActor(e);
            return (
              <Fragment key={`${e.transactionHash}-${e.type}-${e.bitId}`}>
                <span className="color-col">
                  <span
                    className="color-swatch"
                    style={{ background: colorToHex(colorAt.get(e) ?? 0) }}
                  />
                  <span className="color-binary">
                    {(colorAt.get(e) ?? 0).toString(2).padStart(24, "0")}
                  </span>
                </span>
                <span>
                  <ExplorerLink value={e.transactionHash} kind="tx">
                    {formatTimestamp(e.timestamp)}
                  </ExplorerLink>
                </span>
                <span>{EVENT_LABEL[e.type]}</span>
                <span>{String(e.bitId).padStart(2, "0")}</span>
                <span>
                  {actor ? (
                    <ExplorerLink value={actor} kind="address">
                      {shortAddress(actor)}
                    </ExplorerLink>
                  ) : (
                    "—"
                  )}
                </span>
                <span>{price !== undefined ? `${formatEther(price)} ETH` : "—"}</span>
                <span>{formatGas(e.gasFee)}</span>
              </Fragment>
            );
          })}
        </div>
        {!isLoading && sorted.length === 0 && (
          <p className="empty">No events yet</p>
        )}
        {isLoading && <p className="empty">Loading history...</p>}
      </div>
    </div>
  );
}
