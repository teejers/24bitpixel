import { useMemo } from "react";
import { useAccount } from "wagmi";
import { useBitStates } from "../hooks/useBitStates";
import { bitContributionColor } from "../utils/color";
import { type TimelineEvent } from "../utils/timeline";

interface BitStripProps {
  /** The bit pinned by clicking (toggles off on a second click). */
  selectedBit: number | null;
  /** The bit the arrow points at: hovered bit, else the pinned one. */
  shownBit: number | null;
  onSelectBit: (bitId: number | null) => void;
  onHoverBit: (bitId: number | null) => void;
  /** When true, each bit's contribution color overlays its cell,
   *  with bit numbers, owner and last-update labels above. */
  showLegend: boolean;
  events: TimelineEvent[];
}

function formatUpdate(ts: bigint): string {
  const d = new Date(Number(ts) * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}/${p(d.getDate())}/${String(d.getFullYear()).slice(2)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Bits rendered left to right from bit 23 (R, most significant) to bit 0 (B, least). */
export const STRIP_ORDER = Array.from({ length: 24 }, (_, i) => 23 - i);

export function BitStrip({
  selectedBit,
  shownBit,
  onSelectBit,
  onHoverBit,
  showLegend,
  events,
}: BitStripProps) {
  const { bits } = useBitStates();
  const { address } = useAccount();

  // Each bit's most recent event timestamp, for the legend labels.
  const lastUpdate = useMemo(() => {
    const latest = new Map<number, bigint>();
    for (const e of events) {
      if (e.timestamp === undefined) continue;
      const current = latest.get(e.bitId);
      if (current === undefined || e.timestamp > current) {
        latest.set(e.bitId, e.timestamp);
      }
    }
    return latest;
  }, [events]);

  // Arrow under the shown cell is the only selection indicator.
  // Offset in --cell units so it tracks the responsive cell size.
  const arrowOffset =
    shownBit !== null
      ? `calc(var(--cell) * ${STRIP_ORDER.indexOf(shownBit)} + var(--cell) / 2)`
      : null;

  return (
    <div className="strip-area">
      {showLegend && (
        <div className="bit-labels">
          <div className="meta-row">
            {STRIP_ORDER.map((bitId) => {
              const owner = bits?.[bitId]?.owner;
              const mine =
                !!address &&
                !!owner &&
                owner.toLowerCase() === address.toLowerCase();
              const ts = lastUpdate.get(bitId);
              return (
                <span key={bitId} className="meta-cell">
                  {owner && (
                    <span>
                      {owner.slice(0, 10)}
                      {mine ? " [you]" : ""} &middot;{" "}
                      {ts !== undefined ? formatUpdate(ts) : "—"}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
          <div className="label-row">
            {STRIP_ORDER.map((bitId) => (
              <span key={bitId} className="label-cell">
                {String(bitId).padStart(2, "0")}
              </span>
            ))}
          </div>
        </div>
      )}
      <div
        className={`bit-strip${showLegend ? " legend-open" : ""}`}
        onMouseLeave={() => onHoverBit(null)}
      >
        {showLegend && (
          <span className="callout">
            Bits
            <span className="h-arrow" />
          </span>
        )}
        {STRIP_ORDER.map((bitId) => {
          const on = bits?.[bitId]?.state ?? false;
          const owner = bits?.[bitId]?.owner;
          const mine =
            !!address && !!owner && owner.toLowerCase() === address.toLowerCase();
          return (
            <button
              key={bitId}
              className={`bit-cell${on ? " on" : ""}`}
              onClick={() => onSelectBit(selectedBit === bitId ? null : bitId)}
              onMouseEnter={() => onHoverBit(bitId)}
              aria-label={`Bit ${bitId}${on ? " (on)" : " (off)"}${mine ? ", yours" : ""}`}
              title={`BIT ${String(bitId).padStart(2, "0")}`}
            >
              {mine && <span className="own-dot" aria-hidden />}
            </button>
          );
        })}
        {showLegend && (
          <div className="legend-overlay">
            {STRIP_ORDER.map((bitId) => (
              <div
                key={bitId}
                className="legend-swatch"
                style={{ background: bitContributionColor(bitId) }}
                title={bitContributionColor(bitId)}
              />
            ))}
          </div>
        )}
      </div>
      {arrowOffset !== null && (
        <div className="strip-arrow" style={{ marginLeft: arrowOffset }} />
      )}
    </div>
  );
}
