import React, { useEffect, useState } from "react";
import { WalletButton } from "./components/WalletButton";
import { PixelDisplay } from "./components/PixelDisplay";
import { BitStrip } from "./components/BitStrip";
import { History } from "./components/History";
import { About } from "./components/About";
import { useTimeline } from "./hooks/useTimeline";

export function App() {
  const [selectedBit, setSelectedBit] = useState<number | null>(null);
  // Hovering a bit previews it (arrow + info frame); leaving the strip
  // hides the preview again. Once a bit is pinned by clicking, hover is
  // ignored — only clicking another bit (or clicking away) changes it.
  const [hoveredBit, setHoveredBit] = useState<number | null>(null);
  const shownBit = selectedBit ?? hoveredBit;
  const [pixelSize, setPixelSize] = useState(1);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  // The PIXEL arrow greets the visitor on load; it fades on the first
  // mouse move, or after 2s if the mouse never moves
  const [pixelHint, setPixelHint] = useState(true);
  const { events, isLoading } = useTimeline();

  useEffect(() => {
    const hide = () => setPixelHint(false);
    const t = setTimeout(hide, 2000);
    window.addEventListener("mousemove", hide, { once: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener("mousemove", hide);
    };
  }, []);

  // Clicking anywhere dismisses the legend (except the ? itself, which
  // toggles it, and the size slider). Clicks outside a bit cell or the
  // info frame also dismiss the bit info.
  function handleBackgroundClick(e: React.MouseEvent) {
    const el = e.target as HTMLElement;
    if (!el.closest(".legend-toggle") && !el.closest(".size-buttons")) {
      setLegendOpen(false);
    }
    if (
      el.closest(".bit-cell") ||
      el.closest(".bit-actions") ||
      el.closest(".bit-labels")
    )
      return;
    setSelectedBit(null);
  }

  return (
    <div className="app" onClick={handleBackgroundClick}>
      <header className="topbar">
        <span>CW&amp;T 24 bit pixel</span>
        <button
          className={`legend-toggle${legendOpen ? " active" : ""}`}
          onClick={() => setLegendOpen((open) => !open)}
          aria-label="Toggle bit color legend"
        >
          ?
        </button>
        <nav>
          <button onClick={() => setAboutOpen((open) => !open)}>About</button>
          <WalletButton />
        </nav>
      </header>

      <main>
        <PixelDisplay
          size={pixelSize}
          showLegend={legendOpen}
          showPixelHint={pixelHint}
          onSetSize={setPixelSize}
        />

        <BitStrip
          selectedBit={selectedBit}
          shownBit={shownBit}
          onSelectBit={setSelectedBit}
          onHoverBit={setHoveredBit}
          showLegend={legendOpen}
          events={events}
        />

        <div className="lower">
          <div className="history-center">
            <History events={events} isLoading={isLoading} />
          </div>
        </div>
      </main>

      {aboutOpen && <About onClose={() => setAboutOpen(false)} />}
    </div>
  );
}
