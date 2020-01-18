pragma solidity 0.6.1;
pragma experimental ABIEncoderV2;

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

  bytes public zemse;

  event Certified(
    bytes32 indexed _certificateHash,
    address indexed _certifiedBy
  );

  event Address(
    address _address,
    uint256 _id
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
    require(
      _signedCertificate.length > CERTIFICATE_DETAILS_LENGTH
      && (_signedCertificate.length - CERTIFICATE_DETAILS_LENGTH) % SIGNATURE_LENGTH == 0
      , 'invalid certificate length'
    );

    Certificate memory _certificateObj = parseSignedCertificate(_signedCertificate, true);

    // address _signer = _certificateObj.certifiedBy[0];
    bytes32 _certificateHash = keccak256(abi.encodePacked(_signedCertificate));

    // require(
    //   certifyingAuthorities[_signer].isAuthorised
    //   , 'certifier not authorised'
    // );

    // emit Address(address(0), certificates[_certificateHash].signers.length);

    require(
      certificates[_certificateHash].signers.length == 0
      , 'certificate registered already'
    );

    certificates[_certificateHash] = _certificateObj;
  }

  function getCertificateDetailsFromSignedCertificate(
    bytes memory _signedCertificate
  ) public returns (bytes32, bytes32) {
    bytes32 _name;
    bytes32 _qualification;

    assembly {
      let _pointer := add(_signedCertificate, 0x20)
      _name := mload(_pointer)
      _qualification := mload(add(_pointer, 0x20))
    }


  }

  function parseSignedCertificate(
    bytes memory _signedCertificate,
    bool _allowedSignersOnly
  ) public view returns (Certificate memory) {

    // first isolate the certificatedata
    // then loop for every signature.

    bytes32 _name;
    bytes32 _qualification;
    bytes32 _extraData;
    bytes memory _signers;

    uint256 _pointer;
    assembly {
      _pointer := add(_signedCertificate, 0x20)
      _name := mload(_pointer)
      _qualification := mload(add(_pointer, 0x20))
      _extraData := mload(add(_pointer, 0x40))
    }

    bytes32 _messageDigest = keccak256(
      abi.encodePacked(PERSONAL_PREFIX, _name, _qualification, _extraData)
    );

    uint256 _numberOfSignatures = (_signedCertificate.length - CERTIFICATE_DETAILS_LENGTH
      ) / SIGNATURE_LENGTH;

    _pointer += CERTIFICATE_DETAILS_LENGTH;

    for(uint256 _i = 0; _i < _numberOfSignatures; _i++) {
      bytes32 _r;
      bytes32 _s;
      uint8 _v;

      if(_i != 0) _pointer += SIGNATURE_LENGTH;

      assembly {
        _r := mload(_pointer)
        _s := mload(add(_pointer, 0x20))
        _v := byte(0, mload(add(_pointer, 0x40)))
      }

      if(_v < 27) _v += 27;

      require(
        _v == 27 || _v == 28
        , 'invalid recovery value'
      );

      address _signer = ecrecover(_messageDigest, _v, _r, _s);
      // emit Address(_signer, 0x143234);

      require(
        checkUniqueSigner(_signer, _signers)
        , 'each signer should be unique');

      if(_allowedSignersOnly) {
        require(certifyingAuthorities[_signer].isAuthorised, 'certifier not authorised');
      }

      _signers = abi.encodePacked(_signers, _signer);
    }

    Certificate memory _certificateObj = Certificate({
      name: _name,
      qualification: _qualification,
      extraData: _extraData,
      signers: _signers
    });

    return _certificateObj;
  }

  function checkUniqueSigner(address _signer, bytes memory _packedSigners) private pure returns (bool){
    require(_packedSigners.length % 20 == 0, 'invalid packed signers length');

    address _tempSigner;
    for(uint256 _i = 0; _i < _packedSigners.length; _i += 20) {
      assembly {
        let _pointer := add(_packedSigners, add(0x14, _i))
        _tempSigner := mload(_pointer)
      }
      if(_tempSigner == _signer) return false;
    }

    return true;
  }

  // function emit
}
