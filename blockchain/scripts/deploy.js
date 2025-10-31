const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const Contract = await hre.ethers.getContractFactory("MedicineVerification");
  const contract = await Contract.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log("MedicineVerification deployed at:", address);

  // Optional: verify if API key and network support
  const network = hre.network.name;
  if (network === "sepolia" || network === "amoy") {
    try {
      console.log("Waiting for 5 block confirmations before verification...");
      await contract.deploymentTransaction().wait(5);
      await hre.run("verify:verify", {
        address,
        constructorArguments: [],
      });
      console.log("Verified successfully.");
    } catch (err) {
      console.log("Verification skipped or failed:", err.message);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});