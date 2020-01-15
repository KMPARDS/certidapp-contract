pragma solidity 0.6.1;
pragma experimental ABIEncoderV2;

import './RLP.sol';

contract CertificateStorage {
  using RLP for bytes;
  using RLP for RLP.RLPItem;

  struct Certificate {
    bytes name;
    bytes course;
    bytes2 percentile;
    address certifiedBy;
  }

  struct CertifyingAuthority {
    bytes name;
    bool isAuthorised;
  }

  mapping(bytes32 => Certificate) public certificates;
  mapping(address => CertifyingAuthority) public certifyingAuthorities;

  address public deployer;

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
    bytes indexed _name,
    bytes indexed _course,
    bytes2 _percentile,
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

  function addCertifyingAuthority(address _authorityAddress, bytes memory _name) public onlyDeployer {
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
    bytes memory _name
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

    // certificates[_certificateHash] = _certificateObj;

    // emit CertificateRegistered(
    //   _certificateObj.name,
    //   _certificateObj.course,
    //   _certificateObj.percentile,
    //   _certificateObj.certifiedBy,
    //   _certificateHash
    // );
  }

  function getCertificateAndSignerAddress(
    bytes memory _signedCertificate
  ) public returns (Certificate memory) {
    RLP.RLPItem[] memory _signedCertificateItems = _signedCertificate.toRLPItem().toList();

    bytes memory _name = _signedCertificateItems[0].toBytes();
    bytes memory _course = _signedCertificateItems[1].toBytes();

    bytes memory __percentile = _signedCertificateItems[2].toBytes();
    bytes memory __v = _signedCertificateItems[3].toBytes();
    bytes memory __r = _signedCertificateItems[4].toBytes();
    bytes memory __s = _signedCertificateItems[5].toBytes();

    bytes2 _percentile;
    uint8 _v;
    bytes32 _r;
    bytes32 _s;

    assembly {
      _percentile := mload(add(__percentile, 0x20))
      _v := mload(add(__v, 0x20))
      _r := mload(add(__r, 0x20))
      _s := mload(add(__s, 0x20))
    }

    bytes32 _unsignedCertificateHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32",_name, _course, __percentile));
    // emit Bytes32(_unsignedCertificateHash);

    _unsignedCertificateHash = keccak256(
      abi.encode("\x19Ethereum Signed Message:\n32", _name, _course, __percentile)
    );

    emit Bytes(_name);
    emit Bytes(_course);
    emit Bytes(__percentile);

    emit Bytes32(_unsignedCertificateHash);

    // // also do below things in assembly
    // uint8 _v = bytes1(_signedCertificateItems[3].toBytes());
    // bytes32 _r = bytes32(_signedCertificateItems[4].toBytes());
    // bytes32 _s = bytes32(_signedCertificateItems[5].toBytes());

    if(_v < 27) _v += 27;

    require(
      _v == 27 || _v == 28
      , 'invalid recovery value'
    );

    address _signer = ecrecover(_unsignedCertificateHash, _v, _r, _s);
    Certificate memory _certificateObj = Certificate({
      name: _name,
      course: _course,
      percentile: _percentile,
      certifiedBy: _signer
    });

    return _certificateObj;
  }
}
