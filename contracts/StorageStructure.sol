pragma solidity 0.6.1;

contract StorageStructure {
  struct Certificate {
    bytes data;
    bytes signers;
  }

  struct CertifyingAuthority {
    bytes data;
    bool isAuthorised;
    bool isMigrated;
  }

  mapping(bytes32 => Certificate) public certificates;
  mapping(address => CertifyingAuthority) public certifyingAuthorities;

  address public manager;
  
  bytes constant public PERSONAL_PREFIX = "\x19Ethereum Signed Message:\n";
  // uint256 constant CERTIFICATE_DETAILS_LENGTH = 96;
  // uint256 constant SIGNATURE_LENGTH = 65;

  event Certified(
    bytes32 indexed _certificateHash,
    address indexed _certifyingAuthority
  );

  event Authorization(
    address indexed _certifyingAuthority,
    bool _newStatus
  );

  modifier onlyManager() {
    require(msg.sender == manager, 'only manager can call');
    _;
  }
}
