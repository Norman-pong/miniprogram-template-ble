import { crc16 } from './crc'

/**
 * BluFi 协议包结构。
 */
export interface Packet {
  type: number
  subtype: number
  encrypted: boolean
  checksum: boolean
  direction: number
  requireAck: boolean
  fragment: boolean
  sequence: number
  data: Uint8Array
  crc?: number
}

/**
 * 创建一个 BluFi 协议包对象（未编码）。
 *
 * @param type 包类型（控制包/数据包）
 * @param subtype 子类型（高 6 bit）
 * @param sequence 序号（0~255）
 * @param data 数据区
 * @param encrypted 是否加密
 * @param checksum 是否追加 CRC16
 * @param direction 方向位（0 手机->设备，1 设备->手机）
 * @param requireAck 是否要求 ACK
 * @param fragment 是否还有后续分片
 */
export function createPacket(
  type: number,
  subtype: number,
  sequence: number,
  data: Uint8Array,
  encrypted: boolean = false,
  checksum: boolean = false,
  direction: number = 0,
  requireAck: boolean = false,
  fragment: boolean = false
): Packet {
  return {
    type,
    subtype,
    encrypted,
    checksum,
    direction,
    requireAck,
    fragment,
    sequence,
    data
  }
}

/**
 * 将协议包编码为字节流。
 *
 * @param packet 协议包对象
 * @param customChecksum 自定义 CRC（加密场景可传明文 CRC）
 */
export function pack(packet: Packet, customChecksum?: number): Uint8Array {
  const byte0 = (packet.type & 0x03) | ((packet.subtype & 0x3F) << 2)

  let byte1 = 0
  if (packet.encrypted) byte1 |= 0x01
  if (packet.checksum) byte1 |= 0x02
  if (packet.direction) byte1 |= 0x04
  if (packet.requireAck) byte1 |= 0x08
  if (packet.fragment) byte1 |= 0x10

  const byte2 = packet.sequence & 0xFF
  const byte3 = packet.data.length & 0xFF
  const header = new Uint8Array([byte0, byte1, byte2, byte3])
  const len = 4 + packet.data.length + (packet.checksum ? 2 : 0)
  const buffer = new Uint8Array(len)
  buffer.set(header, 0)
  buffer.set(packet.data, 4)

  if (packet.checksum) {
    let crc = 0
    if (customChecksum !== undefined) {
      crc = customChecksum
    } else {
      const checksumData = buffer.subarray(2, 4 + packet.data.length)
      crc = crc16(checksumData)
    }

    buffer[4 + packet.data.length] = crc & 0xFF
    buffer[4 + packet.data.length + 1] = (crc >> 8) & 0xFF
  }

  return buffer
}

/**
 * 从字节流解析 BluFi 协议包。
 *
 * 注意：
 * - 明文包会在此处直接校验 CRC；
 * - 加密包的 CRC 需要在上层解密后再次验证。
 */
export function unpack(buffer: Uint8Array): Packet | null {
  if (buffer.length < 4) return null

  const byte0 = buffer[0]
  const type = byte0 & 0x03
  const subtype = (byte0 >> 2) & 0x3F

  const byte1 = buffer[1]
  const encrypted = (byte1 & 0x01) !== 0
  const checksum = (byte1 & 0x02) !== 0
  const direction = (byte1 & 0x04) !== 0
  const requireAck = (byte1 & 0x08) !== 0
  const fragment = (byte1 & 0x10) !== 0

  const sequence = buffer[2]
  const dataLen = buffer[3]

  if (buffer.length < 4 + dataLen + (checksum ? 2 : 0)) return null

  const data = buffer.slice(4, 4 + dataLen)
  let receivedCrc: number | undefined

  if (checksum) {
    receivedCrc = buffer[4 + dataLen] | (buffer[4 + dataLen + 1] << 8)

    // If not encrypted, we can verify CRC immediately
    if (!encrypted) {
      const calcCrc = crc16(buffer.subarray(2, 4 + dataLen))
      if (receivedCrc !== calcCrc) {
        return null
      }
    }
  }

  return {
    type,
    subtype,
    encrypted,
    checksum,
    direction: direction ? 1 : 0,
    requireAck,
    fragment,
    sequence,
    data,
    crc: receivedCrc
  }
}
