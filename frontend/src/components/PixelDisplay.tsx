import { usePixelColor } from "../hooks/usePixelColor";
import { colorToHex } from "../utils/color";

interface PixelDisplayProps {
  size: number;
  showLegend: boolean;
  onGrow: () => void;
  onShrink: () => void;
  onReset: () => void;
  canGrow: boolean;
  canShrink: boolean;
  showReset: boolean;
}

/** The pixel itself, centered on its stage. */
export function PixelDisplay({
  size,
  showLegend,
  onGrow,
  onShrink,
  onReset,
  canGrow,
  canShrink,
  showReset,
}: PixelDisplayProps) {
  const { data: color } = usePixelColor();
  const hex = colorToHex(Number(color ?? 0));

  return (
    <div className="stage">
      <div className="pixel-wrap">
        {showLegend && (
          <span className="callout">
            Pixel
            <span className="h-arrow" />
          </span>
        )}
        {showLegend && (
          <span className="size-buttons">
            <span className="plus-minus">
              <button
                onClick={onGrow}
                disabled={!canGrow}
                aria-label="Increase pixel size"
              >
                +
              </button>
              <button
                onClick={onShrink}
                disabled={!canShrink}
                aria-label="Decrease pixel size"
              >
                &minus;
              </button>
            </span>
            {showReset && (
              <button className="size-reset" onClick={onReset}>
                Reset
              </button>
            )}
          </span>
        )}
        <div
          className="pixel"
          style={{ width: size, height: size, background: hex }}
          title={hex}
        />
      </div>
    </div>
  );
}
