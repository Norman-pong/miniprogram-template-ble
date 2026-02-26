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
