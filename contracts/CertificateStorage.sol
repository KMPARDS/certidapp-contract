pragma solidity 0.6.1;
pragma experimental ABIEncoderV2;

/*

- certificate hash should be unsigned certificate hash
  and there should be a way add signer to that certificate

// -
fdp bootcamp webinar participation

// add option for certifiying authority to transfer certificationship to other address


adding:
RLP structure

*/

import 'RLP.sol';

contract CertificateStorage {
  using RLP for bytes;
  using RLP for RLP.RLPItem;

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
  uint256 constant SIGNATURE_LENGTH = 65;

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

  constructor() public {
    manager = msg.sender;
  }

  // function writeToSz(bytes memory _sz) public {
  //   sz[msg.sender] = _sz;
  // }

  function addCertifyingAuthority(address _authorityAddress, bytes memory _name) public onlyManager {
    certifyingAuthorities[_authorityAddress] = CertifyingAuthority({
      data: _name,
      isAuthorised: true,
      isMigrated: false
    });
    emit Authorization(_authorityAddress, true);
  }

  function newManager(address _newManagerAddress) public onlyManager {
    manager = _newManagerAddress;
  }

  function updateCertifyingAuthorityAuthorization(
    address _authorityAddress,
    bool _newStatus
  ) public onlyManager {
    certifyingAuthorities[_authorityAddress].isAuthorised = _newStatus;
  }

  // function updateCertifyingAuthority(
  //   bytes32 _name
  // ) public {
  //   require(
  //     certifyingAuthorities[msg.sender].isAuthorised
  //     , 'not authorised'
  //   );
  //   certifyingAuthorities[msg.sender].name = _name;
  // }

  function registerCertificate(
    bytes memory _signedCertificate
  ) public returns (
    bytes32
  ) {
    // require(
    //   _signedCertificate.length > CERTIFICATE_DETAILS_LENGTH
    //   && (_signedCertificate.length - CERTIFICATE_DETAILS_LENGTH) % SIGNATURE_LENGTH == 0
    //   , 'invalid certificate length'
    // );

    (Certificate memory _certificateObj, bytes32 _certificateHash) = parseSignedCertificate(_signedCertificate, true);

    // require(
    //   certificates[_certificateHash].signers.length == 0
    //   , 'certificate registered already'
    // );

    /// @dev signers in this transaction
    bytes memory _newSigners = _certificateObj.signers;

    /// @dev if certificate already registered then signers can be updated
    bytes memory _updatedSigners = certificates[_certificateHash].signers;

    for(uint256 i = 0; i < _newSigners.length; i += 20) {
      address _signer;
      assembly {
        _signer := mload(add(_newSigners, add(0x14, i)))
      }
      if(checkUniqueSigner(_signer, certificates[_certificateHash].signers)) {
        _updatedSigners = abi.encodePacked(_updatedSigners, _signer);
        emit Certified(
          _certificateHash,
          _signer
        );
      }
    }

    if(certificates[_certificateHash].signers.length > 0) {
      require(_updatedSigners.length > certificates[_certificateHash].signers.length, 'need new signers');
      certificates[_certificateHash].signers = _updatedSigners;
    } else {
      certificates[_certificateHash] = _certificateObj;
    }

    return _certificateHash;
  }

  function parseSignedCertificate(
    bytes memory _signedCertificate,
    bool _allowedSignersOnly
  ) public view returns (
    Certificate memory _certificateObj,
    bytes32 _certificateHash
  ) {
    RLP.RLPItem[] memory _certificateRLP = _signedCertificate.toRlpItem().toList();

    _certificateObj.data = _certificateRLP[0].toRlpBytes();

    _certificateHash = keccak256(abi.encodePacked(
      PERSONAL_PREFIX,
      getBytesStr(_certificateObj.data.length),
      _certificateObj.data
    ));

    for(uint256 i = 1; i < _certificateRLP.length; i += 1) {
      bytes memory _signature = _certificateRLP[i].toBytes();

      bytes32 _r;
      bytes32 _s;
      uint8 _v;

      assembly {
        let _pointer := add(_signature, 0x20)
        _r := mload(_pointer)
        _s := mload(add(_pointer, 0x20))
        _v := byte(0, mload(add(_pointer, 0x40)))
        if lt(_v, 27) { _v := add(_v, 27) }
      }

      require(_v == 27 || _v == 28, 'invalid recovery value');

      address _signer = ecrecover(_certificateHash, _v, _r, _s);

      require(checkUniqueSigner(_signer, _certificateObj.signers), 'each signer should be unique');

      if(_allowedSignersOnly) {
        require(certifyingAuthorities[_signer].isAuthorised, 'certifier not authorised');
      }

      _certificateObj.signers = abi.encodePacked(_certificateObj.signers, _signer);
    }
  }

  function checkUniqueSigner(address _signer, bytes memory _packedSigners) private pure returns (bool){
    if(_packedSigners.length == 0) return true;

    require(_packedSigners.length % 20 == 0, 'invalid packed signers length');

    address _tempSigner;
    for(uint256 i = 0; i < _packedSigners.length; i += 20) {
      assembly {
        _tempSigner := mload(add(_packedSigners, add(0x14, i)))
      }
      if(_tempSigner == _signer) return false;
    }

    return true;
  }


  function getBytesStr(uint i) private pure returns (bytes memory) {
    if (i == 0) {
      return "0";
    }
    uint j = i;
    uint len;
    while (j != 0) {
      len++;
      j /= 10;
    }
    bytes memory bstr = new bytes(len);
    uint k = len - 1;
    while (i != 0) {
      bstr[k--] = byte(uint8(48 + i % 10));
      i /= 10;
    }
    return bstr;
  }
}
