import { usePixelColor } from "../hooks/usePixelColor";
import { colorToHex } from "../utils/color";

// Slider positions map to pixel sizes 2^0 .. 2^8 (1px .. 256px)
const MIN_EXP = 0;
const MAX_EXP = 8;

interface PixelDisplayProps {
  size: number;
  showLegend: boolean;
  onSetSize: (px: number) => void;
}

/** The pixel itself, centered on its stage. */
export function PixelDisplay({ size, showLegend, onSetSize }: PixelDisplayProps) {
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
            <input
              type="range"
              className="size-slider"
              min={MIN_EXP}
              max={MAX_EXP}
              step={1}
              value={Math.round(Math.log2(size))}
              onChange={(e) => onSetSize(2 ** Number(e.target.value))}
              aria-label="Pixel size"
            />
            {size !== 2 ** MIN_EXP && (
              <button
                className="size-reset"
                onClick={() => onSetSize(2 ** MIN_EXP)}
              >
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
