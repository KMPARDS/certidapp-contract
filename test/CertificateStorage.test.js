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
  [2, 'Microsoft'],
  [3, 'Google'],
  [4, 'Apple']
];

const certificateTestCases = [
  {
    studentAccount: 5,
    signerAccounts: [1,2],
    certificateObj: {
      name: 'Soham Zemse',
      subject: '5 Days FDP on Blockchain',
      score: 78.36,
      category: 'Completion',
      id: 51000
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

function bytesToString(bytes) {
  return ethers.utils.toUtf8String(bytes).split('\u0000').join('');
}

function parsePackedAddress(packedAddresses) {
  if(packedAddresses.slice(0,2).toLowerCase() === '0x') packedAddresses = packedAddresses.slice(2);
  if(packedAddresses.length%40 !== 0) throw new Error('Invalid packed addresses');
  const addressArray = [];
  for(let i = 0; i < packedAddresses.length/40; i++) {
    addressArray.push('0x'+packedAddresses.slice(0+40*i,40+40*i));
  }
  return addressArray;
}

// default parameters {name, subject, score} = obj
// extra parameters can be added which can have data types:
// 0 is not considered because it is used for padding
// 0001 => bytes
// 0010 => number
// 0011 => string
// 0100 => boolean
// 0101 => image
// 0110 => date timestamp
const dataTypes = [null, 'bytes', 'number', 'string', 'boolean', 'image', 'date'];

function getDataTypeHexByte(type) {
  const index = dataTypes.indexOf(type);
  if(index === -1) throw new Error('Invalid certificate data type: ' + type);
  return index.toString(16);
}

function guessDataTypeFromInput(input) {
  switch(typeof input) {
    case 'string':
      if(input.slice(0,2) === '0x') {
        return 'bytes';
      }
      return 'string';
    default:
      return typeof input;
  }
}

// remaining for image and data
// take number or string and convert it into bytes
function bytify(input) {
  switch(guessDataTypeFromInput(input)) {
    case 'bytes':
      return input;
    case 'number':
      hex = Number(input).toString(16);
      if(hex.length % 2 !== 0) {
          hex = '0'+hex;
      }
      return '0x' + hex;
    case 'string':
      return ethers.utils.hexlify(ethers.utils.toUtf8Bytes(input));
    case 'boolean':
      return input ? '0x01' : '0x00';
    default:
      return null;
  }
}

function isProperValue(input) {
  return ![undefined, null, NaN].includes(input);
}

function encodeCertificateObject(obj) {
  const order = ['name', 'subject', 'score', 'category'];
  const entries = Object.entries(obj);
  const certRLPArray = [];

  // adding name and subject into rlpArray
  order.forEach(property => {
    if(property === 'score') {
      // adding score into rlpArray
      if(isProperValue(obj['score'])) {
        const numberOfDecimals = (String(obj['score']).split('.')[1] || '').length;
        if(numberOfDecimals <= 2) {
          certRLPArray.push(bytify((+obj['score']) * 10**2));
        } else {
          certRLPArray.push([bytify(numberOfDecimals), bytify((+obj['score']) * 10**numberOfDecimals)])
        }
      } else {
        certRLPArray.push('0x');
      }
    } else {
      const hex = isProperValue(obj[property]) ? bytify(obj[property]) : '0x';
      certRLPArray.push(hex);
    }
  });

  const extraData = entries.filter(property => !order.includes(property[0]) && isProperValue(property[1]));

  if(extraData.length) {
    // pushing datatype storage of the extra datas
    certRLPArray.push('');
    const datatypeIndex = certRLPArray.length - 1;
    extraData.forEach(property => {
      certRLPArray[datatypeIndex] = certRLPArray[datatypeIndex] + getDataTypeHexByte(guessDataTypeFromInput(property[1]));
      certRLPArray.push([bytify(property[0]), bytify(property[1])]);
    });

    if(certRLPArray[datatypeIndex].length % 2) {
      certRLPArray[datatypeIndex] = '0' + certRLPArray[datatypeIndex];
    }

    certRLPArray[datatypeIndex] = '0x' + certRLPArray[datatypeIndex];
  }

  console.log(certRLPArray);
  const dataRLP = ethers.utils.RLP.encode(certRLPArray);
  const digest = ethers.utils.hexlify(ethers.utils.concat([ethers.utils.toUtf8Bytes('\x19Ethereum Signed Message:\n'+(dataRLP.length/2 - 1)),dataRLP]));
  // console.log({zemse});
  return {
    fullRLP: ethers.utils.RLP.encode([certRLPArray]),
    dataRLP,
    certificateHash: ethers.utils.keccak256(digest)
  };
}

function addSignaturesToCertificateRLP(encodedFullCertificate, signature = []) {
  let signatureArray = typeof signature === 'object' ? signature : [signature];
  let certificateData;
  if(typeof encodedCertificate === 'object') {
    certificateData = ethers.utils.RLP.decode(encodedCertificate.dataRLP);
  } else {
    const decoded = ethers.utils.RLP.decode(encodedFullCertificate.fullRLP);
    certificateData = decoded[0];
    if(decoded.length > 1) {
      signatureArray = [...decoded.slice(1), ...signatureArray];
    }
  }
  // console.log({signatureArray});
  const dataRLP = ethers.utils.RLP.encode(certificateData);
  const digest = ethers.utils.hexlify(ethers.utils.concat([ethers.utils.toUtf8Bytes('\x19Ethereum Signed Message:\n'+(dataRLP.length/2 - 1)),dataRLP]));
  return {
    fullRLP: ethers.utils.RLP.encode([certificateData, ...signatureArray]),
    dataRLP,
    certificateHash: ethers.utils.keccak256(digest)
  };
}

function decodeCertificate(encodedCertificate) {
  let fullRLP = typeof encodedCertificate === 'object' ? encodedCertificate.fullRLP : encodedCertificate;
  const decoded = ethers.utils.RLP.decode(encodedFullCertificate.fullRLP);
  const order = ['name', 'subject', 'score', 'category'];
  const obj = {};

  decoded[0].forEach((entry, i) => {
    if(i < order.length) {
      if(order[i] !== 'score') {
        obj[order[i]] = ethers.utils.toUtfyString(entry);
      } else {
        if(typeof decoded[0][i] === 'object') {
          const decimals = +entry[0];
          obj[order[i]] = +entry[1] / 10**decimals;
        } else {
          obj[order[i]] = +entry / 10**2;
        }
      }
    } else {
      // (entry[0])
    }
  });
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
        const nameBytes = bytify(certifierName);

        const certifierAddress = accounts[entry[0]];

        await parseTx(certificateStorageInstance.functions.addCertifyingAuthority(
          certifierAddress,
          nameBytes
        ));

        const certifyingAuthority = await certificateStorageInstance.functions.certifyingAuthorities(certifierAddress);

        const formatedName = bytesToString(certifyingAuthority.data);
        // console.log({formatedName, name});
        assert.equal(formatedName, certifierName, 'name should be set properly');
        assert.equal(certifyingAuthority.isAuthorised, true, 'authorisation should be true by default');
      });
    });

    certificateTestCases.forEach(certificateTestCase => {
      let encodedCertificateObj;
      it('new certificate signed by account 1', async() => {
        encodedCertificateObj = encodeCertificateObject(certificateTestCase.certificateObj);
        console.log({encodedCertificateObj});

        const unsignedCertificateHash = encodedCertificateObj.certificateHash;

        const signers = [];
        for(const accId of certificateTestCase.signerAccounts) {
          const signer = provider.getSigner(accounts[accId]);
          signers.push(await signer.getAddress())
          // console.log(encodedCertificateObj.dataRLP);
          const signature = await signer.signMessage(ethers.utils.arrayify(encodedCertificateObj.dataRLP));
          encodedCertificateObj = addSignaturesToCertificateRLP(encodedCertificateObj, signature);
        }

        console.log({
          encodedCertificateObj,
          signers
        });


        // assert.equal(signedCertificate.length, SIGNED_CERTIFICATE_LENGTH, 'invalid signed certificate length');
      });

      it('certificate is being submitted to contract from account 2', async() => {
        const _certificateStorageInstance = certificateStorageInstance.connect(provider.getSigner(accounts[certificateTestCase.studentAccount]));

        await parseTx(certificateStorageInstance.functions.registerCertificate(encodedCertificateObj.fullRLP));

        const unsignedCertificate = encodedCertificateObj.dataRLP;
        const certificateHash = encodedCertificateObj.certificateHash;
        // console.log({certificateHash, unsignedCertificate});

        const certificate = await certificateStorageInstance.functions.certificates(certificateHash);
        console.log(certificate);

        // const decodedQualification = decodeQualification(certificate.qualification);
        // console.log(decodedQualification);

        console.log({signersInContract: parsePackedAddress(certificate.signers)});

        // assert.equal(bytesToString(certificate.name), certificateTestCase.studentName, 'student name should match on certificate');
        // assert.equal(decodedQualification.courseName, certificateTestCase.courseName, 'course name should match on certificate');
        // assert.equal(decodedQualification.percentile, certificateTestCase.percentile, 'course name should match on certificate');


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
