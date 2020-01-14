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

    /// @dev this is first test case of this collection
    it('new certificate', async() => {

      /// @dev you sign and submit a transaction to local blockchain (ganache) initialized on line 10.

      const message = 'hello';
      const messageBytes = ethers.utils.toUtf8Bytes(message);
      const messageHex = ethers.utils.hexZeroPad(ethers.utils.hexlify(messageBytes), 32);
      const messageHash = ethers.utils.keccak256(ethers.utils.arrayify(messageHex));
      const messageHashBytes = ethers.utils.arrayify(messageHash);
      const signer = provider.getSigner(accounts[0]);
      const signature = await signer.signMessage(messageHashBytes);
      const concat = ethers.utils.concat([messageHex, signature]);
      const arg = ethers.utils.hexlify(concat);
      const splitSig = ethers.utils.splitSignature(signature);
      console.log({message,messageBytes,messageHex,messageHash,signature,splitSig, arg, signer:await signer.getAddress()});

      // const response = await certificateStorageInstance.functions.recoverAddress(messageHash, splitSig.v, splitSig.r, splitSig.s);
      // console.log({messageHash, response});

      const tx = await certificateStorageInstance.functions.certify(arg);
      console.log({txData: tx.data});
      /// @dev you can wait for transaction to confirm
      const receipt = await tx.wait();
      console.log({logs: receipt.logs.map(log => log.data)});


      // const tx = await certificateStorageInstance.functions.testWorkaround();
      // console.log({txData: tx.data});
      // /// @dev you can wait for transaction to confirm
      // const receipt = await tx.wait();
      // console.log({logs: receipt.logs.map(log => log.data)})
      //
    });
  });
});
