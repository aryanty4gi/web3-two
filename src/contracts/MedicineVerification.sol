// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MedicineVerification {
    struct Medicine {
        string manufacturer;
        string productName;
        uint256 productionDate;
        uint256 expiryDate;
        string batchNumber;
        string[] supplyChainCheckpoints;
        uint256 verificationCount;
        bool isRegistered;
    }

    // Mapping from batch ID hash to Medicine details
    mapping(bytes32 => Medicine) public medicines;
    
    // Mapping to track authorized manufacturers
    mapping(address => bool) public authorizedManufacturers;
    
    // Owner of the contract
    address public owner;
    
    // Events
    event MedicineRegistered(bytes32 batchIdHash, string batchNumber, string manufacturer);
    event MedicineVerified(bytes32 batchIdHash, string batchNumber, uint256 timestamp);
    event ManufacturerAuthorized(address manufacturer);
    event ManufacturerRevoked(address manufacturer);
    event SupplyChainCheckpointAdded(bytes32 batchIdHash, string checkpoint);

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

    function registerMedicine(
        string memory _manufacturer,
        string memory _productName,
        uint256 _productionDate,
        uint256 _expiryDate,
        string memory _batchNumber
    ) public onlyAuthorized returns (bytes32) {
        // Create a unique hash for this batch
        bytes32 batchIdHash = keccak256(abi.encodePacked(_batchNumber, _manufacturer, _productionDate));
        
        // Ensure this batch hasn't been registered before
        require(!medicines[batchIdHash].isRegistered, "Batch already registered");
        
        // Initialize empty array for supply chain checkpoints
        string[] memory checkpoints = new string[](0);
        
        // Register the medicine
        medicines[batchIdHash] = Medicine({
            manufacturer: _manufacturer,
            productName: _productName,
            productionDate: _productionDate,
            expiryDate: _expiryDate,
            batchNumber: _batchNumber,
            supplyChainCheckpoints: checkpoints,
            verificationCount: 0,
            isRegistered: true
        });
        
        emit MedicineRegistered(batchIdHash, _batchNumber, _manufacturer);
        
        return batchIdHash;
    }

    function addSupplyChainCheckpoint(bytes32 batchIdHash, string memory checkpoint) public onlyAuthorized {
        require(medicines[batchIdHash].isRegistered, "Medicine not registered");
        
        medicines[batchIdHash].supplyChainCheckpoints.push(checkpoint);
        
        emit SupplyChainCheckpointAdded(batchIdHash, checkpoint);
    }

    function verifyMedicine(string memory _batchNumber, string memory _manufacturer, uint256 _productionDate) public returns (bool) {
        // Recreate the hash to look up the medicine
        bytes32 batchIdHash = keccak256(abi.encodePacked(_batchNumber, _manufacturer, _productionDate));
        
        // Check if medicine exists
        bool isAuthentic = medicines[batchIdHash].isRegistered;
        
        // Increment verification count
        if (isAuthentic) {
            medicines[batchIdHash].verificationCount++;
            emit MedicineVerified(batchIdHash, _batchNumber, block.timestamp);
        }
        
        return isAuthentic;
    }

    function getMedicineDetails(bytes32 batchIdHash) public view returns (
        string memory manufacturer,
        string memory productName,
        uint256 productionDate,
        uint256 expiryDate,
        string memory batchNumber,
        uint256 verificationCount,
        bool isRegistered
    ) {
        Medicine storage medicine = medicines[batchIdHash];
        
        return (
            medicine.manufacturer,
            medicine.productName,
            medicine.productionDate,
            medicine.expiryDate,
            medicine.batchNumber,
            medicine.verificationCount,
            medicine.isRegistered
        );
    }

    function getSupplyChainCheckpoints(bytes32 batchIdHash) public view returns (string[] memory) {
        require(medicines[batchIdHash].isRegistered, "Medicine not registered");
        
        return medicines[batchIdHash].supplyChainCheckpoints;
    }

    function getBatchIdHash(string memory _batchNumber, string memory _manufacturer, uint256 _productionDate) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(_batchNumber, _manufacturer, _productionDate));
    }
}