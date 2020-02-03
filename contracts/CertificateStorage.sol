pragma solidity 0.6.2;
pragma experimental ABIEncoderV2;

/*

- certificate hash should be unsigned certificate hash
  and there should be a way add signer to that certificate
  - done

// test certificates for:
  fdp
  bootcamp
  webinar
  participation

// add option for certifiying authority to transfer certificationship to other address


adding:
RLP structure - done

Manager:
- should be able to add more certifying authorities
- should be able to suspend any certifying authorities

*/

import 'RLP.sol';
import 'StorageStructure.sol';

contract CertificateStorage is StorageStructure {
  using RLP for bytes;
  using RLP for RLP.RLPItem;

  constructor() public {
    _changeManager(msg.sender);
  }

  function changeManager(address _newManagerAddress) public onlyManager {
    _changeManager(_newManagerAddress);
  }

  function updateCertifyingAuthority(
    address _authorityAddress,
    bytes memory _data,
    AuthorityStatus _status
  ) public onlyManager {
    if(_data.length > 0) {
      certifyingAuthorities[_authorityAddress].data = _data;
    }

    certifyingAuthorities[_authorityAddress].status = _status;

    emit AuthorityStatusUpdated(_authorityAddress, _status);
  }

  function migrateCertifyingAuthority(address _newAuthorityAddress) public onlyAuthorisedCertifier {
    certifyingAuthorities[msg.sender].status = AuthorityStatus.Migrated;
    emit AuthorityStatusUpdated(msg.sender, AuthorityStatus.Migrated);

    certifyingAuthorities[_newAuthorityAddress] = CertifyingAuthority({
      data: certifyingAuthorities[msg.sender].data,
      status: AuthorityStatus.Authorised
    });
    emit AuthorityStatusUpdated(_newAuthorityAddress, AuthorityStatus.Authorised);

    emit AuthorityMigrated(msg.sender, _newAuthorityAddress);
  }

  function registerCertificate(
    bytes memory _signedCertificate
  ) public returns (
    bytes32
  ) {
    (Certificate memory _certificateObj, bytes32 _certificateHash) = parseSignedCertificate(_signedCertificate, true);

    /// @dev signers in this transaction
    bytes memory _newSigners = _certificateObj.signers;

    /// @dev if certificate already registered then signers can be updated.
    ///   Initializing _updatedSigners with existing signers on blockchain if any.
    ///   More signers would be appended to this in next 'for' loop.
    bytes memory _updatedSigners = certificates[_certificateHash].signers;

    for(uint256 i = 0; i < _newSigners.length; i += 20) {
      address _signer;
      assembly {
        _signer := mload(add(_newSigners, add(0x14, i)))
      }
      if(_checkUniqueSigner(_signer, certificates[_certificateHash].signers)) {
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
      _getBytesStr(_certificateObj.data.length),
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

      require(_checkUniqueSigner(_signer, _certificateObj.signers), 'each signer should be unique');

      if(_allowedSignersOnly) {
        require(certifyingAuthorities[_signer].status == AuthorityStatus.Authorised, 'certifier not authorised');
      }

      _certificateObj.signers = abi.encodePacked(_certificateObj.signers, _signer);
    }
  }

  function _changeManager(address _newManagerAddress) private {
    manager = _newManagerAddress;
    emit ManagerUpdated(_newManagerAddress);
  }

  function _checkUniqueSigner(address _signer, bytes memory _packedSigners) private pure returns (bool){
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


  function _getBytesStr(uint i) private pure returns (bytes memory) {
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
