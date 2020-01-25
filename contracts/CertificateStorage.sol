pragma solidity 0.6.1;
pragma experimental ABIEncoderV2;

/*

- certificate hash should be unsigned certificate hash
  and there should be a way add signer to that certificate

// -
fdp bootcamp webinar participation

// add option for certifiying authority to transfer certificationship to other address

*/

contract CertificateStorage {
  struct Certificate {
    bytes32 name;
    bytes32 qualification;
    bytes32 extraData;
    bytes signers;
  }

  struct CertifyingAuthority {
    bytes32 name;
    bool isAuthorised;
  }

  mapping(bytes32 => Certificate) public certificates;
  mapping(address => CertifyingAuthority) public certifyingAuthorities;

  address public manager;
  bytes constant public PERSONAL_PREFIX = "\x19Ethereum Signed Message:\n96";
  uint256 constant CERTIFICATE_DETAILS_LENGTH = 96;
  uint256 constant SIGNATURE_LENGTH = 65;

  // bytes public zemse;

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

  function addCertifyingAuthority(address _authorityAddress, bytes32 _name) public onlyManager {
    certifyingAuthorities[_authorityAddress] = CertifyingAuthority({
      name: _name,
      isAuthorised: true
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

  function updateCertifyingAuthority(
    bytes32 _name
  ) public {
    require(
      certifyingAuthorities[msg.sender].isAuthorised
      , 'not authorised'
    );
    certifyingAuthorities[msg.sender].name = _name;
  }
 
  function registerCertificate(
    bytes memory _signedCertificate
  ) public returns (
    bytes32
  ) {
    require(
      _signedCertificate.length > CERTIFICATE_DETAILS_LENGTH
      && (_signedCertificate.length - CERTIFICATE_DETAILS_LENGTH) % SIGNATURE_LENGTH == 0
      , 'invalid certificate length'
    );

    (Certificate memory _certificateObj, bytes32 _certificateHash) = parseSignedCertificate(_signedCertificate, true);

    // require(
    //   certificates[_certificateHash].signers.length == 0
    //   , 'certificate registered already'
    // );

    /// @dev signers in this transaction
    bytes memory _newSigners = _certificateObj.signers;

    /// @dev if certificate already registered then signers can be updated
    bytes memory _updatedSigners = certificates[_certificateHash].signers;

    for(uint256 _i = 0; _i < _newSigners.length; _i += 20) {
      address _signer;
      assembly {
        _signer := mload(add(_newSigners, add(0x14, _i)))
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
    bytes32 _name;
    bytes32 _qualification;
    bytes32 _extraData;
    bytes memory _signers;

    assembly {
      let _pointer := add(_signedCertificate, 0x20)
      _name := mload(_pointer)
      _qualification := mload(add(_pointer, 0x20))
      _extraData := mload(add(_pointer, 0x40))
    }

    // zemse =
    _certificateHash = keccak256(abi.encodePacked(
      PERSONAL_PREFIX,
      _name,
      _qualification,
      _extraData
    ));

    for(uint256 _i = CERTIFICATE_DETAILS_LENGTH; _i < _signedCertificate.length; _i += SIGNATURE_LENGTH) {
      bytes32 _r;
      bytes32 _s;
      uint8 _v;

      assembly {
        let _pointer := add(_signedCertificate, add(0x20, _i))
        _r := mload(_pointer)
        _s := mload(add(_pointer, 0x20))
        _v := byte(0, mload(add(_pointer, 0x40)))
        if lt(_v, 27) { _v := add(_v, 27) }
      }

      require(_v == 27 || _v == 28, 'invalid recovery value');

      address _signer = ecrecover(_certificateHash, _v, _r, _s);

      require(checkUniqueSigner(_signer, _signers), 'each signer should be unique');

      if(_allowedSignersOnly) {
        require(certifyingAuthorities[_signer].isAuthorised, 'certifier not authorised');
      }

      _signers = abi.encodePacked(_signers, _signer);
    }

    _certificateObj.name = _name;
    _certificateObj.qualification = _qualification;
    _certificateObj.extraData = _extraData;
    _certificateObj.signers = _signers;
  }

  function checkUniqueSigner(address _signer, bytes memory _packedSigners) private pure returns (bool){
    if(_packedSigners.length == 0) return true;

    require(_packedSigners.length % 20 == 0, 'invalid packed signers length');

    address _tempSigner;
    for(uint256 _i = 0; _i < _packedSigners.length; _i += 20) {
      assembly {
        _tempSigner := mload(add(_packedSigners, add(0x14, _i)))
      }
      if(_tempSigner == _signer) return false;
    }

    return true;
  }
}
