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
const proxyJSON = require('../build/Proxy_Proxy.json');

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

// add float data type for arbitary entries
const dataTypes = [null, 'bytes', 'number', 'float', 'string', 'boolean', 'image', 'date'];
const order = ['name', 'subject', 'score', 'category'];

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
    case 'number':
      if(String(input).split('.')[1]) {
        return 'float';
      }
      return 'number';
    default:
      return typeof input;
  }
}

// remaining for image and data
// take number or string and convert it into bytes
function bytify(input, type) {
  switch(type || guessDataTypeFromInput(input)) {
    case 'bytes':
      return input;
    case 'number':
      hex = Number(input).toString(16);
      if(hex.length % 2 !== 0) {
          hex = '0'+hex;
      }
      return '0x' + hex;
    case 'float':
      const numberOfDecimals = (String(input).split('.')[1] || '').length;
      const decimalByte = bytify(numberOfDecimals, 'number').slice(2);
      if(decimalByte.length !== 2) throw new Error(`Invalid decimal byte: (${decimalByte})`);
      const numberWithoutDecimals = input * 10**numberOfDecimals;
      const numberBytes = bytify(numberWithoutDecimals, 'number').slice(2);
      return '0x' + decimalByte + numberBytes;
    case 'string':
      return ethers.utils.hexlify(ethers.utils.toUtf8Bytes(input));
    case 'boolean':
      return input ? '0x01' : '0x00';
    default:
      return null;
  }
}

function renderBytes(hex, type) {
  switch(type) {
    case 'bytes':
      return hex;
    case 'number':
      if(hex === '0x') return null;
      return +hex;
    case 'float':
      if(hex === '0x') return null;
      const decimals = +('0x'+hex.slice(2,4));
      const number = +('0x'+hex.slice(4));
      return number / 10**decimals;
    case 'string':
      return bytesToString(hex);
    case 'boolean':
      return !!(+hex);
    default:
      return hex;
  }
}

function isProperValue(input) {
  return ![undefined, null, NaN].includes(input);
}

function getCertificateHashFromDataRLP(certificateDataRLP) {
  const digest = ethers.utils.hexlify(ethers.utils.concat([ethers.utils.toUtf8Bytes('\x19Ethereum Signed Message:\n'+(certificateDataRLP.length/2 - 1)),certificateDataRLP]));
  return ethers.utils.keccak256(digest);
}

function encodeCertificateObject(obj, signature = []) {
  let signatureArray = typeof signature === 'object' ? signature : [signature];
  const entries = Object.entries(obj);
  const certRLPArray = [];

  // adding name and subject into rlpArray
  order.forEach(property => {
    if(property === 'score') {
      // adding score into rlpArray
      if(isProperValue(obj['score'])) {
        certRLPArray.push(bytify(+obj['score'], 'float'));
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
      certRLPArray[datatypeIndex] = certRLPArray[datatypeIndex] + '0';
    }

    certRLPArray[datatypeIndex] = '0x' + certRLPArray[datatypeIndex];
  }

  console.log(certRLPArray);
  const dataRLP = ethers.utils.RLP.encode(certRLPArray);
  return {
    fullRLP: ethers.utils.RLP.encode([certRLPArray, ...signatureArray]),
    dataRLP,
    certificateHash: getCertificateHashFromDataRLP(dataRLP)
  };
}

function addSignaturesToCertificateRLP(encodedFullCertificate, signature = []) {
  let signatureArray = typeof signature === 'object' ? signature : [signature];
  let certificateData;
  // console.log('zemse', {encodedFullCertificate, encodedCertificate});
  if(typeof encodedFullCertificate === 'object') {
    certificateData = ethers.utils.RLP.decode(encodedFullCertificate.dataRLP);
  } else {
    const decoded = ethers.utils.RLP.decode(encodedFullCertificate);
    certificateData = decoded[0];
    if(decoded.length > 1) {
      signatureArray = [...decoded.slice(1), ...signatureArray];
    }
  }
  // console.log({signatureArray});
  const dataRLP = ethers.utils.RLP.encode(certificateData);

  return {
    fullRLP: ethers.utils.RLP.encode([certificateData, ...signatureArray]),
    dataRLP,
    certificateHash: getCertificateHashFromDataRLP(dataRLP)
  };
}

function decodeCertificateData(encodedCertificate) {
  let fullRLP = typeof encodedCertificate === 'object' ? encodedCertificate.fullRLP : encodedCertificate;
  const decoded = ethers.utils.RLP.decode(fullRLP);
  const obj = {};

  let decodedCertificatePart, signatureArray;
  //checking if decoded is of fullRLP or certificate data part
  if(typeof decoded[0] === 'string') {
    decodedCertificatePart = decoded;
  } else {
    decodedCertificatePart = decoded[0];
    signatureArray = decoded.slice(1);
  }

  decodedCertificatePart.forEach((entry, i) => {
    if(i < order.length) {
      if(order[i] !== 'score') {
        obj[order[i]] = ethers.utils.toUtf8String(entry);
      } else {
        obj[order[i]] = renderBytes(entry, 'float');
      }
    } else if(i > order.length){
      const type = dataTypes[+('0x'+decodedCertificatePart[order.length].slice(1+i-order.length, 2+i-order.length))];
      // console.log({value: entry[1], type});
      obj[bytesToString(entry[0])] = renderBytes(entry[1], type);
    }
  });

  if(signatureArray) {
    let key = '_signatures';
    while(obj[key]) key = '_' + key;
    obj[key] = signatureArray;
  }

  return obj;
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
        // console.log({encodedCertificateObj});

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

        // test cases:
        const decoded = decodeCertificateData(encodedCertificateObj);
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

        const decodedCertificate = decodeCertificateData(certificate.data);
        console.log({decodedCertificate});

        console.log({signersInContract: parsePackedAddress(certificate.signers)});

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
