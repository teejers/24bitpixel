import { ethers } from "hardhat";

/**
 * Phase 2 QA walkthrough — exercises every rule of the contract end-to-end
 * on the local chain with multiple wallets, asserting exact balance changes.
 * Also impersonates the user's MetaMask address so the UI can be checked
 * from an owner's point of view.
 */

const CONTRACT = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const USER_METAMASK = "0xA13FEcAa4cCaB1E6088F7Fb05528fdBdF955A56c";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name} ${detail}`);
  }
}

async function expectRevert(name: string, promise: Promise<unknown>, errorName: string) {
  try {
    await promise;
    check(name, false, `(expected ${errorName}, but call succeeded)`);
  } catch (e) {
    const msg = String(e);
    check(name, msg.includes(errorName), `(got: ${msg.slice(0, 120)})`);
  }
}

async function main() {
  const [artist, alice, bob] = await ethers.getSigners();
  const pixel = await ethers.getContractAt("TwentyFourBitPixel", CONTRACT);
  const provider = ethers.provider;

  const price001 = ethers.parseEther("0.01");
  const price002 = ethers.parseEther("0.02");

  console.log("\n== 1. First sale: bob buys bit 10 from the artist ==");
  {
    const artistBefore = await provider.getBalance(artist.address);
    const tx = await pixel.connect(bob).buyBit(10, price002, { value: price001 });
    await tx.wait();
    const artistAfter = await provider.getBalance(artist.address);

    check("bob owns bit 10", (await pixel.ownerOf(10)) === bob.address);
    check("bit 10 price is now 0.02", (await pixel.prices(10)) === price002);
    // Artist is also the seller: 95% as seller + 5% as artist = full price
    check(
      "artist received the full 0.01 (seller share + artist fee)",
      artistAfter - artistBefore === price001,
      `(delta: ${ethers.formatEther(artistAfter - artistBefore)})`
    );
  }

  console.log("\n== 2. Resale with overpayment: alice buys bit 10 from bob for 0.02, sends 0.05 ==");
  {
    const artistBefore = await provider.getBalance(artist.address);
    const bobBefore = await provider.getBalance(bob.address);
    const aliceBefore = await provider.getBalance(alice.address);

    const tx = await pixel
      .connect(alice)
      .buyBit(10, price001, { value: ethers.parseEther("0.05") });
    const receipt = await tx.wait();
    const gasCost = receipt!.gasUsed * receipt!.gasPrice;

    const fee = (price002 * 500n) / 10_000n; // 0.001
    const sellerShare = price002 - fee; // 0.019

    check("alice owns bit 10", (await pixel.ownerOf(10)) === alice.address);
    check(
      "bob (seller) received exactly 95% (0.019)",
      (await provider.getBalance(bob.address)) - bobBefore === sellerShare
    );
    check(
      "artist received exactly 5% (0.001)",
      (await provider.getBalance(artist.address)) - artistBefore === fee
    );
    check(
      "alice paid exactly 0.02 + gas (0.03 overpayment refunded)",
      aliceBefore - (await provider.getBalance(alice.address)) === price002 + gasCost
    );
  }

  console.log("\n== 3. Toggle rights ==");
  {
    const colorBefore = await pixel.getColor();
    await (await pixel.connect(alice).toggleBit(10)).wait();
    const colorAfter = await pixel.getColor();
    check(
      "owner (alice) toggled bit 10; color bit flipped",
      (colorBefore ^ colorAfter) === (1n << 10n),
      `(before ${colorBefore.toString(16)}, after ${colorAfter.toString(16)})`
    );
    await expectRevert(
      "non-owner (bob) cannot toggle bit 10",
      pixel.connect(bob).toggleBit(10),
      "NotBitOwner"
    );
    await expectRevert(
      "invalid bit id 24 rejected",
      pixel.connect(alice).toggleBit(24),
      "InvalidBitId"
    );
  }

  console.log("\n== 4. Buying edge cases ==");
  {
    await expectRevert(
      "alice cannot buy her own bit",
      pixel.connect(alice).buyBit(10, price001, { value: price001 }),
      "CannotBuyOwnBit"
    );
    await expectRevert(
      "underpayment rejected",
      pixel.connect(bob).buyBit(10, price001, { value: price001 - 1n }),
      "InsufficientPayment"
    );
    await expectRevert(
      "buyer must set a nonzero new price",
      pixel.connect(bob).buyBit(10, 0, { value: price001 }),
      "PriceMustBeNonZero"
    );
  }

  console.log("\n== 5. Pricing to hold ==");
  {
    const holdPrice = ethers.parseEther("1000000");
    await (await pixel.connect(alice).setPrice(10, holdPrice)).wait();
    check("alice set a 1,000,000 ETH hold price", (await pixel.prices(10)) === holdPrice);
    await expectRevert(
      "bob cannot afford the hold price",
      pixel.connect(bob).buyBit(10, price001, { value: price001 }),
      "InsufficientPayment"
    );
    await expectRevert(
      "price cannot be set to zero",
      pixel.connect(alice).setPrice(10, 0),
      "PriceMustBeNonZero"
    );
    await expectRevert(
      "non-owner cannot set price",
      pixel.connect(bob).setPrice(10, price001),
      "NotBitOwner"
    );
  }

  console.log("\n== 6. No back-door transfers ==");
  {
    await expectRevert(
      "transferFrom is blocked",
      pixel.connect(alice).transferFrom(alice.address, bob.address, 10),
      "TransferNotAllowed"
    );
  }

  console.log("\n== 7. User's MetaMask address buys bit 5 (impersonated for UI check) ==");
  {
    await provider.send("hardhat_impersonateAccount", [USER_METAMASK]);
    await provider.send("hardhat_setBalance", [
      USER_METAMASK,
      "0x8AC7230489E80000", // 10 ETH
    ]);
    const userSigner = await ethers.getSigner(USER_METAMASK);
    await (
      await pixel.connect(userSigner).buyBit(5, price001, { value: price001 })
    ).wait();
    await provider.send("hardhat_stopImpersonatingAccount", [USER_METAMASK]);
    check(
      "user's wallet now owns bit 5",
      (await pixel.ownerOf(5)) === ethers.getAddress(USER_METAMASK)
    );
  }

  console.log("\n== 8. Final state sanity ==");
  {
    const [owners, prices, states] = await pixel.getAllBitInfo();
    check("24 owners reported", owners.length === 24);
    check("every price is nonzero (always for sale)", prices.every((p) => p > 0n));
    const color = await pixel.getColor();
    const stateBits = states.reduce(
      (acc, s, i) => (s ? acc | (1n << BigInt(i)) : acc),
      0n
    );
    check(
      "on/off states match the pixel color exactly",
      stateBits === color,
      `(states ${stateBits.toString(16)}, color ${color.toString(16)})`
    );
  }

  console.log(`\n======== QA RESULT: ${passed} passed, ${failed} failed ========\n`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
