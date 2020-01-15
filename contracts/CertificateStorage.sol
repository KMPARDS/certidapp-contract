pragma solidity 0.6.1;
pragma experimental ABIEncoderV2;

contract CertificateStorage {
  struct Certificate {
    bytes32 name;
    bytes32 certificationData;
    address[] certifiedBy;
  }

  struct CertifyingAuthority {
    bytes32 name;
    bool isAuthorised;
  }

  mapping(bytes32 => Certificate) public certificates;
  mapping(address => CertifyingAuthority) public certifyingAuthorities;

  address public manager;
  bytes constant public PERSONAL_PREFIX = "\x19Ethereum Signed Message:\n64";
  uint256 constant SIGNED_CERTIFICATE_LENGTH = 129;
  // uint256 constant SIGNED_CERTIFICATE_LENGTH = 129;

  event Certified(
    bytes32 indexed _certificateHash,
    address indexed _certifiedBy
  );

  modifier onlyManager() {
    require(msg.sender == manager, 'only manager can call');
    _;
  }

  constructor() public {
    manager = msg.sender;
  }

  function addCertifyingAuthority(address _authorityAddress, bytes32 _name) public onlyManager {
    certifyingAuthorities[_authorityAddress] = CertifyingAuthority({
      name: _name,
      isAuthorised: true
    });
  }

  function updateCertifyingAuthorityAuthorization(
    address _authorityAddress,
    bool _newStatus
  ) public onlyManager {
    certifyingAuthorities[_authorityAddress].isAuthorised = _newStatus;
  }

  function updateCertifyingAuthority(
    bytes32 _name
  ) public {
    require(
      certifyingAuthorities[msg.sender].isAuthorised
      , 'not authorised'
    );
    certifyingAuthorities[msg.sender].name = _name;
  }

  function registerCertificate(bytes memory _signedCertificate) public {
    Certificate memory _certificateObj = parseSignedCertificate(_signedCertificate);

    address _signer = _certificateObj.certifiedBy[0];
    bytes32 _certificateHash = keccak256(abi.encodePacked(_signedCertificate));

    require(
      certifyingAuthorities[_signer].isAuthorised
      , 'certifier not authorised'
    );

    // require(
    //   certificates[_certificateHash].certifiedBy[0] == address(0)
    //   , 'certificate registered already'
    // );

    // certificates[_certificateHash] = _certificateObj;

    emit Certified(
      _certificateHash,
      _certificateObj.certifiedBy[0]
    );
  }

  function parseSignedCertificate(
    bytes memory _signedCertificate
  ) public returns (Certificate memory) {
    require(
      _signedCertificate.length == SIGNED_CERTIFICATE_LENGTH
      , 'invalid certificate length'
    );

    bytes32 _name;
    bytes32 _certificationData;

    bytes32 _r;
    bytes32 _s;
    uint8 _v;

    assembly {
      let _pointer := add(_signedCertificate, 0x20)
      _name := mload(_pointer)
      _certificationData := mload(add(_pointer, 32))
      _r := mload(add(_pointer, 64))
      _s := mload(add(_pointer, 96))
      _v := byte(0, mload(add(_pointer, 128)))
    }

    if(_v < 27) _v += 27;

    require(
      _v == 27 || _v == 28
      , 'invalid recovery value'
    );

    bytes32 _messageDigest = keccak256(
      abi.encodePacked(PERSONAL_PREFIX, _name, _certificationData)
    );

    address _signer = ecrecover(_messageDigest, _v, _r, _s);
    // Certificate memory _certificateObj;
    //  = Certificate({
    //   name: _name,
    //   certificationData: _certificationData,
    //   certifiedBy: new address[](1)
    // });

    bytes32 _certificateHash = keccak256(abi.encodePacked(_signedCertificate));

    certificates[_certificateHash].name = _name;
    certificates[_certificateHash].certificationData = _certificationData;
    certificates[_certificateHash].certifiedBy.push(_signer);

    // _certificateObj.certifiedBy[0] = _signer;

    return certificates[_certificateHash];
  }
}
