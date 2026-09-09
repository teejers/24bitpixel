import { CONTRACT_ADDRESS } from "../constants";
import { ExplorerLink } from "./ExplorerLink";

interface AboutProps {
  onClose: () => void;
}

/** Overlay panel toggled by the ABOUT link; the X or clicking outside the frame closes it. */
export function About({ onClose }: AboutProps) {
  return (
    <div
      className="about-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section className="about">
        <button className="about-close" onClick={onClose} aria-label="Close">
          &times;
        </button>
        <div className="about-body">
        <h2>24 bit pixel</h2>
        <p>
          A single pixel is represented as 24 bits stored on the Ethereum
          Blockchain.
        </p>
        <p>
          The pixel&rsquo;s color is a 24-bit RGB value. 8 bits for red, 8 for
          green and 8 for blue. Each bit is a token anyone can own. Only the
          owner can toggle the bit&rsquo;s value to 1(ON/WHITE) or 0(OFF/BLACK),
          altering the color of the single pixel.
        </p>
        <p>
          Years ago I came across an article that spoke about the blockchain
          in terms of its Turing Completeness. Before then, I had a hard time
          understanding what blockchain was, or really why it seemingly made
          so many people so excited. When I saw it as a really bad, really
          slow computer, I got excited too.
        </p>
        <p>I happen to love really bad, really slow computers.</p>
        <p>This is a project by CW&amp;T.</p>
        <p>
          Contract:{" "}
          <ExplorerLink value={CONTRACT_ADDRESS} kind="address">
            {CONTRACT_ADDRESS}
          </ExplorerLink>
        </p>
        <p>Rules :</p>
        <ol>
          <li>Every bit always has an owner.</li>
          <li>The owner can toggle a bit on or off.</li>
          <li>The owner sets the bit&rsquo;s sale price.</li>
          <li>Anyone may buy any bit by paying its price.</li>
          <li>
            When a bit is sold, 5% of the sale goes to the artist and 95% to
            the seller.
          </li>
          <li>
            Bits cannot change hands or state in any other way
            (trades/donations/etc.).
          </li>
          <li>
            Every change of ownership is a public, priced sale, in the
            recorded history.
          </li>
        </ol>
        </div>
      </section>
    </div>
  );
}
