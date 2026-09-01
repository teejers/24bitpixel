import { useBitStates } from "../hooks/useBitStates";
import { bitChannel, bitPositionInChannel, bitContributionColor } from "../utils/color";

interface BitStripProps {
  selectedBit: number | null;
  onSelectBit: (bitId: number | null) => void;
}

/** Bits rendered left to right from bit 23 (R, most significant) to bit 0 (B, least). */
export const STRIP_ORDER = Array.from({ length: 24 }, (_, i) => 23 - i);

export function BitStrip({ selectedBit, onSelectBit }: BitStripProps) {
  const { bits } = useBitStates();

  // Arrow under the selected cell is the only selection indicator.
  // Offset in --cell units so it tracks the responsive cell size.
  const arrowOffset =
    selectedBit !== null
      ? `calc(var(--cell) * ${STRIP_ORDER.indexOf(selectedBit)} + var(--cell) / 2)`
      : null;

  return (
    <div className="strip-area">
      {selectedBit !== null && (
        <div className="bit-labels">
          <div className="label-row">
            <span className="row-caption">Bit :</span>
            {STRIP_ORDER.map((bitId) => (
              <span key={bitId} className="label-cell">
                {String(bitId).padStart(2, "0")}
              </span>
            ))}
          </div>
          <div className="label-row">
            {STRIP_ORDER.map((bitId) => (
              <span key={bitId} className="label-cell">
                {bitChannel(bitId)}
                {bitPositionInChannel(bitId)}
              </span>
            ))}
          </div>
          <div className="swatch-row">
            {STRIP_ORDER.map((bitId) => (
              <div
                key={bitId}
                className="swatch"
                style={{ background: bitContributionColor(bitId) }}
                title={bitContributionColor(bitId)}
              />
            ))}
          </div>
        </div>
      )}
      <div className="bit-strip">
        {STRIP_ORDER.map((bitId) => {
          const on = bits?.[bitId]?.state ?? false;
          return (
            <button
              key={bitId}
              className={`bit-cell${on ? " on" : ""}`}
              onClick={() => onSelectBit(selectedBit === bitId ? null : bitId)}
              aria-label={`Bit ${bitId}${on ? " (on)" : " (off)"}`}
              title={`BIT ${String(bitId).padStart(2, "0")}`}
            />
          );
        })}
      </div>
      {arrowOffset !== null && (
        <div className="strip-arrow" style={{ marginLeft: arrowOffset }} />
      )}
    </div>
  );
}
