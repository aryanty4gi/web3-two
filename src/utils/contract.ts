import { ethers } from "ethers";
import abi from "../contracts/abi/MedicineVerification.json";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as string | undefined;

export function getProvider() {
  if (typeof window !== "undefined" && (window as any).ethereum) {
    return new ethers.providers.Web3Provider((window as any).ethereum);
  }
  throw new Error("No wallet provider found. Please install MetaMask.");
}

export async function getSigner() {
  const provider = getProvider();
  await provider.send("eth_requestAccounts", []);
  return provider.getSigner();
}

export async function getAddress() {
  const signer = await getSigner();
  return await signer.getAddress();
}

export function getContract(signerOrProvider?: ethers.Signer | ethers.providers.Provider) {
  if (!CONTRACT_ADDRESS) {
    throw new Error("NEXT_PUBLIC_CONTRACT_ADDRESS is not set");
  }
  const provider = signerOrProvider ?? getProvider();
  return new ethers.Contract(CONTRACT_ADDRESS, abi, provider);
}

// Compose a simple batchId string from fields (keccak256(batchId) stored on-chain)
export function computeBatchIdFromFields(
  batchNumber: string,
  manufacturerName: string,
  productionDate: number
) {
  return `${manufacturerName}|${batchNumber}|${productionDate}`;
}

async function uploadToIPFS(payload: any): Promise<string> {
  const jwt = process.env.NEXT_PUBLIC_PINATA_JWT as string | undefined;
  if (!jwt) {
    throw new Error("Missing NEXT_PUBLIC_PINATA_JWT for IPFS upload (Pinata). Set this env var.");
  }
  const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ pinataContent: payload }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`IPFS upload failed: ${text}`);
  }
  const json = await res.json();
  // Pinata returns IpfsHash
  return json.IpfsHash as string;
}

async function fetchIPFSJson(cid: string): Promise<any> {
  // Use public gateway; in production, prefer a dedicated gateway or backend proxy.
  const res = await fetch(`https://ipfs.io/ipfs/${cid}`);
  if (!res.ok) throw new Error("Failed to fetch IPFS content");
  return await res.json();
}

export async function verifyBatch(
  batchNumber: string,
  manufacturerName: string,
  productionDate: number
) {
  const signer = await getSigner();
  const contract = getContract(signer);
  const batchId = computeBatchIdFromFields(batchNumber, manufacturerName, productionDate);
  const result = await contract.verifyBatch(batchId);
  const [isAuthentic, ipfsCid, registeredAt, manufacturerAddr, verificationCount] = result as [boolean, string, ethers.BigNumber, string, ethers.BigNumber];
  let offchain: any = {};
  try {
    if (ipfsCid) {
      offchain = await fetchIPFSJson(ipfsCid);
    }
  } catch {
    offchain = {};
  }
  const details = {
    manufacturer: offchain.manufacturer ?? manufacturerName,
    productName: offchain.productName ?? "",
    productionDate: offchain.productionDate ?? productionDate,
    expiryDate: offchain.expiryDate ?? 0,
    batchNumber: offchain.batchNumber ?? batchNumber,
    verificationCount: Number(verificationCount),
    isRegistered: Boolean(isAuthentic),
  };
  const nowSec = Math.floor(Date.now() / 1000);
  const expired = Number(details.expiryDate) > 0 && Number(details.expiryDate) < nowSec;
  const matches = (
    details.manufacturer === manufacturerName &&
    details.batchNumber === batchNumber &&
    Number(details.productionDate) === Number(productionDate)
  );
  const checkpoints: string[] = Array.isArray(offchain.distributionPath) ? offchain.distributionPath : [];
  return { isAuthentic, matches, expired, details, checkpoints };
}

export async function registerBatch(data: {
  manufacturer: string; // human-readable (stored off-chain)
  productName: string;
  productionDate: number;
  expiryDate: number;
  batchNumber: string;
}) {
  const signer = await getSigner();
  const manufacturerAddr = await getAddress();
  const contract = getContract(signer);
  const offchainPayload = {
    manufacturer: data.manufacturer,
    productName: data.productName,
    productionDate: data.productionDate,
    expiryDate: data.expiryDate,
    batchNumber: data.batchNumber,
    distributionPath: [],
  };
  const cid = await uploadToIPFS(offchainPayload);
  const batchId = computeBatchIdFromFields(data.batchNumber, data.manufacturer, data.productionDate);
  const tx = await contract.registerMedicineBatch(batchId, manufacturerAddr, data.productionDate, cid);
  const receipt = await tx.wait();
  return { receipt, cid };
}

export async function authorizeManufacturer(address: string) {
  const signer = await getSigner();
  const contract = getContract(signer);
  const tx = await contract.authorizeManufacturer(address);
  return await tx.wait();
}

export async function isAuthorizedManufacturer(address: string) {
  const contract = getContract();
  // Assume a public mapping authorizedManufacturers(address) exists; if not, adjust to contract.isAuthorizedManufacturer
  try {
    const res: boolean = await (contract as any).authorizedManufacturers(address);
    return Boolean(res);
  } catch {
    if (typeof (contract as any).isAuthorizedManufacturer === "function") {
      const res: boolean = await (contract as any).isAuthorizedManufacturer(address);
      return Boolean(res);
    }
    throw new Error("Contract does not expose manufacturer authorization status");
  }
}

// Supply chain checkpoints are stored off-chain in this model.
export async function addSupplyChainCheckpoint() {
  throw new Error("Supply chain checkpoints moved off-chain. Update IPFS/backend record instead.");
}

export async function getNetwork() {
  const provider = getProvider();
  return await provider.getNetwork();
}

export async function getBatchIdHashFromFields(
  batchNumber: string,
  manufacturer: string,
  productionDate: number
) {
  const contract = getContract();
  const batchId = computeBatchIdFromFields(batchNumber, manufacturer, productionDate);
  return await contract.getBatchIdHashFromBatchId(batchId);
}

export async function verifyByHash(batchIdHash: string) {
  const signer = await getSigner();
  const contract = getContract(signer);
  const result = await contract.verifyByHash(batchIdHash);
  const [isAuthentic, ipfsCid, registeredAt, manufacturerAddr, verificationCount] = result as [boolean, string, ethers.BigNumber, string, ethers.BigNumber];
  if (!isAuthentic) {
    return {
      isAuthentic: false,
      matches: false,
      expired: false,
      details: { manufacturer: "", productName: "", productionDate: 0, expiryDate: 0, batchNumber: "", verificationCount: 0, isRegistered: false },
      checkpoints: [] as string[],
    };
  }
  let offchain: any = {};
  try {
    if (ipfsCid) offchain = await fetchIPFSJson(ipfsCid);
  } catch {
    offchain = {};
  }
  const details = {
    manufacturer: offchain.manufacturer ?? "",
    productName: offchain.productName ?? "",
    productionDate: offchain.productionDate ?? 0,
    expiryDate: offchain.expiryDate ?? 0,
    batchNumber: offchain.batchNumber ?? "",
    verificationCount: Number(verificationCount),
    isRegistered: true,
  };
  const nowSec = Math.floor(Date.now() / 1000);
  const expired = Number(details.expiryDate) > 0 && Number(details.expiryDate) < nowSec;
  const checkpoints: string[] = Array.isArray(offchain.distributionPath) ? offchain.distributionPath : [];
  return { isAuthentic, matches: true, expired, details, checkpoints };
}

export async function getDetailsByHash(batchIdHash: string) {
  const providerContract = getContract();
  const result = await providerContract.getBatchRecordByHash(batchIdHash);
  const [isRegistered, ipfsCid, registeredAt, manufacturerAddr, verificationCount] = result as [boolean, string, ethers.BigNumber, string, ethers.BigNumber];
  if (!isRegistered) {
    return { details: { manufacturer: "", productName: "", productionDate: 0, expiryDate: 0, batchNumber: "", verificationCount: 0, isRegistered: false }, checkpoints: [] as string[] };
  }
  let offchain: any = {};
  try {
    if (ipfsCid) offchain = await fetchIPFSJson(ipfsCid);
  } catch {
    offchain = {};
  }
  const details = {
    manufacturer: offchain.manufacturer ?? "",
    productName: offchain.productName ?? "",
    productionDate: offchain.productionDate ?? 0,
    expiryDate: offchain.expiryDate ?? 0,
    batchNumber: offchain.batchNumber ?? "",
    verificationCount: Number(verificationCount),
    isRegistered: true,
  };
  const checkpoints: string[] = Array.isArray(offchain.distributionPath) ? offchain.distributionPath : [];
  return { details, checkpoints };
}

export async function getDetailsFromFields(
  batchNumber: string,
  manufacturer: string,
  productionDate: number
) {
  const batchIdHash = await getBatchIdHashFromFields(batchNumber, manufacturer, productionDate);
  return await getDetailsByHash(batchIdHash);
}