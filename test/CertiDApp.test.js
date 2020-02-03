/*
  Author: Soham Zemse (https://github.com/zemse)

  In this file you should write tests for your smart contract as you progress in developing your smart contract. For reference of Mocha testing framework, you can check out https://devdocs.io/mocha/.
*/

/// @dev importing packages required
const assert = require('assert');
const ethers = require('ethers');
const bs58 = require('bs58');
const ganache = require('ganache-cli');

/// @dev initialising development blockchain
const provider = new ethers.providers.Web3Provider(ganache.provider({ gasLimit: 8000000 }));

/// @dev importing build file
const certificateStorageJSON = require('../build/CertiDApp_CertiDApp.json');
const proxyJSON = require('../build/Proxy_Proxy.json');

const _z = require('../functions');

/// @dev initialize global variables
let accounts, certificateStorageInstance;

const SIGNED_CERTIFICATE_LENGTH = (96 + 65) * 2 + 2;

const certifyingAuthorities = [
  {
    account: 1,
    obj: {
      name: 'Blocklogy',
      website: 'blocklogy.org',
      image: 'Qm'
    }
  },
  {
    account: 2,
    obj: {
      name: 'Microsoft',
    }
  },
  // {
  //   account: 2,
  //   status: 3,
  //   obj: {
  //     name: 'Microsoft',
  //   }
  // },
  {
    account: 3,
    obj: {
      name: 'Google',
    }
  },
  {
    account: 4,
    obj: {
      name: 'Apple',
    }
  }
];

const certificateTestCases = [
  {
    studentAccount: 5,
    signerAccounts: [1,2,3,4],
    certificateObj: {
      name: 'Soham Zemse',
      subject: '5 Days FDP on Blockchain',
      score: 78764545.12939485,
      category: 'Completion',
      id: 51000.223455,
      id2: 51000,
      id3: '51000',
      id4: false,
      id5: true
    }
  },
  // {
  //   studentAccount: 5,
  //   studentName: 'Soham Zemse',
  //   courseName: 'Blockchain Developer Level 1',
  //   percentile: 78.36,
  //   extraData: '0x',
  //   signerAccounts: [1,2]
  // }
];

async function parseTx(tx) {
  // console.log(await tx);
  const r = await (await tx).wait();
  const gasUsed = r.gasUsed.toNumber();
  console.group();
  console.log(`Gas used: ${gasUsed} / ${ethers.utils.formatEther(r.gasUsed.mul(ethers.utils.parseUnits('1','gwei')))} ETH / ${gasUsed / 50000} ERC20 transfers`);
  r.logs.forEach(log => {
    console.log('data', log.data);
    if(log.topics.length > 1) {
      console.log('topics', log.topics);
    }
  });
  console.groupEnd();
  return r;
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
      console.log(await certificateStorageInstance.functions.manager());

      assert.ok(certificateStorageInstance.address, 'conract address should be present');
    });

    it('deploys Proxy contract from first account', async() => {

      /// @dev you create a contract factory for deploying contract. Refer to ethers.js documentation at https://docs.ethers.io/ethers.js/html/
      const ProxyContractFactory = new ethers.ContractFactory(
        proxyJSON.abi,
        proxyJSON.evm.bytecode.object,
        provider.getSigner(accounts[0])
      );
      const proxyContractInstance =  await ProxyContractFactory.deploy();
      assert.ok(proxyContractInstance.address, 'conract address should be present');

      await parseTx(proxyContractInstance.functions.upgradeTo('v1', certificateStorageInstance.address));

      const implementation = await proxyContractInstance.functions.implementation();
      // console.log(implementation, certificateStorageInstance.address);
      assert.equal(implementation, certificateStorageInstance.address, 'implementation address should be set');

      certificateStorageInstance = new ethers.Contract(
        proxyContractInstance.address,
        certificateStorageJSON.abi,
        provider.getSigner(accounts[0])
      )
    });
  });

  describe('Certificate Storage Functionality', async() => {
    certifyingAuthorities.forEach(entry => {
      it(`Manager authorises ${entry.obj.name} (Account: ${entry.account})`, async() => {
        const encoded = _z.encodeCertifyingAuthority(entry.obj);

        const certifierAddress = accounts[entry.account];

        await parseTx(certificateStorageInstance.functions.updateCertifyingAuthority(
          certifierAddress,
          encoded,
          entry.status || 1
        ));

        const certifyingAuthority = await certificateStorageInstance.functions.certifyingAuthorities(certifierAddress);
        // console.log({certifyingAuthority});

        const parsedAuthority = _z.decodeCertifyingAuthority(certifyingAuthority.data);

        for(const key in entry.obj) {
          assert.equal(entry.obj[key], parsedAuthority[key], 'name should be set properly');
        }
        assert.equal(certifyingAuthority.status, 1, 'authorisation should be 1 (Authorised) by default');
      });
    });

    certificateTestCases.forEach(certificateTestCase => {
      let encodedCertificateObj;
      it('new certificate signed by account 1', async() => {
        encodedCertificateObj = _z.encodeCertificateObject(certificateTestCase.certificateObj);
        // console.log({encodedCertificateObj});

        const unsignedCertificateHash = encodedCertificateObj.certificateHash;

        const signers = [];
        for(const accId of certificateTestCase.signerAccounts) {
          const signer = provider.getSigner(accounts[accId]);
          signers.push(await signer.getAddress())
          // console.log(encodedCertificateObj.dataRLP);
          const signature = await signer.signMessage(ethers.utils.arrayify(encodedCertificateObj.dataRLP));
          encodedCertificateObj = _z.addSignaturesToCertificateRLP(encodedCertificateObj, signature);
        }

        console.log({
          encodedCertificateObj,
          signers
        });

        // test cases:
        const decoded = _z.decodeCertificateData(encodedCertificateObj).parsedCertificate;
        Object.keys(certificateTestCase.certificateObj).forEach(key => {
          assert.equal(decoded[key], certificateTestCase.certificateObj[key], `invalid ${key} key`);
        });
      });

      it(`certificate is being submitted to contract from account ${certificateTestCase.studentAccount}`, async() => {
        const _certificateStorageInstance = certificateStorageInstance.connect(provider.getSigner(accounts[certificateTestCase.studentAccount]));

        await parseTx(certificateStorageInstance.functions.registerCertificate(encodedCertificateObj.fullRLP));

        const unsignedCertificate = encodedCertificateObj.dataRLP;
        const certificateHash = encodedCertificateObj.certificateHash;
        // console.log({certificateHash, unsignedCertificate});

        const certificate = await certificateStorageInstance.functions.certificates(certificateHash);
        // console.log(certificate);

        const decodedCertificate = _z.decodeCertificateData(certificate.data).parsedCertificate;
        console.log({decodedCertificate});

        console.log({signersInContract: _z.parsePackedAddress(certificate.signers)});

        Object.keys(certificateTestCase.certificateObj).forEach(key => {
          assert.equal(decodedCertificate[key], certificateTestCase.certificateObj[key], `invalid ${key} key`);
        });


        //
        // assert.ok(certifyingAuthority.isAuthorised, 'certifier should be authorised');
      });
      // it('zemse', async() => {
      //   // let previousGas = 0;
      //   // for(let i = 0; i <= 128; i++) {
      //   //   const randomBytes = ethers.utils.randomBytes(i);
      //   //   const gas = (await certificateStorageInstance.estimate.writeToSz(randomBytes)).toNumber();
      //   //   console.log({i, gas, diff: gas - previousGas});
      //   //   previousGas = gas;
      //   //   // console.log({});
      //   // }
      //   const zemse = await certificateStorageInstance.functions.zemse();
      //   console.log({zemse});
      // });
    });
  });
});
