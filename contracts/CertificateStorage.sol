pragma solidity 0.6.1;
pragma experimental ABIEncoderV2;

contract CertificateStorage {
  struct Certificate {
    bytes32 name;
    address certifiedBy;
  }

  struct CertifyingAuthority {
    bytes32 name;
    bool isAuthorised;
  }

  mapping(bytes32 => Certificate) public certificates;
  mapping(address => CertifyingAuthority) public certifyingAuthorities;

  address manager;

  bytes prefix = "\x19Ethereum Signed Message:\n32";

  event Address(
    address _signer
  );
  event Bytes32(
    bytes32 _bytes32
  );
  event Bytes(
    bytes _bytes
  );
  event Bytes1(
    bytes1 _bytes1
  );
  event Uint8(
    uint8 _uint8
  );
  event Uint256(
    uint256 _uint256
  );

  function certify(bytes memory _signedCertificate) public returns (bool _success) {
    (Certificate memory _certificateObj, address _signer) = getCertificateAndSignerAddress(_signedCertificate);

    bytes32 _certificateHash = keccak256(abi.encodePacked(_signedCertificate));

    emit Address(_signer);
    emit Bytes32(_certificateHash);
    //
    // require(
    //   certifyingAuthority[_signer].isAuthorised
    //   , 'not authorised'
    // );
    //
    // require(
    //   certificates[_certificateHash].certifiedBy == address(0)
    //   , 'certificate registered already'
    // );


  }

  function getCertificateAndSignerAddress(
    bytes memory _certificate
  ) public pure returns (Certificate memory, address) {
    bytes32 _name;

    bytes32 _r;
    bytes32 _s;
    uint8 _v;

    assembly {
      let _pointer := add(_certificate, 0x20)
      _name := mload(_pointer)
      _r := mload(add(_pointer, 32))
      _s := mload(add(_pointer, 64))
      _v := byte(0, mload(add(_pointer, 96)))
      // _v := and(mload(add(_pointer, 65)), 255)
    }

    if(_v < 27) _v += 27;

    require(
      _v == 27 || _v == 28
      , 'invalid recovery value'
    );

    bytes32 _certificateHash = keccak256(abi.encodePacked(_name));
    bytes32 _messageDigest = keccak256(
      abi.encodePacked("\x19Ethereum Signed Message:\n32", _certificateHash)
    );

    address _signer = ecrecover(_messageDigest, _v, _r, _s);
    Certificate memory _certificateObj = Certificate({
      name: _name,
      certifiedBy: _signer
    });

    return (
      _certificateObj,
      _signer
    );
  }
}
