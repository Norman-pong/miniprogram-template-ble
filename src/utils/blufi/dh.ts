/**
 * 计算 (base^exponent) mod modulus。
 */
export function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
  let result = BigInt(1)
  base = base % modulus
  while (exponent > BigInt(0)) {
    if (exponent % BigInt(2) === BigInt(1)) {
      result = (result * base) % modulus
    }
    exponent = exponent >> BigInt(1)
    base = (base * base) % modulus
  }
  return result
}

export const DH_P_1024 = "cf5cf5c38419a724957ff5dd323b9c45c3cdd261eb740f69aa94b8bb1a5c96409153bd76b24222d03274e4725a5406092e9e82e9135c643cae98132b0d95f7d65347c68afc1e677da90e51bbab5f5cf429c291b4ba39c6b2dc5e8c7231e46aa7728e87664532cdf547be20c9a3fa8342be6e34371a27c06f7dc0edddd2f86373";

export const DH_P_3072 = "FFFFFFFFFFFFFFFFADF85458A2BB4A9AAFDC5620273D3CF1D8B9C583CE2D3695A9E13641146433FBCC939DCE249B3EF97D2FE363630C75D8F681B202AEC4617AD3DF1ED5D5FD65612433F51F5F066ED0856365553DED1AF3B557135E7F57C935984F0C70E0E68B77E2A689DAF3EFE8721DF158A136ADE73530ACCA4F483A797ABC0AB182B324FB61D108A94BB2C8E3FBB96ADAB760D7F4681D4F42A3DE394DF4AE56EDE76372BB190B07A7C8EE0A6D709E02FCE1CDF7E2ECC03404CD28342F619172FE9CE98583FF8E4F1232EEF28183C3FE3B1B4C6FAD733BB5FCBC2EC22005C58EF1837D1683B2C6F34A26C1B2EFFA886B4238611FCFDCDE355B3B6519035BBC34F4DEF99C023861B46FC9D6E6C9077AD91D2691F7F7EE598CB0FAC186D91CAEFE130985139270B4130C93BC437944F4FD4452E2D74DD364F2E21E71F54BFF5CAE82AB9C9DF69EE86D2BC522363A0DABC521979B0DEADA1DBF9A42D5C4484E0ABCD06BFA53DDEF3C1B20EE3FD59D7C25E41D2B66C62E37FFFFFFFFFFFFFFFF";

export const DH_G = "2"

/**
 * 简化版 Diffie-Hellman 工具。
 */
export class DH {
  private p: bigint
  private g: bigint
  private privateKey: bigint
  public publicKey: bigint
  public sharedSecret: bigint | null = null
  public length: number

  /**
   * @param p 大素数 P（十六进制字符串或 bigint）
   * @param g 生成元 G（十六进制字符串或 bigint）
   * @param length 密钥位长
   */
  constructor(p: string | bigint, g: string | bigint, length: number = 1024) {
    this.p = typeof p === 'string' ? BigInt('0x' + p) : p
    this.g = typeof g === 'string' ? BigInt('0x' + g) : g
    this.length = length
    this.privateKey = this.generatePrivateKey()
    this.publicKey = modPow(this.g, this.privateKey, this.p)
  }

  public getP(): bigint {
    return this.p
  }

  public getG(): bigint {
    return this.g
  }

  /**
   * 生成随机私钥。
   */
  private generatePrivateKey(): bigint {
    const hex = Array.from({ length: 64 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('')
    return BigInt('0x' + hex) % (this.p - BigInt(2)) + BigInt(1)
  }

  public computeSharedSecret(otherPublicKey: string | bigint): bigint {
    const B = typeof otherPublicKey === 'string' ? BigInt('0x' + otherPublicKey) : otherPublicKey
    this.sharedSecret = modPow(B, this.privateKey, this.p)
    return this.sharedSecret
  }
}
