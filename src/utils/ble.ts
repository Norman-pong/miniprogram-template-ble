/**
 * 将十六进制字符串转换为 ArrayBuffer
 * @param str 输入的十六进制字符串
 * @returns 转换后的 ArrayBuffer
 */
export const hexStringToBuffer = (str: string) => {
  if (!str) return new ArrayBuffer(0)
  const hex = str.replace(/\s+/g, '')
  const typedArray = new Uint8Array(hex.match(/[\da-f]{2}/gi)?.map((h) => parseInt(h, 16)) || [])
  return typedArray.buffer
}

/**
 * 将 ArrayBuffer 转换为十六进制字符串
 * @param buffer 输入的 ArrayBuffer
 * @returns 转换后的十六进制字符串
 */
export const bufferToHex = (buffer: ArrayBuffer) => {
  return Array.prototype.map.call(new Uint8Array(buffer), (x: any) => ('00' + x.toString(16)).slice(-2)).join('').toUpperCase()
}

/**
 * 将字符串转换为 UTF-8 编码的 ArrayBuffer
 * @param str 输入字符串
 * @returns ArrayBuffer
 */
export const stringToBuffer = (str: string) => {
  if (typeof TextEncoder !== 'undefined') {
    const encoder = new TextEncoder()
    return encoder.encode(str).buffer
  }

  // Fallback for environments without TextEncoder
  let arr: number[] = []
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i)
    if (code < 0x80) {
      arr.push(code)
    } else if (code < 0x800) {
      arr.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
    } else if (code < 0xd800 || code >= 0xe000) {
      arr.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
    } else {
      i++
      code = 0x10000 + (((code & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff))
      arr.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      )
    }
  }
  return new Uint8Array(arr).buffer
}
