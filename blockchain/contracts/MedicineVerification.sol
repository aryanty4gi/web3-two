// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Minimal on-chain storage with off-chain details (IPFS/backend)
contract MedicineVerification {
    struct BatchRecord {
        address manufacturer; // manufacturer wallet/address
        uint256 registeredAt; // timestamp when registered
        string ipfsCid; // IPFS CID or backend pointer
        uint256 verificationCount; // number of verifications
        bool isRegistered; // existence flag
    }

    // Mapping from batch ID hash to minimal record
    mapping(bytes32 => BatchRecord) public batches;

    // Mapping to track authorized manufacturers
    mapping(address => bool) public authorizedManufacturers;

    // Owner of the contract
    address public owner;

    // Events
    event BatchRegistered(bytes32 batchIdHash, address manufacturer, string ipfsCid);
    event BatchVerified(bytes32 batchIdHash, uint256 timestamp);
    event ManufacturerAuthorized(address manufacturer);
    event ManufacturerRevoked(address manufacturer);

    constructor() {
        owner = msg.sender;
        authorizedManufacturers[msg.sender] = true;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    modifier onlyAuthorized() {
        require(authorizedManufacturers[msg.sender], "Not authorized");
        _;
    }

    function authorizeManufacturer(address manufacturer) public onlyOwner {
        authorizedManufacturers[manufacturer] = true;
        emit ManufacturerAuthorized(manufacturer);
    }

    function revokeManufacturer(address manufacturer) public onlyOwner {
        authorizedManufacturers[manufacturer] = false;
        emit ManufacturerRevoked(manufacturer);
    }

    // Register minimal batch data; details live off-chain at ipfsCid/backend
    function registerMedicineBatch(
        string memory batchId,
        address manufacturer,
        uint256 timestamp,
        string memory ipfsCid
    ) public onlyAuthorized returns (bytes32) {
        bytes32 batchIdHash = keccak256(abi.encodePacked(batchId));
        require(!batches[batchIdHash].isRegistered, "Batch already registered");
        batches[batchIdHash] = BatchRecord({
            manufacturer: manufacturer,
            registeredAt: timestamp,
            ipfsCid: ipfsCid,
            verificationCount: 0,
            isRegistered: true
        });
        emit BatchRegistered(batchIdHash, manufacturer, ipfsCid);
        return batchIdHash;
    }

    // Verify by batchId string (does NOT expose off-chain details directly)
    function verifyBatch(string memory batchId)
        public
        returns (
            bool isAuthentic,
            string memory ipfsCid,
            uint256 registeredAt,
            address manufacturer,
            uint256 verificationCount
        )
    {
        bytes32 batchIdHash = keccak256(abi.encodePacked(batchId));
        BatchRecord storage br = batches[batchIdHash];
        isAuthentic = br.isRegistered;
        if (isAuthentic) {
            br.verificationCount += 1;
            emit BatchVerified(batchIdHash, block.timestamp);
        }
        return (isAuthentic, br.ipfsCid, br.registeredAt, br.manufacturer, br.verificationCount);
    }

    // Convenience verification by hash (QRs often carry hash)
    function verifyByHash(bytes32 batchIdHash)
        public
        returns (
            bool isAuthentic,
            string memory ipfsCid,
            uint256 registeredAt,
            address manufacturer,
            uint256 verificationCount
        )
    {
        BatchRecord storage br = batches[batchIdHash];
        isAuthentic = br.isRegistered;
        if (isAuthentic) {
            br.verificationCount += 1;
            emit BatchVerified(batchIdHash, block.timestamp);
        }
        return (isAuthentic, br.ipfsCid, br.registeredAt, br.manufacturer, br.verificationCount);
    }

    // Read-only accessor by hash (does not increment verificationCount)
    function getBatchRecordByHash(bytes32 batchIdHash)
        public
        view
        returns (
            bool isRegistered,
            string memory ipfsCid,
            uint256 registeredAt,
            address manufacturer,
            uint256 verificationCount
        )
    {
        BatchRecord storage br = batches[batchIdHash];
        return (br.isRegistered, br.ipfsCid, br.registeredAt, br.manufacturer, br.verificationCount);
    }

    // Helper to compute hash from a simple batchId string
    function getBatchIdHashFromBatchId(string memory batchId) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(batchId));
    }
}