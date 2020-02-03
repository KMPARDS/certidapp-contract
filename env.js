const certificateStorageJSON = require('./build/CertificateStorage_CertificateStorage.json');

const env = {
  network: 'kovan',
  certificateContract: {
    address: '0x34AEA1D67C5484133BeE0E60aEbB9882a772f64B',
    abi: certificateStorageJSON.abi
  },
  dataTypes: [null, 'bytes', 'number', 'float', 'string', 'boolean', 'base58', 'date', 'datetime'],
  certOrder: ['name', 'subject', 'score', 'category'],
  authOrder: ['name', 'website'],
  extraDataTypes: { ///comments // recommendations //file //expires
    image: 'base58',
    file: 'base58',
    url: 'string',
    date1: 'date',
    date2: 'date',
    location: 'string',
    datetime1: 'datetime',
    datetime2: 'datetime',
    comments: 'string'
  },
  extraDataKeysExample: {
    url: 'google.com',
    comments: 'Student was very hardworking.',
    location: 'Institute Hall, IIEST Shibpur, Howrah'
  },
  dataTypesExample: {
    base58: 'IPFS Hash like QmQ9kasfzNTwbxGXSRyCp1WFdBXScpHNKDjrUPSWw3VR4z',
    date: 'DD/MM/YYYY like 23/01/2020',
    datetime: 'Unix timestamp like 1580476565'
  },
  managerAddress: '0xc8e1f3b9a0cdfcef9ffd2343b943989a22517b26',
  TX_STATUS_ENUM: {
    NOT_INITIATED: 0,
    SIGNING: 1,
    WAITING_FOR_CONFIRMATION: 2,
    CONFIRMED: 3
  },
};

module.exports = env;
