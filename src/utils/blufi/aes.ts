import CryptoJS from 'crypto-js'

/**
 * 使用 AES-CFB 对数据加密。
 *
 * @param data 明文字节
 * @param key 对称密钥
 * @param sequence 当前包序号，用于构造 IV
 */
export function encryptAES(data: Uint8Array, key: Uint8Array, sequence: number): Uint8Array {
  const iv = new Uint8Array(16)
  iv[0] = sequence

  const dataWords = CryptoJS.lib.WordArray.create(data as any)
  const keyWords = CryptoJS.lib.WordArray.create(key as any)
  const ivWords = CryptoJS.lib.WordArray.create(iv as any)

  const encrypted = CryptoJS.AES.encrypt(dataWords, keyWords, {
    iv: ivWords,
    mode: CryptoJS.mode.CFB,
    padding: CryptoJS.pad.NoPadding
  })

  const encryptedWords = encrypted.ciphertext
  const sigBytes = encryptedWords.sigBytes
  const words = encryptedWords.words
  const result = new Uint8Array(sigBytes)
  for (let i = 0; i < sigBytes; i++) {
    const byte = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff
    result[i] = byte
  }
  return result
}

/**
 * 使用 AES-CFB 对数据解密。
 *
 * @param data 密文字节
 * @param key 对称密钥
 * @param sequence 当前包序号，用于构造 IV
 */
export function decryptAES(data: Uint8Array, key: Uint8Array, sequence: number): Uint8Array {
  const iv = new Uint8Array(16)
  iv[0] = sequence

  const dataWords = CryptoJS.lib.WordArray.create(data as any)
  const keyWords = CryptoJS.lib.WordArray.create(key as any)
  const ivWords = CryptoJS.lib.WordArray.create(iv as any)

  const decrypted = CryptoJS.AES.decrypt(
    { ciphertext: dataWords } as any,
    keyWords,
    {
      iv: ivWords,
      mode: CryptoJS.mode.CFB,
      padding: CryptoJS.pad.NoPadding
    }
  )

  const sigBytes = decrypted.sigBytes
  const words = decrypted.words
  const result = new Uint8Array(sigBytes)
  for (let i = 0; i < sigBytes; i++) {
    const byte = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff
    result[i] = byte
  }
  return result
}

/**
 * 计算 MD5 摘要。
 */
export function md5(data: Uint8Array): Uint8Array {
  const dataWords = CryptoJS.lib.WordArray.create(data as any)
  const hash = CryptoJS.MD5(dataWords)

  const sigBytes = hash.sigBytes
  const words = hash.words
  const result = new Uint8Array(sigBytes)
  for (let i = 0; i < sigBytes; i++) {
    const byte = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff
    result[i] = byte
  }
  return result
}

/**
 * 计算 SHA-256 摘要。
 */
export function sha256(data: Uint8Array): Uint8Array {
  const dataWords = CryptoJS.lib.WordArray.create(data as any)
  const hash = CryptoJS.SHA256(dataWords)

  const sigBytes = hash.sigBytes
  const words = hash.words
  const result = new Uint8Array(sigBytes)
  for (let i = 0; i < sigBytes; i++) {
    const byte = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff
    result[i] = byte
  }
  return result
}
