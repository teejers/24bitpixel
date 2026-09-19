/**
 * Refreshes src/data/history.<chain>.json: every contract event from the
 * deploy block through a recent block, with gas fees, for the build to
 * bake in. The browser then only fetches the tail since that block, which
 * keeps it inside the small eth_getLogs windows free RPCs allow, and
 * skips a receipt lookup per event on every visit.
 *
 *   npx tsx scripts/snapshot-history.ts mainnet|sepolia
 *
 * Incremental: only blocks after the committed snapshot are fetched.
 * Never fails the build — on any error the committed file stands.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, fallback, http } from "viem";
import { mainnet, sepolia } from "viem/chains";
import deployments from "../src/config/deployments.json";
import { rpcUrlsFor, type ChainName } from "../src/utils/rpc";
import {
  type HistorySnapshot,
  deserializeEvent,
  fetchEvents,
  fetchGasFees,
  serializeEvent,
} from "../src/utils/history";

/** Blocks behind the head the snapshot stops at, so a reorg can't bake in
 *  an event that later vanishes. */
const SAFETY_BLOCKS = 32n;
/** Passes over the receipts before giving up. */
const RECEIPT_ATTEMPTS = 4;

const CHAINS = { mainnet, sepolia } as const;

const name = (process.argv[2] ?? process.env.VITE_CHAIN ?? "mainnet") as ChainName;
const here = dirname(fileURLToPath(import.meta.url));
const file = join(here, "..", "src", "data", `history.${name}.json`);

function log(msg: string) {
  console.log(`[snapshot ${name}] ${msg}`);
}

async function main() {
  if (!(name in CHAINS)) {
    log("no snapshot for this chain; skipping");
    return;
  }
  const chain = CHAINS[name as keyof typeof CHAINS];
  const dep = deployments[name];
  const address = dep.address as `0x${string}`;

  let existing: HistorySnapshot | null = null;
  if (existsSync(file)) {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as HistorySnapshot;
    if (parsed.chainId === chain.id && parsed.address.toLowerCase() === address.toLowerCase()) {
      existing = parsed;
    } else {
      log("committed snapshot is for another contract; starting over");
    }
  }

  const urls = rpcUrlsFor(name, process.env.VITE_RPC_URL);
  // Logs: one client that falls through the endpoints on any error.
  const client = createPublicClient({
    chain,
    transport: fallback(
      urls.map((u) => http(u, { retryCount: 1 })),
      { retryCount: 0 }
    ),
  });
  // Receipts: one client per endpoint, asked in turn (see fetchGasFees).
  const receiptClients = urls.map((u) =>
    createPublicClient({ chain, transport: http(u, { retryCount: 1 }) })
  );

  const head = await client.getBlockNumber();
  const toBlock = head - SAFETY_BLOCKS;
  const fromBlock = existing ? BigInt(existing.toBlock) + 1n : BigInt(dep.deployBlock);
  if (fromBlock > toBlock) {
    log(`up to date through block ${existing?.toBlock}`);
    return;
  }

  log(`fetching blocks ${fromBlock}..${toBlock} (${toBlock - fromBlock + 1n} blocks)`);
  const fresh = await fetchEvents(client, address, fromBlock, toBlock);
  // Receipts, retried a few times: public endpoints rate-limit bursts.
  const fees = new Map<string, bigint>();
  let pending = [...new Set(fresh.map((e) => e.transactionHash))];
  for (let attempt = 1; pending.length > 0; attempt++) {
    const r = await fetchGasFees(receiptClients, pending);
    for (const [h, fee] of r.fees) fees.set(h, fee);
    pending = pending.filter((h) => !fees.has(h));
    if (pending.length === 0) break;
    if (attempt === RECEIPT_ATTEMPTS) {
      throw new Error(`${pending.length} receipt(s) could not be fetched: ${r.lastError}`);
    }
    log(`${pending.length} receipt(s) failed (${r.lastError}); retrying`);
    await new Promise((res) => setTimeout(res, 2_000 * attempt));
  }
  for (const e of fresh) e.gasFee = fees.get(e.transactionHash);

  const events = [...(existing?.events ?? []).map(deserializeEvent), ...fresh].sort(
    (a, b) =>
      a.blockNumber === b.blockNumber
        ? a.logIndex - b.logIndex
        : a.blockNumber < b.blockNumber
          ? -1
          : 1
  );

  const snapshot: HistorySnapshot = {
    chainId: chain.id,
    address,
    toBlock: toBlock.toString(),
    takenAt: new Date().toISOString(),
    events: events.map(serializeEvent),
  };
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(snapshot, null, 2) + "\n");
  log(`${fresh.length} new event(s), ${events.length} total, through block ${toBlock}`);
}

main().catch((err: Error & { shortMessage?: string }) => {
  log(`could not refresh, keeping the committed file: ${err.shortMessage ?? err.message}`);
  process.exit(0);
});
