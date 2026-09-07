import { useAccount } from "wagmi";
import { useBitStates } from "../hooks/useBitStates";
import { bitContributionColor } from "../utils/color";

interface BitStripProps {
  /** The bit pinned by clicking (toggles off on a second click). */
  selectedBit: number | null;
  /** The bit the arrow points at: hovered bit, else the pinned one. */
  shownBit: number | null;
  onSelectBit: (bitId: number | null) => void;
  onHoverBit: (bitId: number | null) => void;
  /** When true, each bit's contribution color overlays its cell,
   *  with bit numbers and channel labels above. */
  showLegend: boolean;
}

/** Bits rendered left to right from bit 23 (R, most significant) to bit 0 (B, least). */
export const STRIP_ORDER = Array.from({ length: 24 }, (_, i) => 23 - i);

export function BitStrip({
  selectedBit,
  shownBit,
  onSelectBit,
  onHoverBit,
  showLegend,
}: BitStripProps) {
  const { bits } = useBitStates();
  const { address } = useAccount();

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
          <div className="label-row">
            {STRIP_ORDER.map((bitId) => (
              <span key={bitId} className="label-cell">
                {String(bitId).padStart(2, "0")}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="bit-strip" onMouseLeave={() => onHoverBit(null)}>
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
