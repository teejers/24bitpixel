import { ethers, network } from "hardhat";

// Seeds the fresh local chain with sample activity and hands the user's
// MetaMask test ETH plus ownership of bit 5 (via an impersonated buy).
const CONTRACT = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const USER = "0xA13FEcAa4cCaB1E6088F7Fb05528fdBdF955A56c";

async function main() {
  const [deployer, alice, bob] = await ethers.getSigners();
  const pixel = await ethers.getContractAt("TwentyFourBitPixel", CONTRACT);

  // Artist (deployer) toggles a few bits on
  for (const bit of [0, 7, 12, 23]) await (await pixel.connect(deployer).toggleBit(bit)).wait();

  // Sample sales + activity from other accounts
  await (await pixel.connect(alice).buyBit(3, ethers.parseEther("0.02"), { value: ethers.parseEther("0.01") })).wait();
  await (await pixel.connect(alice).toggleBit(3)).wait();
  await (await pixel.connect(bob).buyBit(10, ethers.parseEther("0.05"), { value: ethers.parseEther("0.01") })).wait();
  await (await pixel.connect(alice).setPrice(3, ethers.parseEther("0.03"))).wait();

  // Fund the user's MetaMask and buy bit 5 as them
  await network.provider.send("hardhat_setBalance", [USER, "0x" + ethers.parseEther("10").toString(16)]);
  await network.provider.send("hardhat_impersonateAccount", [USER]);
  const user = await ethers.getSigner(USER);
  await (await pixel.connect(user).buyBit(5, ethers.parseEther("0.02"), { value: ethers.parseEther("0.01") })).wait();
  await network.provider.send("hardhat_stopImpersonatingAccount", [USER]);

  console.log("Seeded. Color:", (await pixel.getColor()).toString(16), "User owns bit 5, balance ~10 ETH");
}

main().catch((e) => { console.error(e); process.exit(1); });
