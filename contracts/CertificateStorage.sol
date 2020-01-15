pragma solidity 0.6.1;
pragma experimental ABIEncoderV2;

contract CertificateStorage {
  struct Certificate {
    bytes32 name;
    bytes32 certifiedAs;
    address certifiedBy;
  }

  struct CertifyingAuthority {
    bytes32 name;
    bool isAuthorised;
  }

  mapping(bytes32 => Certificate) public certificates;
  mapping(address => CertifyingAuthority) public certifyingAuthorities;

  address public deployer;
  bytes public zemse;

  event Address(
    address _signer
  );

  event Bytes32(
    bytes32 _bytes32
  );

  event Bytes(
    bytes _bytes
  );

  event CertificateRegistered(
    bytes32 indexed _name,
    bytes32 indexed _certifiedAs,
    address indexed _certifiedBy,
    bytes32 _certificateHash
  );

  modifier onlyDeployer() {
    require(msg.sender == deployer, 'only deployer can call');
    _;
  }

  constructor() public {
    deployer = msg.sender;
  }

  function addCertifyingAuthority(address _authorityAddress, bytes32 _name) public onlyDeployer {
    certifyingAuthorities[_authorityAddress] = CertifyingAuthority({
      name: _name,
      isAuthorised: true
    });
  }

  function updateCertifyingAuthorityAuthorization(
    address _authorityAddress,
    bool _newStatus
  ) public onlyDeployer {
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

  function registerCertificate(bytes memory _signedCertificate) public returns (bool _success) {
    Certificate memory _certificateObj = getCertificateAndSignerAddress(_signedCertificate);

    address _signer = _certificateObj.certifiedBy;
    bytes32 _certificateHash = keccak256(abi.encodePacked(_signedCertificate));

    emit Address(_signer);
    emit Bytes32(_certificateHash);

    // require(
    //   certifyingAuthorities[_signer].isAuthorised
    //   , 'certifier not authorised'
    // );
    //
    // require(
    //   certificates[_certificateHash].certifiedBy == address(0)
    //   , 'certificate registered already'
    // );

    certificates[_certificateHash] = _certificateObj;

    emit CertificateRegistered(
      _certificateObj.name,
      _certificateObj.certifiedAs,
      _certificateObj.certifiedBy,
      _certificateHash
    );
  }

  function getCertificateAndSignerAddress(
    bytes memory _certificate
  ) public returns (Certificate memory) {
    bytes32 _name;
    bytes32 _certifiedAs;

    bytes32 _r;
    bytes32 _s;
    uint8 _v;

    assembly {
      let _pointer := add(_certificate, 0x20)
      _name := mload(_pointer)
      _certifiedAs := mload(add(_pointer, 32))
      _r := mload(add(_pointer, 64))
      _s := mload(add(_pointer, 96))
      _v := byte(0, mload(add(_pointer, 128)))
      // _v := and(mload(add(_pointer, 65)), 255)
    }

    if(_v < 27) _v += 27;

    require(
      _v == 27 || _v == 28
      , 'invalid recovery value'
    );

    // bytes32 _certificateHash = keccak256(abi.encodePacked(_name, _certifiedAs));
    bytes32 _messageDigest = keccak256(
      abi.encodePacked("\x19Ethereum Signed Message:\n64", _name, _certifiedAs)
    );

    zemse = abi.encodePacked("\x19Ethereum Signed Message:\n64", _name, _certifiedAs);

    emit Bytes(abi.encodePacked("\x19Ethereum Signed Message:\n64", _name, _certifiedAs));
    emit Bytes32(_name);
    emit Bytes32(_certifiedAs);
    emit Bytes32(_messageDigest);

    address _signer = ecrecover(_messageDigest, _v, _r, _s);
    Certificate memory _certificateObj = Certificate({
      name: _name,
      certifiedAs: _certifiedAs,
      certifiedBy: _signer
    });

    return _certificateObj;
  }
}
