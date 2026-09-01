import { ConnectButton } from "@rainbow-me/rainbowkit";

/** Plain-text wallet control styled like the top bar's nav links. */
export function WalletButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, openAccountModal, openChainModal, mounted }) => {
        if (!mounted) return null;
        if (!account || !chain) {
          return <button onClick={openConnectModal}>Login</button>;
        }
        if (chain.unsupported) {
          return <button onClick={openChainModal}>Wrong network</button>;
        }
        return (
          <button onClick={openAccountModal}>{account.displayName}</button>
        );
      }}
    </ConnectButton.Custom>
  );
}
