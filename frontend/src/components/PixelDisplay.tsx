import { usePixelColor } from "../hooks/usePixelColor";
import { colorToHex } from "../utils/color";

interface PixelDisplayProps {
  size: number;
}

/** The pixel itself, centered on a fixed stage. */
export function PixelDisplay({ size }: PixelDisplayProps) {
  const { data: color } = usePixelColor();
  const hex = colorToHex(Number(color ?? 0));

  return (
    <div className="stage">
      <div
        className="pixel"
        style={{ width: size, height: size, background: hex }}
        title={hex}
      />
    </div>
  );
}
