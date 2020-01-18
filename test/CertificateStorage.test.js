/*
  Author: Soham Zemse (https://github.com/zemse)

  In this file you should write tests for your smart contract as you progress in developing your smart contract. For reference of Mocha testing framework, you can check out https://devdocs.io/mocha/.
*/

/// @dev importing packages required
const assert = require('assert');
const ethers = require('ethers');
const ganache = require('ganache-cli');

/// @dev initialising development blockchain
const provider = new ethers.providers.Web3Provider(ganache.provider({ gasLimit: 8000000 }));

/// @dev importing build file
const certificateStorageJSON = require('../build/CertificateStorage_CertificateStorage.json');

/// @dev initialize global variables
let accounts, certificateStorageInstance;

const SIGNED_CERTIFICATE_LENGTH = (96 + 65) * 2 + 2;

const certifyingAuthorities = [
  [1, 'Blocklogy'],
  [2, 'Microsoft']
];

const certificateTestCase = {
  studentAccount: 3,
  studentName: 'Soham Zemse',
  courseName: 'Blockchain Developer Level 1',
  percentile: 78.36,
  extraData: '0x',
  signerAccounts: [1, 2]
};

async function parseTx(tx) {
  // console.log(await tx);
  const r = await (await tx).wait();
  const gasUsed = r.gasUsed.toNumber();
  console.log(`Gas used: ${gasUsed} / ${ethers.utils.formatEther(r.gasUsed.mul(ethers.utils.parseUnits('1','gwei')))} ETH / ${gasUsed / 50000} ERC20 transfers`);
  r.logs.forEach(log => {
    console.log(log.data);
  });
  return r;
}

function stringToBytes32(text) {
  // text = text.slice(0,32);
  if(text.length >= 32) throw new Error('only 32 chars allowed in bytes32');
  var result = ethers.utils.hexlify(ethers.utils.toUtf8Bytes(text));
  while (result.length < 66) { result += '0'; }
  if (result.length !== 66) { throw new Error("invalid web3 implicit bytes32"); }
  return result;
}

function bytesToString(bytes) {
  return ethers.utils.toUtf8String(bytes).split('\u0000').join('');
}

function encodeQualification(courseName, percentile=0) {
  if(courseName.length >= 30) throw new Error('only 30 chars allowed as courseName');
  const courseNameHex = stringToBytes32(courseName).slice(0,62);

  // 2 byte percentile can display upto 2 decimal accuracy
  const percentileMul100Hex = ethers.utils.hexlify(Math.floor(percentile*100));
  // console.log({courseNameHex,percentileMul100Hex});

  return ethers.utils.hexlify(ethers.utils.concat([courseNameHex, percentileMul100Hex]));
}

function decodeQualification(qualification) {
  if(qualification.slice(0,2) != '0x') throw new Error('hex string should start with 0x');
  // qualification = qualification.slice(2);
  const courseName = bytesToString(qualification.slice(0,62));
  const percentile = (+('0x'+qualification.slice(62,66)))/100;
  return {courseName, percentile};
}

/// @dev this is a test case collection
describe('Ganache Setup', async() => {

  /// @dev this is a test case. You first fetch the present state, and compare it with an expectation. If it satisfies the expectation, then test case passes else an error is thrown.
  it('initiates ganache and generates a bunch of demo accounts', async() => {

    /// @dev for example in this test case we are fetching accounts array.
    accounts = await provider.listAccounts();

    /// @dev then we have our expection that accounts array should be at least having 1 accounts
    assert.ok(accounts.length >= 1, 'atleast 2 accounts should be present in the array');
  });
});

/// @dev this is another test case collection
describe('Certificate Storage Contract', () => {

  /// @dev describe under another describe is a sub test case collection
  describe('Certificate Storage Setup', async() => {

    /// @dev this is first test case of this collection
    it('deploys Certificate Storage contract from first account', async() => {

      /// @dev you create a contract factory for deploying contract. Refer to ethers.js documentation at https://docs.ethers.io/ethers.js/html/
      const CertificateStorageContractFactory = new ethers.ContractFactory(
        certificateStorageJSON.abi,
        certificateStorageJSON.evm.bytecode.object,
        provider.getSigner(accounts[0])
      );
      certificateStorageInstance =  await CertificateStorageContractFactory.deploy();

      assert.ok(certificateStorageInstance.address, 'conract address should be present');
    });
  });

  describe('Certificate Storage Functionality', async() => {
    certifyingAuthorities.forEach(entry => {
      it(`Manager authorises ${entry[1]}`, async() => {
        const certifierName = entry[1];
        const nameBytes32 = stringToBytes32(certifierName);

        const certifierAddress = accounts[entry[0]];

        await parseTx(certificateStorageInstance.functions.addCertifyingAuthority(
          certifierAddress,
          nameBytes32
        ));

        const certifyingAuthority = await certificateStorageInstance.functions.certifyingAuthorities(certifierAddress);

        const formatedName = bytesToString(certifyingAuthority.name);
        // console.log({formatedName, name});
        assert.equal(formatedName, certifierName, 'name should be set properly');
        assert.equal(certifyingAuthority.isAuthorised, true, 'authorisation should be true by default');
      });
    });

    let signedCertificate;
    it('new certificate signed by account 1', async() => {
      const nameBytes32 = stringToBytes32(certificateTestCase.studentName);
      const qualificationBytes32 = encodeQualification(
        certificateTestCase.courseName,
        certificateTestCase.percentile
      );
      const extraDataBytes32 = ethers.utils.hexZeroPad(certificateTestCase.extraData, 32);

      const unsignedCertificateConcat = ethers.utils.hexlify(ethers.utils.concat([
        nameBytes32,
        qualificationBytes32,
        extraDataBytes32
      ]));

      const unsignedCertificateHash = ethers.utils.keccak256(
        ethers.utils.arrayify(unsignedCertificateConcat)
      );
      // console.log({unsignedCertificateConcat, unsignedCertificateHash});

      let signedCertificateConcat = unsignedCertificateConcat;
      const signers = [];
      for(const accId of certificateTestCase.signerAccounts) {
        const signer = provider.getSigner(accounts[accId]);
        signers.push(await signer.getAddress())
        const signature = await signer.signMessage(ethers.utils.arrayify(unsignedCertificateConcat));
        signedCertificateConcat = ethers.utils.concat([signedCertificateConcat, signature]);
      }

      const arg = ethers.utils.hexlify(signedCertificateConcat);
      signedCertificate = arg;

      console.log({
        nameBytes32,
        qualificationBytes32,
        extraDataBytes32,
        signedCertificate,
        signers
      });


      // assert.equal(signedCertificate.length, SIGNED_CERTIFICATE_LENGTH, 'invalid signed certificate length');
    });

    it('certificate is being submitted to contract from account 2', async() => {
      console.log({signedCertificate});
      const _certificateStorageInstance = certificateStorageInstance.connect(provider.getSigner(accounts[certificateTestCase.studentAccount]));

      await parseTx(certificateStorageInstance.functions.registerCertificate(signedCertificate));

      const certificateHash = ethers.utils.keccak256(signedCertificate);
      const certificate = await certificateStorageInstance.functions.certificates(certificateHash);
      console.log(certificate);

      const decodedQualification = decodeQualification(certificate.qualification);
      console.log(decodedQualification);

      assert.equal(bytesToString(certificate.name), certificateTestCase.studentName, 'student name should match on certificate');
      assert.equal(decodedQualification.courseName, certificateTestCase.courseName, 'course name should match on certificate');
      assert.equal(decodedQualification.percentile, certificateTestCase.percentile, 'course name should match on certificate');

      // const zemse = await certificateStorageInstance.functions.zemse();
      // console.log({zemse});
      //
      // assert.ok(certifyingAuthority.isAuthorised, 'certifier should be authorised');
    });
  });
});
