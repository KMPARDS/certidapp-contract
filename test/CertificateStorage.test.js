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

function bytes32ToString(bytes32) {
  return ethers.utils.toUtf8String(bytes32).split('\u0000').join('');
}

function encodePercentile(percentile=0) {
  // 2 byte percentile can display upto 2 decimal accuracy
  const percentileMul100Hex = ethers.utils.hexlify(Math.floor(percentile*100));
  // console.log({percentileMul100Hex});
  return percentileMul100Hex;
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

    // /// @dev this is second test case of this collection
    // it('value should be set properly while deploying', async() => {
    //
    //   /// @dev you access the value at storage with ethers.js library of our custom contract method called getValue defined in contracts/CertificateStorage.sol
    //   const currentValue = await certificateStorageInstance.functions.getValue();
    //
    //   /// @dev then you compare it with your expectation value
    //   assert.equal(
    //     currentValue,
    //     'hello world',
    //     'value set while deploying must be visible when get'
    //   );
    // });
  });

  describe('Certificate Storage Functionality', async() => {
    it('new certifying authority', async() => {
      const certifierName = 'Blocklogy';
      const nameBytes32 = stringToBytes32(certifierName);

      await parseTx(certificateStorageInstance.functions.addCertifyingAuthority(
        accounts[1],
        nameBytes32
      ));

      const certifyingAuthority = await certificateStorageInstance.functions.certifyingAuthorities(accounts[1]);

      const formatedName = bytes32ToString(certifyingAuthority.name);
      // console.log({formatedName, name});
      assert.equal(formatedName, certifierName, 'name should be set properly');
      assert.equal(certifyingAuthority.isAuthorised, true, 'authorisation should be true by default');
    });

    let signedCertificate;
    it('new certificate signed by account 1', async() => {
      const studentName = 'Soham Zemse';
      const nameBytes = ethers.utils.hexlify(ethers.utils.toUtf8Bytes(studentName));

      const certifiedAs = 'Blockchain Developer Level 1';
      const certifiedAsBytes = ethers.utils.hexlify(ethers.utils.toUtf8Bytes(certifiedAs));

      const percentile = 78.93;
      const percentileBytes = encodePercentile(percentile);

      const rawCertificate = [nameBytes, certifiedAsBytes, percentileBytes];
      const unsignedCertificateConcat = ethers.utils.hexlify(ethers.utils.concat(rawCertificate));
      const unsignedCertHash = ethers.utils.keccak256(unsignedCertificateConcat);
      console.log({nameBytes, certifiedAsBytes, percentileBytes, rawCertificate, unsignedCertificateConcat, unsignedCertHash});

      const signer = provider.getSigner(accounts[0]);
      const signature = await signer.signMessage(ethers.utils.arrayify(unsignedCertificateConcat));
      const splitSig = ethers.utils.splitSignature(signature);

      rawCertificate.push(ethers.utils.hexlify(splitSig.v));
      rawCertificate.push(splitSig.r);
      rawCertificate.push(splitSig.s);

      const signedCertificateRLP = ethers.utils.RLP.encode(rawCertificate);

      console.log({rawCertificate, signedCertificateRLP});

      await parseTx(certificateStorageInstance.functions.registerCertificate(signedCertificateRLP))

      // const tx = await certificateStorageInstance.functions.testWorkaround();
      // console.log({txData: tx.data});
      // /// @dev you can wait for transaction to confirm
      // const receipt = await tx.wait();
      // console.log({logs: receipt.logs.map(log => log.data)})
      //
    });
  });
});
