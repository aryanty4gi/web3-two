# Kwalaa Blockchain (Hardhat)

Deploy the `MedicineVerification` contract to Sepolia or Polygon Amoy.

## Setup

1. Create `.env` from `.env.example` and fill:
   - `PRIVATE_KEY` of deployer wallet
   - `SEPOLIA_RPC_URL` and/or `AMOY_RPC_URL`
   - Optional `ETHERSCAN_API_KEY`, `POLYGONSCAN_API_KEY` for verification

2. Install deps:

```
npm install
```

## Compile

```
npm run compile
```

## Deploy

Sepolia:

```
npm run deploy:sepolia
```

Polygon Amoy:

```
npm run deploy:amoy
```

After deployment, copy the address into `kwalaa-med-verify/.env.local` as:

```
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
```