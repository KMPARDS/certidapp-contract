# CertiÐApp Smart Contract
Smart Contract based Certificate issuance and verification
User interface repository: https://github.com/KMPARDS/boa

### Challenges in traditional certificates
Though we are used to our traditional way of having certificates printed on a hard copy, it has some unminded challenges.

As a winner or performer or attender, we receive certificates from the organizers stating with various logos on it (for e.g. Microsoft) whose authority probably doesn't even know about that and wouldn't want unauthorized printing of certificates with use of their logo. How easy is it to download a logo from some website and print it on a piece of paper? How many copies can be made? Just like printed fiat can have fake counterparts circulating around which people unknowingly accept, there can be some unauthorized organizations giving certificates (for e.g. Microsoft certified) for fooling students to make some profit.

On the other side, students/candidates themselves can print a fake certificate on a 300 GSM paper and pose for being accepted to an organization (for e.g. job interview or college interview). As an HR or any verifier out there who is looking to filter candidates have only two options, either rely only on that piece of printed paper for accepting the candidate (who might have faked/forged certificate) or do not trust it by doing a retest of the same (which would consume more time in hiring process).

Though still, a possible workaround for certificate authority (issuer like Microsoft) to make a unique standard of printing which is difficult to print by normal printers and only a special printer can print such certificates (just like notes). This process only makes certificates slightly costlier or difficult to print (by using custom plates). This approach is similar to Security by Obscurity, in which it is assumed that the attacker does not have knowledge of the complexity used for printing. But an intelligent attacker might study the printed certificate and reverse engineer to develop a plate to produce similar print, such that it would be difficult to tell the difference in a genuine and fake certificate.

### CertiÐApp as a solution to above problems

CertiÐApp aims to solve the authenticity-related problems using Kerckhoff's Principle of Cryptography. Here, instead of having complicated and secret printing process, we use a publicly known Elliptic Curve Digital Signature Algorithm (ECDSA). Here every certifier needs to hold a secret key which they will use to generate signature for every certificate they would sign. Anyone else trying to fake someone's signature for a particular certificate would find it very difficult because odds of this happening is `1` in `1000000...(75 zeros)` tries.

## CertiÐApp Certificate Object Standard
Following properties are default in every certificate:
- `name` (Name of the candidate)
- `subject` (Main Subject for the Certificate, e.g. Blockchain Internship)
- `score` (Candidate Score if any, e.g. 79.32)
- `category` (Certificate Category e.g. Merit, Attendance)

An example of a certificate object:
```
> certificateObj = {
    name: 'John Doe',
    subject: 'Applied Thermodynamics',
    score: 40,
    category: 'Performance'
  }
```
Passing the object to a certificate encoder function:
```
> encoded = window._z.encodeCertificateObject({
    name: 'John Doe',
    subject: 'Applied Thermodynamics',
    score: 40,
    category: 'Performance'
  })
```
These four keys are kind of required and if they are not present, `null` value would be assumed for it.

This will generate following output:
```
> console.log(encoded);

{
  fullRLP: "0xf3f28b536f68616d205a656d7365964170706c69656420546865726d6f64796e616d6963738200288b506572666f726d616e6365",
  dataRLP: "0xf28b536f68616d205a656d7365964170706c69656420546865726d6f64796e616d6963738200288b506572666f726d616e6365",
  certificateHash: "0x659c002af8de84ff18f47466b009264af78360fac230e4c4bb292512b5ee246c"
}
```
Here, `fullRLP` is contains entire certificate information as well as signers information and is what should be submitted.

The `dataRLP` field contains only certificate information and it is what the wallet signers would encode as a message for signing based on [EIP712](https://eips.ethereum.org/EIPS/eip-712).

If we RLP decode dataRLP, we get nested arrays as:
```
> ethers.utils.RLP.decode('0xf28b536f68616d205a656d7365964170706c69656420546865726d6f64796e616d6963738200288b506572666f726d616e6365')
[
  "0x536f68616d205a656d7365",
  "0x4170706c69656420546865726d6f64796e616d696373",
  "0x0028",
  "0x506572666f726d616e6365"
]
```
Here, these entries represent `name`, `subject`, `score` and `category`. If we convert the 1st, 2nd and 4th hex strings to utf8 strings and 3rd hex string into number:
```
> _z.renderBytes('0x536f68616d205a656d7365', 'string')
"John Doe"

> _z.renderBytes('0x4170706c69656420546865726d6f64796e616d696373', 'string')
"Applied Thermodynamics"

> _z.renderBytes('0x0028', 'number')
40

> _z.renderBytes('0x506572666f726d616e6365', 'string')
"Performance"
```

### Custom keys in certificate object

Also, any key which is not in the standard can be added to the certificate object.

```
> window._z.encodeCertificateObject({
    name: 'John Doe',
    subject: 'Applied Thermodynamics',
    score: 40,
    category: 'Merit',
    date: '17/11/2018',
    attempts: 4
  })
```

For e.g. in the above example we include `roll` and `date` as extra data.

```
{
  fullRLP: "0xf872f8708b536f68616d205a656d7365964170706c69656420546865726d6f64796e616d696373820028854d65726974824420d084646174658a31372f31312f32303138e4886c6f636174696f6e9a446570742e206f66204d452c2049494553542053686962707572ca88617474656d70747304",
  dataRLP: "0xf8708b536f68616d205a656d7365964170706c69656420546865726d6f64796e616d696373820028854d65726974824420d084646174658a31372f31312f32303138e4886c6f636174696f6e9a446570742e206f66204d452c2049494553542053686962707572ca88617474656d70747304",
  certificateHash: "0x58bbff155d064cabe067c0df7f8b5de56730e29bbf91698435ad16ff3c29f6b4"
}
```

Now we decode the dataRLP:

```
> ethers.utils.RLP.decode('0xf8498b536f68616d205a656d7365964170706c69656420546865726d6f64796e616d696373820028854d6572697442d084646174658a31372f31312f32303138ca88617474656d70747304')

[
  "0x536f68616d205a656d7365",
  "0x4170706c69656420546865726d6f64796e616d696373",
  "0x0028",
  "0x4d65726974",
  "0x42",
  [
    "0x64617465",
    "0x31372f31312f32303138"
  ],
  [
    "0x617474656d707473",
    "0x04"
  ]
]
```
Here, we get first 4 elements as previous but new custom fields are added as arrays. After first 4 elements, we have extra data following up. The 5th one contains information about the data type (like `number`, `string`, `float`) of extra datas.
