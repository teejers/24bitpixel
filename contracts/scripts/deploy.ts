import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying TwentyFourBitPixel with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // Every bit starts owned by the artist at this price.
  const initialPrice = ethers.parseEther(process.env.INITIAL_PRICE_ETH ?? "0.01");

  // The artist wallet receives the 5% fee on every sale and initially owns
  // all 24 bits. Defaults to the deployer; override with ARTIST_ADDRESS.
  const artist = process.env.ARTIST_ADDRESS ?? deployer.address;
  console.log("Artist (fee recipient + initial owner):", artist);

  const factory = await ethers.getContractFactory("TwentyFourBitPixel");
  const pixel = await factory.deploy(initialPrice, artist);
  await pixel.waitForDeployment();

  const address = await pixel.getAddress();
  const receipt = await pixel.deploymentTransaction()?.wait();
  const deployBlock = receipt?.blockNumber ?? 0;
  console.log("TwentyFourBitPixel deployed to:", address, "at block", deployBlock);

  // Save deployment info
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deployment = {
    address,
    network: network.name,
    deployer: deployer.address,
    artist,
    initialPrice: initialPrice.toString(),
    deployBlock,
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(deploymentsDir, `${network.name}.json`),
    JSON.stringify(deployment, null, 2)
  );

  console.log(`Deployment info saved to deployments/${network.name}.json`);

  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\nTo verify on Etherscan:");
    console.log(`npx hardhat verify --network ${network.name} ${address} ${initialPrice} ${artist}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
