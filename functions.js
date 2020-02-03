const ethers = require('ethers');
const bs58 = require('bs58');

const { dataTypes, certOrder, authOrder, extraDataTypes } = require('./env');

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
      let hex = Number(input).toString(16);
      if(hex.length % 2 !== 0) {
          hex = '0'+hex;
      }
      return '0x' + hex;
    case 'float':
      const numberOfDecimals = (String(input).split('.')[1] || '').length;
      const decimalByte = bytify(numberOfDecimals, 'number').slice(2);
      if(decimalByte.length !== 2) throw new Error(`Invalid decimal byte: (${decimalByte})`);
      const numberWithoutDecimals = Math.round(input * 10**numberOfDecimals);
      const numberBytes = bytify(numberWithoutDecimals, 'number').slice(2);
      return '0x' + decimalByte + numberBytes;
    case 'string':
      return ethers.utils.hexlify(ethers.utils.toUtf8Bytes(input));
    case 'boolean':
      return input ? '0x01' : '0x00';
    case 'base58':
      return '0x'+bs58.decode(input).toString('hex');
    case 'date':
      if(typeof input === 'string') {
        input = input.split('/').join('');
        if(isNaN(Number(input))) throw new Error(`Invalid Date Content (${input})`);
        if(String(input).length !== 8) throw new Error(`Date should have 8 digits (${input}) (length: ${String(input).length})`);
        if(String(input).split('.').length > 1) throw new Error(`Date should have no decimal point (${input})`);
        return bytify(input, 'number');
      } else if(typeof input === 'object' && input instanceof Date && !isNaN(input)) {
        let dateStr = String(input.getDate());
        if(dateStr.length < 2) dateStr = '0'+dateStr;
        let monthStr = String(input.getMonth()+1);
        if(monthStr.length < 2) monthStr = '0'+monthStr;
        let yearStr = String(input.getFullYear());
        return bytify(`${dateStr}/${monthStr}/${yearStr}`, 'date');
      } else {
        throw new Error('Invalid Date Type ' + typeof input);
      }
    case 'datetime':
      if(typeof input === 'string') {
        input = (new Date(input)).getTime();
      }
      return bytify(input, 'number');
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
    case 'base58':
      if(hex.slice(0,2) === '0x') hex = hex.slice(2);
      return bs58.encode(Buffer.from(hex, 'hex'));
    case 'date':
      let date = String(renderBytes(hex, 'number'));
      if(date.length < 8) date = '0' + date;
      return date.slice(0,2)+'/'+date.slice(2,4)+'/'+date.slice(4,8);
    case 'datetime':
      return (new Date(renderBytes(hex, 'number'))).toLocaleString();
    default:
      return hex;
  }
}

function isProperValue(input) {
  return ![undefined, null, NaN].includes(input);
}

function isFullRLP(certificateHex) {
  const decoded = ethers.utils.RLP.decode(certificateHex);
  return typeof decoded[0] !== 'string';
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
  certOrder.forEach(property => {
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

  const extraData = entries.filter(property => !certOrder.includes(property[0]) && isProperValue(property[1]));

  if(extraData.length) {
    // pushing datatype storage of the extra datas
    certRLPArray.push('');
    const datatypeIndex = certRLPArray.length - 1;
    extraData.forEach(property => {
      const dataType = extraDataTypes[property[0]] || guessDataTypeFromInput(property[1]);
      certRLPArray[datatypeIndex] = certRLPArray[datatypeIndex]
        + getDataTypeHexByte(dataType);
      certRLPArray.push([bytify(property[0]), bytify(property[1], dataType)]);
    });

    if(certRLPArray[datatypeIndex].length % 2) {
      certRLPArray[datatypeIndex] = certRLPArray[datatypeIndex] + '0';
    }

    certRLPArray[datatypeIndex] = '0x' + certRLPArray[datatypeIndex];
  }

  // console.log(certRLPArray);
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
  // console.log('in addsig',{encodedFullCertificate, signature});
  if(typeof encodedFullCertificate === 'object') {
    if(encodedFullCertificate.dataRLP) {
      certificateData = ethers.utils.RLP.decode(encodedFullCertificate.dataRLP);
    } else {
      certificateData = ethers.utils.RLP.decode(encodedFullCertificate.fullRLP)[0];
    }
  } else {
    const decoded = ethers.utils.RLP.decode(encodedFullCertificate);
    certificateData = isFullRLP(encodedFullCertificate) ? decoded[0] : decoded;
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
  const parsedCertificate = {};

  let decodedCertificatePart, signatureArray;
  //checking if decoded is of fullRLP or certificate data part
  if(typeof decoded[0] === 'string') {
    decodedCertificatePart = decoded;
  } else {
    decodedCertificatePart = decoded[0];
    signatureArray = decoded.slice(1);
  }

  decodedCertificatePart.forEach((entry, i) => {
    if(i < certOrder.length) {
      if(certOrder[i] !== 'score') {
        parsedCertificate[certOrder[i]] = ethers.utils.toUtf8String(entry);
      } else {
        parsedCertificate[certOrder[i]] = renderBytes(entry, 'float');
      }
    } else if(i > certOrder.length){
      const type = dataTypes[+('0x'+decodedCertificatePart[certOrder.length].slice(1+i-certOrder.length, 2+i-certOrder.length))];
      // console.log({value: entry[1], type});
      parsedCertificate[bytesToString(entry[0])] = renderBytes(entry[1], type);
    }
  });

  const returnObj = { parsedCertificate };

  returnObj.certificateHash = getCertificateHashFromDataRLP(ethers.utils.RLP.encode(decodedCertificatePart));

  if(signatureArray) {
    returnObj.signatures = signatureArray;
  }

  return returnObj;
}

function encodeCertifyingAuthority(obj) {
  const entries = Object.entries(obj);
  const rlpArray = [];

  authOrder.forEach(property => {
    const hex = isProperValue(obj[property]) ? bytify(obj[property]) : '0x';
    rlpArray.push(hex);
  });

  const extraData = entries.filter(property => !authOrder.includes(property[0]) && isProperValue(property[1]));

  if(extraData.length) {
    // pushing datatype storage of the extra datas
    rlpArray.push('');
    const datatypeIndex = rlpArray.length - 1;
    extraData.forEach(property => {
      const dataType = extraDataTypes[property[0]] || guessDataTypeFromInput(property[1]);
      rlpArray[datatypeIndex] = rlpArray[datatypeIndex]
        + getDataTypeHexByte(dataType);
      rlpArray.push([bytify(property[0]), bytify(property[1], dataType)]);
    });

    if(rlpArray[datatypeIndex].length % 2) {
      rlpArray[datatypeIndex] = rlpArray[datatypeIndex] + '0';
    }

    rlpArray[datatypeIndex] = '0x' + rlpArray[datatypeIndex];
  }

  // console.log(rlpArray);
  return ethers.utils.RLP.encode(rlpArray);
}

function decodeCertifyingAuthority(encodedAuthorityData) {
  const obj = {};
  const decoded = ethers.utils.RLP.decode(encodedAuthorityData);
  decoded.forEach((entry, i) => {
    if(i < authOrder.length) {
      obj[authOrder[i]] = ethers.utils.toUtf8String(entry);
    } else if(i > authOrder.length){
      const type = dataTypes[+('0x'+decoded[authOrder.length].slice(1+i-authOrder.length, 2+i-authOrder.length))];
      // console.log({value: entry[1], type});
      obj[bytesToString(entry[0])] = renderBytes(entry[1], type);
    }
  });
  return obj;
}

async function getCertificateObjFromCertificateHashAsync(certificateHash) {
  const logs = await window.provider.getLogs({
    address: certificateContract.address,
    fromBlock: 0,
    toBlock: 'latest',
    topics: [ethers.utils.id('Certified(bytes32,address)'), certificateHash]
  });

  if(!logs.length) this.setState({ displayText: 'Certificate not yet registered or it does not exist' });

  let certificateObj, txHashArray = [];

  for(const log of logs) {
    const txHash = log.transactionHash;
    const transaction = await window.provider.getTransaction(txHash);
    const arg = window.certificateContractInstance.interface.decodeFunctionData('registerCertificate(bytes)',transaction.data)[0];

    const decoded = decodeCertificateData(arg);
    // console.log({decoded, arg})

    if(!certificateObj) {
      certificateObj = {
        fullRLP: arg,
        ...decoded
      };
    } else {
      // console.log('in else', {certificateObj, certObjExpand: addSignaturesToCertificateRLP(
      //   certificateObj,
      //   decoded.signatures
      // )});
      certificateObj = {
        ...certificateObj,
        ...addSignaturesToCertificateRLP(
          certificateObj,
          decoded.signatures
        ),
        signatures: decoded.signatures
      };
    }

    // console.log({certificateObj});
    txHashArray.push(txHash);
  }

  certificateObj.txHashArray = txHashArray;

  return certificateObj;
}

function toTitleCase(str) {
  return str.split(' ').map(str1 => str1.slice(0,1).toUpperCase()+str1.slice(1)).join(' ');
}

function toWebsiteURL(website) {
  if(website.slice(0,4) !== 'http') {
    website = 'http://' + website;
  }
  return website;
}

module.exports = {
  bytesToString,
  parsePackedAddress,
  getDataTypeHexByte,
  guessDataTypeFromInput,
  bytify,
  renderBytes,
  isProperValue,
  isFullRLP,
  getCertificateHashFromDataRLP,
  encodeCertificateObject,
  addSignaturesToCertificateRLP,
  decodeCertificateData,
  encodeCertifyingAuthority,
  decodeCertifyingAuthority,
  getCertificateObjFromCertificateHashAsync,
  toTitleCase,
  toWebsiteURL
};
