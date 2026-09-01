import { formatEther } from "viem";
import { type TimelineEvent, eventActor, eventPrice } from "../utils/timeline";
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

/** Scrollable table of everything that has ever happened to the pixel, newest first. */
export function History({ events, isLoading }: HistoryProps) {
  const sorted = [...events].sort((a, b) =>
    a.blockNumber === b.blockNumber ? 0 : a.blockNumber > b.blockNumber ? -1 : 1
  );

  return (
    <div className="history">
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Event</th>
              <th>Bit</th>
              <th>Address</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((e) => {
              const price = eventPrice(e);
              const actor = eventActor(e);
              return (
                <tr key={`${e.transactionHash}-${e.type}-${e.bitId}`}>
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
  );
}
