/**
 * 计算 BluFi 使用的 CRC16(CCITT)。
 *
 * @param buffer 参与校验的字节序列（通常为 sequence + dataLength + clear data）
 * @param initialValue CRC 初始值，BluFi 默认 0x0000
 * @returns 16 位 CRC 值
 */
export function crc16(buffer: Uint8Array, initialValue: number = 0x0000): number {
  let crc = initialValue
  for (let i = 0; i < buffer.length; i++) {
    let byte = buffer[i]
    for (let j = 0; j < 8; j++) {
      const bit = ((byte >> (7 - j)) & 1) === 1
      const c15 = ((crc >> 15) & 1) === 1
      crc <<= 1
      if (c15 !== bit) {
        crc ^= 0x1021
      }
    }
  }
  return crc & 0xFFFF
}
