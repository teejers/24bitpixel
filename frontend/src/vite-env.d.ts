/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHAIN?: string;
  readonly VITE_RPC_URL?: string;
  readonly VITE_WALLETCONNECT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
