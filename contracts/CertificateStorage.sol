pragma solidity 0.6.1;

contract CertificateStorage {
  struct Certificate {
    bytes32 name;
  }

  struct CertifyingAuthority {
    bytes32 name;
    bool isAuthorised;
  }

  mapping(bytes32 => Certificate) public certificate;
  mapping(address => CertifyingAuthority) public certifyingAuthority;

  address manager;

  bytes prefix = "\x19Ethereum Signed Message:\n32";

  event Address(
    address _signer
  );
  event Bytes32(
    bytes32 _bytes32
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

  function certify(bytes memory _certificate) public returns (bool _success) {
    bytes32 _name;
    bytes32 _sigR;
    bytes32 _sigS;
    bytes1 _sigV_;
    uint256 _sigV;

    assembly {
      let _pointer := add(_certificate, 0x20)
      _name := mload(_pointer)
      _sigR := mload(add(_pointer, 32))
      _sigS := mload(add(_pointer, 64))
      _sigV_ := mload(add(_pointer, 96))
      _sigV := _sigV_
      if lt(_sigV, 27) { _sigV := add(_sigV, 27) }
    }
    // if(_sigV < 27) _sigV += 27;


    // _sigV = bytes1(uint8(_sigV) + 27);

    bytes32 _certificateHash = keccak256(abi.encodePacked(_name));
    // address _signer = ecrecover(_certificateHash, uint8(28), _sigR, _sigS);
    address _signer = recoverAddress(_certificateHash, uint8(_sigV), _sigR, _sigS);

    emit Address(_signer);
    emit Bytes32(_certificateHash);
    emit Bytes32(_sigR);
    emit Bytes32(_sigS);
    emit Bytes1(_sigV_);
    emit Uint256(_sigV);
  }

  function recoverAddress(
    bytes32 _hash,
    uint8 _v,
    bytes32 _r,
    bytes32 _s
  ) public pure returns (address) {
    bytes32 _messageDigest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", _hash));
    return ecrecover(_messageDigest, _v, _r, _s);
  }
}
