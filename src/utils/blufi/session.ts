import * as BlufiConstants from './constants'
import { crc16 } from './crc'
import { createPacket, pack, unpack, Packet } from './packet'
import { stringToBuffer } from '../ble'

export type BlufiSessionHandlers = {
  onLog?: (message: string) => void
  onVersion?: (major: number, minor: number) => void
  onWifiState?: (staStatus: number, payload: Uint8Array) => void
  onWifiList?: (payload: Uint8Array) => void
  onError?: (errorCode: number) => void
}

export type BlufiSessionOptions = {
  mtu?: number
  ackTimeoutMs?: number
  fragmentIntervalMs?: number
  write: (buffer: Uint8Array) => Promise<void>
  handlers?: BlufiSessionHandlers
}

type AckWaiter = {
  resolve: () => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

/**
 * BluFi 会话层。
 *
 * 说明：
 * 1. 只处理 ESP32 BluFi 协议字节流与会话状态；
 * 2. 不关心页面状态，不直接依赖 Taro；
 * 3. 当前默认明文模式（不做 DH/AES 协商）。
 */
export class BlufiSession {
  private sendSequence = 0
  private readSequence = -1
  private ackWaiters = new Map<number, AckWaiter>()
  private fragmentParts: Uint8Array[] = []
  private fragmentTotal: number | null = null
  private handlers: BlufiSessionHandlers
  private readonly mtu: number
  private readonly ackTimeoutMs: number
  private readonly fragmentIntervalMs: number
  private readonly write: (buffer: Uint8Array) => Promise<void>

  constructor(options: BlufiSessionOptions) {
    this.write = options.write
    this.handlers = options.handlers ?? {}
    this.mtu = options.mtu ?? 270
    this.ackTimeoutMs = options.ackTimeoutMs ?? 3000
    this.fragmentIntervalMs = options.fragmentIntervalMs ?? 10
  }

  /**
   * 更新事件处理器。
   */
  setHandlers(handlers: BlufiSessionHandlers) {
    this.handlers = handlers
  }

  /**
   * 重置会话状态。
   */
  reset() {
    this.sendSequence = 0
    this.readSequence = -1
    this.fragmentParts = []
    this.fragmentTotal = null
    this.ackWaiters.forEach(waiter => {
      clearTimeout(waiter.timer)
      waiter.reject(new Error('session reset'))
    })
    this.ackWaiters.clear()
  }

  /**
   * 请求设备版本信息。
   */
  async requestVersion() {
    await this.sendPacket(BlufiConstants.PKT_TYPE_CTRL, BlufiConstants.CTRL_GET_VERSION, new Uint8Array(0))
  }

  /**
   * 请求设备 Wi-Fi 状态。
   */
  async requestStatus() {
    await this.sendPacket(BlufiConstants.PKT_TYPE_CTRL, BlufiConstants.CTRL_GET_WIFI_STATUS, new Uint8Array(0))
  }

  /**
   * 按 ESP32 BluFi 定义发送 STA 配网参数。
   */
  async configureSta(ssid: string, password: string) {
    const ssidBytes = new Uint8Array(stringToBuffer(ssid))
    const passwordBytes = new Uint8Array(stringToBuffer(password))

    await this.sendPacket(
      BlufiConstants.PKT_TYPE_CTRL,
      BlufiConstants.CTRL_SET_WIFI_OPMODE,
      new Uint8Array([BlufiConstants.WIFI_MODE_STA])
    )
    await this.sleep(this.fragmentIntervalMs)
    await this.sendPacket(BlufiConstants.PKT_TYPE_DATA, BlufiConstants.DATA_STA_SSID, ssidBytes)
    await this.sleep(this.fragmentIntervalMs)
    await this.sendPacket(BlufiConstants.PKT_TYPE_DATA, BlufiConstants.DATA_STA_PASSWORD, passwordBytes)
    await this.sleep(this.fragmentIntervalMs)
    await this.sendPacket(BlufiConstants.PKT_TYPE_CTRL, BlufiConstants.CTRL_CONNECT_WIFI, new Uint8Array(0))
  }

  /**
   * 处理 BLE 通知数据。
   */
  async handleIncoming(deviceId: string, serviceId: string, characteristicId: string, value: ArrayBuffer) {
    if (!characteristicId.toUpperCase().includes('FF02')) return

    const packet = unpack(new Uint8Array(value))
    if (!packet) return

    const expectedSequence = this.readSequence < 0 ? packet.sequence : ((this.readSequence + 1) & 0xFF)
    if (packet.sequence !== expectedSequence) {
      this.log(`接收序号跳变，期望 ${expectedSequence} 实际 ${packet.sequence}`)
    }
    this.readSequence = packet.sequence

    if (packet.requireAck) {
      await this.sendAck(packet.sequence)
    }

    const payload = packet.data
    if (!this.verifyChecksum(packet, payload)) {
      this.log(`CRC 校验失败，丢弃 Seq=${packet.sequence}`)
      return
    }

    const fullPayload = this.rebuildFragmentPayload(packet, payload)
    if (!fullPayload) return

    this.log(`Received Packet: Type=${packet.type}, Subtype=${packet.subtype}, Seq=${packet.sequence}`)

    switch (packet.type) {
      case BlufiConstants.PKT_TYPE_CTRL:
        this.handleCtrlPacket(packet.subtype, fullPayload)
        return
      case BlufiConstants.PKT_TYPE_DATA:
        this.handleDataPacket(packet.subtype, fullPayload)
        return
      default:
        return
    }
  }

  private handleCtrlPacket(subtype: number, payload: Uint8Array) {
    if (subtype === BlufiConstants.CTRL_ACK) {
      const ackedSequence = (payload[0] ?? 0xFF) & 0xFF
      this.resolveAck(ackedSequence)
      this.log(`收到 ACK: ${ackedSequence}`)
    }
  }

  private handleDataPacket(subtype: number, payload: Uint8Array) {
    switch (subtype) {
      case BlufiConstants.DATA_NEG:
        this.log(`收到协商数据，当前流程使用明文模式，忽略协商负载，长度 ${payload.length}`)
        return
      case BlufiConstants.DATA_VERSION: {
        if (payload.length < 2) return
        const major = payload[0]
        const minor = payload[1]
        this.log(`版本 ${major}.${minor}，当前使用明文传输模式`)
        this.handlers.onVersion?.(major, minor)
        return
      }
      case BlufiConstants.DATA_WIFI_CONNECTION_STATE: {
        if (payload.length < 3) return
        const staStatus = payload[1]
        this.handlers.onWifiState?.(staStatus, payload)
        return
      }
      case BlufiConstants.DATA_WIFI_LIST:
        this.handlers.onWifiList?.(payload)
        this.log(`收到 WiFi 列表数据，长度 ${payload.length}`)
        return
      case BlufiConstants.DATA_ERROR: {
        const errorCode = payload[0] ?? 0xFF
        this.handlers.onError?.(errorCode)
        this.log(`设备返回错误码: ${errorCode}`)
        return
      }
      default:
        return
    }
  }

  private async sendPacket(type: number, subtype: number, data: Uint8Array, requireAck: boolean = false) {
    const maxPayload = Math.min(this.mtu - 4, 255)
    if (data.length <= maxPayload) {
      await this.sendSinglePacket(type, subtype, data, requireAck)
      return
    }
    await this.sendFragmentedPacket(type, subtype, data, maxPayload, requireAck)
  }

  private async sendSinglePacket(type: number, subtype: number, data: Uint8Array, requireAck: boolean) {
    const sequence = this.nextSequence()
    const packet = createPacket(type, subtype, sequence, data, false, false, 0, requireAck, false)
    await this.write(pack(packet))
    if (requireAck) {
      await this.waitAck(sequence)
    }
  }

  private async sendFragmentedPacket(type: number, subtype: number, data: Uint8Array, maxPayload: number, requireAck: boolean) {
    let offset = 0
    while (offset < data.length) {
      const remainingTotal = data.length - offset
      let chunkLength = remainingTotal
      let isLast = true
      if (chunkLength > maxPayload) {
        isLast = false
        chunkLength = maxPayload - 2
      }

      const sequence = this.nextSequence()
      const chunk = isLast ? data.subarray(offset, offset + chunkLength) : (() => {
        const result = new Uint8Array(2 + chunkLength)
        result[0] = remainingTotal & 0xFF
        result[1] = (remainingTotal >> 8) & 0xFF
        result.set(data.subarray(offset, offset + chunkLength), 2)
        return result
      })()

      offset += chunkLength

      const packet = createPacket(type, subtype, sequence, chunk, false, false, 0, requireAck, !isLast)
      await this.write(pack(packet))
      if (requireAck) {
        await this.waitAck(sequence)
      }
      await this.sleep(this.fragmentIntervalMs)
    }
  }

  private async sendAck(ackedSequence: number) {
    await this.sendPacket(
      BlufiConstants.PKT_TYPE_CTRL,
      BlufiConstants.CTRL_ACK,
      new Uint8Array([ackedSequence & 0xFF]),
      false
    )
  }

  private waitAck(sequence: number) {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.ackWaiters.delete(sequence)
        reject(new Error(`ACK timeout: ${sequence}`))
      }, this.ackTimeoutMs)
      this.ackWaiters.set(sequence, { resolve, reject, timer })
    })
  }

  private resolveAck(sequence: number) {
    const waiter = this.ackWaiters.get(sequence)
    if (!waiter) return
    clearTimeout(waiter.timer)
    this.ackWaiters.delete(sequence)
    waiter.resolve()
  }

  private verifyChecksum(packet: Packet, payload: Uint8Array) {
    if (!packet.checksum || packet.crc === undefined) return true
    const crcBuffer = new Uint8Array(2 + payload.length)
    crcBuffer[0] = packet.sequence
    crcBuffer[1] = payload.length
    crcBuffer.set(payload, 2)
    return crc16(crcBuffer) === packet.crc
  }

  private rebuildFragmentPayload(packet: Packet, payload: Uint8Array): Uint8Array | null {
    if (packet.fragment) {
      if (payload.length < 2) return null
      const remainingTotal = payload[0] | (payload[1] << 8)
      if (remainingTotal <= 0 || remainingTotal < payload.length - 2) {
        this.log('分片头长度非法，丢弃')
        this.fragmentParts = []
        this.fragmentTotal = null
        return null
      }
      if (this.fragmentTotal === null) {
        this.fragmentTotal = remainingTotal
      } else if (remainingTotal > this.fragmentTotal) {
        this.log('分片剩余长度异常递增，丢弃')
        this.fragmentParts = []
        this.fragmentTotal = null
        return null
      }
      this.fragmentParts.push(payload.subarray(2))
      return null
    }

    if (this.fragmentParts.length === 0) return payload

    const result = this.concatArrays(...this.fragmentParts, payload)
    if (this.fragmentTotal !== null && result.length !== this.fragmentTotal) {
      this.log(`分片总长不匹配，期望 ${this.fragmentTotal} 实际 ${result.length}`)
      this.fragmentParts = []
      this.fragmentTotal = null
      return null
    }

    this.fragmentParts = []
    this.fragmentTotal = null
    return result
  }

  private nextSequence() {
    const result = this.sendSequence & 0xFF
    this.sendSequence = (this.sendSequence + 1) & 0xFF
    return result
  }

  private log(message: string) {
    this.handlers.onLog?.(message)
  }

  private concatArrays(...parts: Uint8Array[]) {
    const total = parts.reduce((sum, part) => sum + part.length, 0)
    const result = new Uint8Array(total)
    let offset = 0
    for (const part of parts) {
      result.set(part, offset)
      offset += part.length
    }
    return result
  }

  private sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
