pragma solidity 0.6.1;

// import { ECVerify } from "./ECVerify.sol";

contract CertificateStorage {
  // using ECVerify for bytes32;

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
    // bytes32 _name;
    //
    // bytes32 _r;
    // bytes32 _s;
    // uint8 _v;
    //
    // assembly {
    //   let _pointer := add(_certificate, 0x20)
    //   _name := mload(_pointer)
    //   _r := mload(add(_pointer, 32))
    //   _s := mload(add(_pointer, 64))
    //   _v := byte(0, mload(add(_pointer, 96)))
    //   // _v := and(mload(add(_pointer, 65)), 255)
    // }
    //
    // if(_v < 27) _v += 27;
    //
    // require(
    //   _v == 27 || _v == 28
    //   , 'invalid recovery value'
    // );
    //
    // bytes32 _certificateHash = keccak256(abi.encodePacked(_name));
    // address _signer = recoverAddress(_certificateHash, _v, _r, _s);

    address _signer = recoverAddress(_certificate);

    // emit Bytes32(_certificateHash);
    // emit Uint8(_v);
    // emit Bytes32(_r);
    // emit Bytes32(_s);
    emit Address(_signer);
  }

  function recoverAddress(
    bytes memory _certificate
  ) public pure returns (address) {
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

    // bytes32 _certificateHash = keccak256(abi.encodePacked(_name));
    bytes32 _messageDigest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", _name));
    return ecrecover(_messageDigest, _v, _r, _s);
  }
}
