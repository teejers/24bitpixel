import { CONTRACT_ADDRESS, EXPLORER_URL } from "../constants";
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
        <h2>24 bit pixel by CW&amp;T</h2>
        <p>
          There&rsquo;s something uniquely satisfying about anchoring a thing
          you don&rsquo;t understand into a framing you do. In doing this, you
          may render a new something that is weird and maybe dumb and maybe
          useless. But if doing that helps give the world a more personal, or
          meaningful shape, then why not?
        </p>
        <p>
          Years ago I came across an article that spoke about the blockchain
          in terms of its Turing completeness. Before then, I had a hard time
          understanding what blockchain was, or why it seemed to make so many
          people so excited. When I finally saw it as a really bad, really
          slow computer, I got excited too.
        </p>
        <p>
          24 bit pixel is a single pixel represented as 24 bits stored on
          the Ethereum Blockchain.
        </p>
        <p>
          The pixel&rsquo;s color is a 24-bit RGB value. 8 bits for red, 8 for
          green and 8 for blue. Each bit is a token anyone can own. Only the
          owner can toggle the bit&rsquo;s value to 1(ON/WHITE) or 0(OFF/BLACK),
          altering the color of the single pixel, and set its sale price.
        </p>
        <p>
          All bits are equal, but in relation to the pixel, some bits are
          more equal than others.
        </p>
        <p>
          Contract:{" "}
          <ExplorerLink value={CONTRACT_ADDRESS} kind="address">
            {CONTRACT_ADDRESS}
          </ExplorerLink>
          {EXPLORER_URL && (
            <>
              {" "}
              (
              <a
                href={`${EXPLORER_URL}/address/${CONTRACT_ADDRESS}#code`}
                target="_blank"
                rel="noreferrer"
                className="explorer-link"
              >
                verified source code
              </a>
              )
            </>
          )}
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
