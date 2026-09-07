import { formatEther } from "viem";
import { type TimelineEvent, eventActor, eventPrice } from "../utils/timeline";
import { colorToHex } from "../utils/color";
import { ExplorerLink } from "./ExplorerLink";

interface HistoryProps {
  events: TimelineEvent[];
  isLoading: boolean;
  showLegend: boolean;
}

const EVENT_LABEL: Record<TimelineEvent["type"], string> = {
  BitToggled: "TOGGLE",
  BitBought: "BUY",
  PriceSet: "PRICE",
};

/** Shared column widths so the fixed header table and the scrolling
 *  body table line up exactly. */
function Columns() {
  return (
    <colgroup>
      <col style={{ width: "7%" }} />
      <col style={{ width: "24%" }} />
      <col style={{ width: "11%" }} />
      <col style={{ width: "6%" }} />
      <col style={{ width: "21%" }} />
      <col style={{ width: "14%" }} />
      <col style={{ width: "17%" }} />
    </colgroup>
  );
}

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
 *  The header is fixed; only the rows scroll. */
export function History({ events, isLoading, showLegend }: HistoryProps) {
  const sorted = [...events].sort((a, b) =>
    a.blockNumber === b.blockNumber ? 0 : a.blockNumber > b.blockNumber ? -1 : 1
  );

  // The pixel color as of each event. Only TOGGLE events carry a color, so
  // replay oldest-first and carry the latest color into BUY/PRICE rows.
  const colorAt = new Map<TimelineEvent, number>();
  let running = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const e = sorted[i];
    if (e.color !== undefined) running = e.color;
    colorAt.set(e, running);
  }

  return (
    <div className="history">
      {showLegend && (
        <span className="callout">
          Records
          <span className="h-arrow" />
        </span>
      )}
      <div className="frame">
        <div className="head">
          <table>
            <Columns />
            <thead>
              <tr>
                <th>Color</th>
                <th>Timestamp</th>
                <th>Event</th>
                <th>Bit</th>
                <th>Address</th>
                <th>Price</th>
                <th>Gas</th>
              </tr>
            </thead>
          </table>
        </div>
        <div className="scroll">
          <table>
            <Columns />
            <tbody>
              {sorted.map((e) => {
                const price = eventPrice(e);
                const actor = eventActor(e);
                return (
                  <tr key={`${e.transactionHash}-${e.type}-${e.bitId}`}>
                    <td>
                      <span
                        className="color-swatch"
                        style={{ background: colorToHex(colorAt.get(e) ?? 0) }}
                      />
                    </td>
                    <td>
                      <ExplorerLink value={e.transactionHash} kind="tx">
                        {formatTimestamp(e.timestamp)}
                      </ExplorerLink>
                    </td>
                    <td>{EVENT_LABEL[e.type]}</td>
                    <td>{String(e.bitId).padStart(2, "0")}</td>
                    <td>
                      {actor ? (
                        <ExplorerLink value={actor} kind="address">
                          {shortAddress(actor)}
                        </ExplorerLink>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{price !== undefined ? `${formatEther(price)} ETH` : "—"}</td>
                    <td>{formatGas(e.gasFee)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!isLoading && sorted.length === 0 && (
            <p className="empty">No events yet</p>
          )}
          {isLoading && <p className="empty">Loading history...</p>}
        </div>
      </div>
    </div>
  );
}
