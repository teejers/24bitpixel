import { usePixelColor } from "../hooks/usePixelColor";
import { colorToHex } from "../utils/color";

interface PixelDisplayProps {
  size: number;
  showLegend: boolean;
}

/** The pixel itself, centered on its stage. */
export function PixelDisplay({ size, showLegend }: PixelDisplayProps) {
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
        <div
          className="pixel"
          style={{ width: size, height: size, background: hex }}
          title={hex}
        />
      </div>
    </div>
  );
}
