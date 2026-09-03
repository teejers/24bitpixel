import React, { useState } from "react";
import { WalletButton } from "./components/WalletButton";
import { PixelDisplay } from "./components/PixelDisplay";
import { BitStrip } from "./components/BitStrip";
import { BitPanel } from "./components/BitPanel";
import { History } from "./components/History";
import { About } from "./components/About";
import { useTimeline } from "./hooks/useTimeline";

const MIN_SIZE = 1;
const MAX_SIZE = 256;

export function App() {
  const [selectedBit, setSelectedBit] = useState<number | null>(null);
  const [pixelSize, setPixelSize] = useState(MIN_SIZE);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const { events, isLoading } = useTimeline();

  // Clicking anywhere that isn't a bit cell (or inside the info frame itself)
  // dismisses the bit info.
  function handleBackgroundClick(e: React.MouseEvent) {
    const el = e.target as HTMLElement;
    if (
      el.closest(".bit-cell") ||
      el.closest(".bit-info") ||
      el.closest(".bit-labels") ||
      el.closest(".legend-toggle")
    )
      return;
    setSelectedBit(null);
  }

  return (
    <div className="app" onClick={handleBackgroundClick}>
      <header className="topbar">
        <span>CW&amp;T 24 bit pixel</span>
        <div className="size-buttons">
          <button
            onClick={() => setPixelSize((s) => Math.min(s * 2, MAX_SIZE))}
            disabled={pixelSize >= MAX_SIZE}
            aria-label="Increase pixel size"
          >
            +
          </button>
          <button
            onClick={() => setPixelSize((s) => Math.max(Math.floor(s / 2), MIN_SIZE))}
            disabled={pixelSize <= MIN_SIZE}
            aria-label="Decrease pixel size"
          >
            &minus;
          </button>
        </div>
        <nav>
          <button onClick={() => setAboutOpen((open) => !open)}>About</button>
          <WalletButton />
        </nav>
      </header>

      <button
        className="legend-toggle"
        onClick={() => setLegendOpen((open) => !open)}
        aria-label="Toggle bit color legend"
      >
        ?
      </button>

      <main>
        <PixelDisplay size={pixelSize} />

        <BitStrip
          selectedBit={selectedBit}
          onSelectBit={setSelectedBit}
          showLegend={legendOpen}
        />

        {selectedBit !== null && <BitPanel bitId={selectedBit} events={events} />}

        <History events={events} isLoading={isLoading} />
      </main>

      {aboutOpen && <About onClose={() => setAboutOpen(false)} />}
    </div>
  );
}
