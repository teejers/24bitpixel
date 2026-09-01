import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import type { TwentyFourBitPixel } from "../typechain-types";

const INITIAL_PRICE = ethers.parseEther("0.01");
const NUM_BITS = 24;

describe("TwentyFourBitPixel", function () {
  async function deployFixture() {
    const [artist, alice, bob] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("TwentyFourBitPixel");
    const pixel = (await factory.deploy(INITIAL_PRICE, artist.address)) as TwentyFourBitPixel;
    await pixel.waitForDeployment();
    return { pixel, artist, alice, bob };
  }

  /** Buy bitId as `signer` at its current price, declaring `newPrice`. */
  async function buy(
    pixel: TwentyFourBitPixel,
    signer: Awaited<ReturnType<typeof ethers.getSigners>>[number],
    bitId: number,
    newPrice = INITIAL_PRICE
  ) {
    const price = await pixel.prices(bitId);
    return pixel.connect(signer).buyBit(bitId, newPrice, { value: price });
  }

  describe("Deployment", function () {
    it("mints all 24 bits to the artist", async function () {
      const { pixel, artist } = await loadFixture(deployFixture);
      for (let i = 0; i < NUM_BITS; i++) {
        expect(await pixel.ownerOf(i)).to.equal(artist.address);
      }
    });

    it("sets every bit's price to the initial price", async function () {
      const { pixel } = await loadFixture(deployFixture);
      for (let i = 0; i < NUM_BITS; i++) {
        expect(await pixel.prices(i)).to.equal(INITIAL_PRICE);
      }
    });

    it("starts with pixel color black (0x000000)", async function () {
      const { pixel } = await loadFixture(deployFixture);
      expect(await pixel.pixelColor()).to.equal(0);
      expect(await pixel.getColor()).to.equal(0);
    });

    it("records the deployer as artist", async function () {
      const { pixel, artist } = await loadFixture(deployFixture);
      expect(await pixel.artist()).to.equal(artist.address);
    });

    it("rejects a zero initial price", async function () {
      const [artist] = await ethers.getSigners();
      const factory = await ethers.getContractFactory("TwentyFourBitPixel");
      await expect(factory.deploy(0, artist.address)).to.be.revertedWithCustomError(
        factory,
        "PriceMustBeNonZero"
      );
    });

    it("rejects a zero artist address", async function () {
      const factory = await ethers.getContractFactory("TwentyFourBitPixel");
      await expect(
        factory.deploy(INITIAL_PRICE, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(factory, "ArtistAddressRequired");
    });

    it("mints to the artist even when someone else deploys", async function () {
      const [artist, alice] = await ethers.getSigners();
      const factory = await ethers.getContractFactory("TwentyFourBitPixel");
      const pixel = await factory.connect(alice).deploy(INITIAL_PRICE, artist.address);
      expect(await pixel.artist()).to.equal(artist.address);
      expect(await pixel.ownerOf(0)).to.equal(artist.address);
    });
  });

  describe("Toggle Bit", function () {
    it("owner can toggle a bit on and off", async function () {
      const { pixel } = await loadFixture(deployFixture);
      await pixel.toggleBit(0);
      expect(await pixel.pixelColor()).to.equal(1);
      await pixel.toggleBit(0);
      expect(await pixel.pixelColor()).to.equal(0);
    });

    it("toggling sets the correct bit of the color", async function () {
      const { pixel } = await loadFixture(deployFixture);
      await pixel.toggleBit(23);
      expect(await pixel.pixelColor()).to.equal(1 << 23);
      await pixel.toggleBit(8);
      expect(await pixel.pixelColor()).to.equal((1 << 23) | (1 << 8));
    });

    it("emits BitToggled with new state and color", async function () {
      const { pixel, artist } = await loadFixture(deployFixture);
      await expect(pixel.toggleBit(3))
        .to.emit(pixel, "BitToggled")
        .withArgs(3, true, 1 << 3, artist.address, anyTimestamp);
    });

    it("non-owner cannot toggle", async function () {
      const { pixel, alice } = await loadFixture(deployFixture);
      await expect(pixel.connect(alice).toggleBit(0))
        .to.be.revertedWithCustomError(pixel, "NotBitOwner")
        .withArgs(0);
    });

    it("rejects invalid bit ids", async function () {
      const { pixel } = await loadFixture(deployFixture);
      await expect(pixel.toggleBit(24))
        .to.be.revertedWithCustomError(pixel, "InvalidBitId")
        .withArgs(24);
    });

    it("new owner can toggle after buying", async function () {
      const { pixel, alice } = await loadFixture(deployFixture);
      await buy(pixel, alice, 5);
      await pixel.connect(alice).toggleBit(5);
      expect(await pixel.pixelColor()).to.equal(1 << 5);
    });
  });

  describe("Buy Bit", function () {
    it("transfers ownership at the asking price", async function () {
      const { pixel, alice } = await loadFixture(deployFixture);
      await buy(pixel, alice, 0);
      expect(await pixel.ownerOf(0)).to.equal(alice.address);
    });

    it("sets the buyer's new price", async function () {
      const { pixel, alice } = await loadFixture(deployFixture);
      const newPrice = ethers.parseEther("1");
      await pixel.connect(alice).buyBit(0, newPrice, { value: INITIAL_PRICE });
      expect(await pixel.prices(0)).to.equal(newPrice);
    });

    it("pays 5% to the artist and 95% to the seller", async function () {
      const { pixel, artist, alice, bob } = await loadFixture(deployFixture);
      await buy(pixel, alice, 0); // alice owns bit 0 at INITIAL_PRICE

      const fee = (INITIAL_PRICE * 500n) / 10_000n;
      const proceeds = INITIAL_PRICE - fee;

      await expect(buy(pixel, bob, 0)).to.changeEtherBalances(
        [bob, alice, artist],
        [-INITIAL_PRICE, proceeds, fee]
      );
    });

    it("artist selling their own bit receives proceeds plus fee", async function () {
      const { pixel, artist, alice } = await loadFixture(deployFixture);
      // Artist is the seller: gets 95% as seller + 5% as artist = full price.
      await expect(buy(pixel, alice, 0)).to.changeEtherBalances(
        [alice, artist],
        [-INITIAL_PRICE, INITIAL_PRICE]
      );
    });

    it("refunds overpayment to the buyer", async function () {
      const { pixel, alice } = await loadFixture(deployFixture);
      const overpaid = INITIAL_PRICE * 3n;
      await expect(
        pixel.connect(alice).buyBit(0, INITIAL_PRICE, { value: overpaid })
      ).to.changeEtherBalance(alice, -INITIAL_PRICE);
    });

    it("rejects underpayment", async function () {
      const { pixel, alice } = await loadFixture(deployFixture);
      await expect(
        pixel.connect(alice).buyBit(0, INITIAL_PRICE, { value: INITIAL_PRICE - 1n })
      )
        .to.be.revertedWithCustomError(pixel, "InsufficientPayment")
        .withArgs(INITIAL_PRICE, INITIAL_PRICE - 1n);
    });

    it("rejects buying your own bit", async function () {
      const { pixel, artist } = await loadFixture(deployFixture);
      await expect(
        pixel.connect(artist).buyBit(0, INITIAL_PRICE, { value: INITIAL_PRICE })
      )
        .to.be.revertedWithCustomError(pixel, "CannotBuyOwnBit")
        .withArgs(0);
    });

    it("rejects a zero new price — every bit stays for sale", async function () {
      const { pixel, alice } = await loadFixture(deployFixture);
      await expect(
        pixel.connect(alice).buyBit(0, 0, { value: INITIAL_PRICE })
      ).to.be.revertedWithCustomError(pixel, "PriceMustBeNonZero");
    });

    it("reverts if the price rose before the buy landed", async function () {
      const { pixel, alice } = await loadFixture(deployFixture);
      await pixel.setPrice(0, INITIAL_PRICE * 2n);
      await expect(
        pixel.connect(alice).buyBit(0, INITIAL_PRICE, { value: INITIAL_PRICE })
      ).to.be.revertedWithCustomError(pixel, "InsufficientPayment");
    });

    it("does not change the bit's toggle state", async function () {
      const { pixel, alice } = await loadFixture(deployFixture);
      await pixel.toggleBit(7);
      await buy(pixel, alice, 7);
      expect(await pixel.pixelColor()).to.equal(1 << 7);
    });

    it("emits BitBought with price and new price", async function () {
      const { pixel, artist, alice } = await loadFixture(deployFixture);
      const newPrice = ethers.parseEther("0.5");
      await expect(
        pixel.connect(alice).buyBit(2, newPrice, { value: INITIAL_PRICE })
      )
        .to.emit(pixel, "BitBought")
        .withArgs(2, artist.address, alice.address, INITIAL_PRICE, newPrice, anyTimestamp);
    });

    it("supports repeated resale", async function () {
      const { pixel, alice, bob } = await loadFixture(deployFixture);
      await buy(pixel, alice, 0, ethers.parseEther("0.02"));
      await buy(pixel, bob, 0, ethers.parseEther("0.03"));
      await buy(pixel, alice, 0);
      expect(await pixel.ownerOf(0)).to.equal(alice.address);
    });
  });

  describe("Set Price", function () {
    it("owner can set a new price", async function () {
      const { pixel } = await loadFixture(deployFixture);
      const newPrice = ethers.parseEther("100");
      await pixel.setPrice(0, newPrice);
      expect(await pixel.prices(0)).to.equal(newPrice);
    });

    it("emits PriceSet with old and new price", async function () {
      const { pixel, artist } = await loadFixture(deployFixture);
      const newPrice = ethers.parseEther("2");
      await expect(pixel.setPrice(1, newPrice))
        .to.emit(pixel, "PriceSet")
        .withArgs(1, INITIAL_PRICE, newPrice, artist.address, anyTimestamp);
    });

    it("non-owner cannot set price", async function () {
      const { pixel, alice } = await loadFixture(deployFixture);
      await expect(pixel.connect(alice).setPrice(0, 1n))
        .to.be.revertedWithCustomError(pixel, "NotBitOwner")
        .withArgs(0);
    });

    it("rejects a zero price", async function () {
      const { pixel } = await loadFixture(deployFixture);
      await expect(pixel.setPrice(0, 0)).to.be.revertedWithCustomError(
        pixel,
        "PriceMustBeNonZero"
      );
    });

    it("a very high price simply holds the bit — no tax, no forfeiture", async function () {
      const { pixel, alice, bob } = await loadFixture(deployFixture);
      await buy(pixel, alice, 0);
      const holdPrice = ethers.parseEther("1000000");
      await pixel.connect(alice).setPrice(0, holdPrice);

      // Bob can't afford it; alice keeps the bit indefinitely.
      await expect(
        pixel.connect(bob).buyBit(0, INITIAL_PRICE, { value: INITIAL_PRICE })
      ).to.be.revertedWithCustomError(pixel, "InsufficientPayment");
      expect(await pixel.ownerOf(0)).to.equal(alice.address);
    });
  });

  describe("Transfer Restrictions", function () {
    it("blocks transferFrom", async function () {
      const { pixel, artist, alice } = await loadFixture(deployFixture);
      await expect(
        pixel.transferFrom(artist.address, alice.address, 0)
      ).to.be.revertedWithCustomError(pixel, "TransferNotAllowed");
    });

    it("blocks safeTransferFrom", async function () {
      const { pixel, artist, alice } = await loadFixture(deployFixture);
      await expect(
        pixel["safeTransferFrom(address,address,uint256,bytes)"](
          artist.address,
          alice.address,
          0,
          "0x"
        )
      ).to.be.revertedWithCustomError(pixel, "TransferNotAllowed");
    });
  });

  describe("View Functions", function () {
    it("getAllBitInfo returns owners, prices, and states", async function () {
      const { pixel, artist, alice } = await loadFixture(deployFixture);
      await buy(pixel, alice, 3, ethers.parseEther("0.05"));
      await pixel.connect(alice).toggleBit(3);

      const [owners, prices, states] = await pixel.getAllBitInfo();
      expect(owners[3]).to.equal(alice.address);
      expect(owners[0]).to.equal(artist.address);
      expect(prices[3]).to.equal(ethers.parseEther("0.05"));
      expect(prices[0]).to.equal(INITIAL_PRICE);
      expect(states[3]).to.equal(true);
      expect(states[0]).to.equal(false);
    });

    it("getColor matches pixelColor after toggles", async function () {
      const { pixel } = await loadFixture(deployFixture);
      await pixel.toggleBit(0);
      await pixel.toggleBit(12);
      expect(await pixel.getColor()).to.equal(await pixel.pixelColor());
      expect(await pixel.getColor()).to.equal(1 | (1 << 12));
    });
  });
});

/** Matcher for any plausible block timestamp. */
function anyTimestamp(value: bigint): boolean {
  return value > 0n;
}
