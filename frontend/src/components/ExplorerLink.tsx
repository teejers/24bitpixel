import { EXPLORER_URL } from "../constants";

interface ExplorerLinkProps {
  /** Address or transaction hash to link to */
  value: string;
  kind: "address" | "tx";
  children: React.ReactNode;
}

/** Links to the block explorer (Etherscan) when the chain has one;
 *  renders plain text on local chains that don't. */
export function ExplorerLink({ value, kind, children }: ExplorerLinkProps) {
  if (!EXPLORER_URL) return <>{children}</>;
  return (
    <a
      href={`${EXPLORER_URL}/${kind}/${value}`}
      target="_blank"
      rel="noreferrer"
      className="explorer-link"
    >
      {children}
    </a>
  );
}
