/** Convert a uint24 color number to hex string like "#FF00AA" */
export function colorToHex(color: number): string {
  return "#" + color.toString(16).padStart(6, "0").toUpperCase();
}

/** Extract R, G, B channels from a uint24 color */
export function colorToRGB(color: number): { r: number; g: number; b: number } {
  return {
    r: (color >> 16) & 0xff,
    g: (color >> 8) & 0xff,
    b: color & 0xff,
  };
}

/** Get the bit index's channel name */
export function bitChannel(bitId: number): "R" | "G" | "B" {
  if (bitId >= 16) return "R";
  if (bitId >= 8) return "G";
  return "B";
}

/** Get the bit's position within its channel (0-7) */
export function bitPositionInChannel(bitId: number): number {
  return bitId % 8;
}

/** The color a single bit contributes: full brightness at the channel's MSB
 *  (bit 23 = rgb(255,0,0)), halving with each lower bit. */
export function bitContributionColor(bitId: number): string {
  const v = 255 >> (7 - (bitId % 8));
  if (bitId >= 16) return `rgb(${v},0,0)`;
  if (bitId >= 8) return `rgb(0,${v},0)`;
  return `rgb(0,0,${v})`;
}

/** Determine if text should be light or dark on a given background */
export function contrastColor(color: number): string {
  const { r, g, b } = colorToRGB(color);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#000000" : "#FFFFFF";
}
