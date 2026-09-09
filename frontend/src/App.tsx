import React, { useState } from "react";
import { WalletButton } from "./components/WalletButton";
import { PixelDisplay } from "./components/PixelDisplay";
import { BitStrip } from "./components/BitStrip";
import { History } from "./components/History";
import { About } from "./components/About";
import { useTimeline } from "./hooks/useTimeline";

const MIN_SIZE = 1;
const MAX_SIZE = 256;

export function App() {
  const [selectedBit, setSelectedBit] = useState<number | null>(null);
  // Hovering a bit previews it (arrow + info frame); leaving the strip
  // hides the preview again. Once a bit is pinned by clicking, hover is
  // ignored — only clicking another bit (or clicking away) changes it.
  const [hoveredBit, setHoveredBit] = useState<number | null>(null);
  const shownBit = selectedBit ?? hoveredBit;
  const [pixelSize, setPixelSize] = useState(MIN_SIZE);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const { events, isLoading } = useTimeline();

  // Clicking anywhere dismisses the legend (except the ? itself, which
  // toggles it, and the +/- size buttons). Clicks outside a bit cell or the
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
          onGrow={() => setPixelSize((s) => Math.min(s * 2, MAX_SIZE))}
          onShrink={() => setPixelSize((s) => Math.max(Math.floor(s / 2), MIN_SIZE))}
          canGrow={pixelSize < MAX_SIZE}
          canShrink={pixelSize > MIN_SIZE}
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
