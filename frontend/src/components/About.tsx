import { CONTRACT_ADDRESS } from "../constants";
import { ExplorerLink } from "./ExplorerLink";

interface AboutProps {
  onClose: () => void;
}

/** Overlay panel toggled by the ABOUT link; clicking outside the frame closes it. */
export function About({ onClose }: AboutProps) {
  return (
    <div
      className="about-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section className="about">
        <h2>About</h2>
        <p>
          24 bit pixel is a single pixel. Its color is a 24-bit RGB value —
          eight bits of red, eight of green, eight of blue — stored on the
          Ethereum blockchain. Each of the 24 bits is a token that anyone can
          own.
        </p>
        <p>The rules, in full:</p>
        <ol>
          <li>Every bit always has an owner and an owner-set price.</li>
          <li>
            Anyone may buy any bit by paying its price. The buyer sets a new
            price at purchase.
          </li>
          <li>On each sale, 5% goes to the artist and 95% to the seller.</li>
          <li>Only a bit&apos;s owner can toggle it on or off.</li>
          <li>
            Bits cannot change hands any other way — every change of ownership
            is a public, priced sale, recorded in the history.
          </li>
        </ol>
        <p>
          A project by CW&amp;T. Contract:{" "}
          <ExplorerLink value={CONTRACT_ADDRESS} kind="address">
            {CONTRACT_ADDRESS}
          </ExplorerLink>
        </p>
      </section>
    </div>
  );
}
