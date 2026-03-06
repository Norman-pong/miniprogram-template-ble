import { create } from 'zustand'
import Taro from '@tarojs/taro'
import { bufferToHex, hexStringToBuffer } from '../utils/ble'

/**
 * 日志结构定义
 */
interface Log {
  time: string
  content: string
}

/**
 * 蓝牙设备扩展接口
 * 包含基础设备信息，可根据实际需求添加额外字段
 */
interface Device extends Taro.onBluetoothDeviceFound.CallbackResultBlueToothDevice {
}

/**
 * BLE Store 状态接口
 * 管理蓝牙适配器状态、设备列表、连接状态、服务与特征值等
 */
interface BLEState {
  /** 日志列表，用于记录操作和错误信息 */
  logs: Log[]
  /** 蓝牙适配器状态 */
  adapterState: Taro.onBluetoothAdapterStateChange.CallbackResult
  /** 已发现的蓝牙设备列表 */
  devices: Device[]
  /** 当前连接的蓝牙设备 ID */
  connectedDeviceId: string
  /** 当前连接设备的服务列表 */
  services: Taro.getBLEDeviceServices.BLEService[]
  /** 当前连接设备的特征值列表 */
  characteristics: Taro.getBLEDeviceCharacteristics.BLECharacteristic[]
  /** 选中的服务 ID */
  selectedServiceId: string
  /** 选中的特征值 ID */
  selectedCharId: string
  /** 当前连接设备的 MTU 值 */
  mtu: number
  /** 自定义数据接收回调 (用于 BluFi 等特定协议) */
  onDataReceived?: (deviceId: string, serviceId: string, characteristicId: string, value: ArrayBuffer) => void

  // Actions
  /** 设置数据接收回调 */
  setOnDataReceived: (callback?: (deviceId: string, serviceId: string, characteristicId: string, value: ArrayBuffer) => void) => void

  /** 添加日志 */
  addLog: (msg: string | object) => void
  /** 初始化蓝牙适配器 */
  openAdapter: () => Promise<void>
  /** 关闭蓝牙模块 */
  closeAdapter: () => Promise<void>
  /** 获取本机蓝牙适配器状态 */
  getAdapterState: () => Promise<void>
  /** 开始搜寻附近的蓝牙外围设备 */
  startDiscovery: () => Promise<void>
  /** 停止搜寻 */
  stopDiscovery: () => Promise<void>
  /** 获取所有已发现的蓝牙设备 */
  getDevices: () => Promise<void>
  /** 连接低功耗蓝牙设备 */
  connect: (deviceId: string) => Promise<void>
  /** 断开与低功耗蓝牙设备的连接 */
  closeConnection: (deviceId?: string) => Promise<void>
  /** 获取蓝牙设备所有服务 (service) */
  getServices: (deviceId: string) => Promise<void>
  /** 获取蓝牙设备某个服务中所有特征值 (characteristic) */
  getCharacteristics: (deviceId: string, serviceId: string) => Promise<void>
  /** 读取低功耗蓝牙设备的特征值的二进制数据值 */
  readCharacteristic: () => Promise<void>
  /** 向低功耗蓝牙设备特征值中写入二进制数据 */
  writeCharacteristic: (hex: string, withResponse: boolean) => Promise<void>
  /** 启用低功耗蓝牙设备特征值变化时的 notify 功能 */
  notifyCharacteristic: (enable: boolean) => Promise<void>
  /** 获取蓝牙设备的信号强度 */
  getRSSI: () => Promise<void>
  /** 协商设置蓝牙传输单元 (MTU) 最大传输单元 */
  setBLEMTU: (mtu: number) => Promise<void>

  // 用于 UI 交互，记录用户选择的服务和特征值
  /** 设置选中的服务 ID */
  setSelectedServiceId: (id: string) => void
  /** 设置选中的特征值 ID */
  setSelectedCharId: (id: string) => void
  /** 清空日志 */
  clearLogs: () => void
}

export const useBLEStore = create<BLEState>((set, get) => ({
  logs: [],
  adapterState: { available: false, discovering: false },
  devices: [],
  connectedDeviceId: '',
  services: [],
  characteristics: [],
  selectedServiceId: '',
  selectedCharId: '',
  mtu: 23,
  onDataReceived: undefined,

  addLog: (msg) => {
    const time = new Date().toLocaleTimeString()
    const content = typeof msg === 'object' ? JSON.stringify(msg) : msg
    set((state) => ({ logs: [{ time, content }, ...state.logs] }))
  },

  setSelectedServiceId: (id) => set({ selectedServiceId: id }),
  setSelectedCharId: (id) => set({ selectedCharId: id }),
  clearLogs: () => set({ logs: [] }),
  setOnDataReceived: (callback) => set({ onDataReceived: callback }),

  /**
   * 初始化蓝牙模块
   * 流程：
   * 1. 打开蓝牙适配器 (openBluetoothAdapter)
   * 2. 获取本机蓝牙适配器状态 (getAdapterState)
   * 3. 监听蓝牙适配器状态变化 (onBluetoothAdapterStateChange)
   * 4. 监听低功耗蓝牙连接状态的改变 (onBLEConnectionStateChange)
   * 5. 监听低功耗蓝牙设备的特征值变化 (onBLECharacteristicValueChange)
   */
  openAdapter: async () => {
    try {
      await Taro.openBluetoothAdapter()
      get().addLog('Open Adapter Success')
      await get().getAdapterState()

      // 监听蓝牙适配器状态变化事件
      Taro.onBluetoothAdapterStateChange((res) => {
        get().addLog(`Adapter State Change: ${JSON.stringify(res)}`)
        set({ adapterState: res })
      })

      // 监听低功耗蓝牙连接状态的改变事件。包括开发者主动连接或断开连接，设备丢失，周边设备异常断开等
      Taro.onBLEConnectionStateChange((res) => {
        get().addLog(`Connection State Change: ${JSON.stringify(res)}`)
        // 如果断开连接，清理当前连接状态
        if (!res.connected) {
           const { connectedDeviceId } = get()
           if (res.deviceId === connectedDeviceId) {
              set({
                connectedDeviceId: '',
                services: [],
                characteristics: [],
                selectedServiceId: '',
                selectedCharId: ''
              })
           }
        }
      })

      // 监听低功耗蓝牙设备的特征值变化事件
      Taro.onBLECharacteristicValueChange((res) => {
        const { onDataReceived } = get()
        if (onDataReceived) {
          onDataReceived(res.deviceId, res.serviceId, res.characteristicId, res.value)
        }
        get().addLog(`Value Changed (Read/Notify): ${bufferToHex(res.value)}`)
      })

    } catch (err) {
      get().addLog(`Open Adapter Fail: ${JSON.stringify(err)}`)
    }
  },

  /**
   * 关闭蓝牙模块
   * 说明：断开所有已建立的连接并释放系统资源
   */
  closeAdapter: async () => {
    try {
      await Taro.closeBluetoothAdapter()
      get().addLog('Close Adapter Success')
      set({
        adapterState: { available: false, discovering: false },
        devices: [],
        connectedDeviceId: ''
      })
    } catch (err: any) {
      get().addLog(err?.errMsg || 'Close Adapter Fail')
    }
  },

  /**
   * 获取本机蓝牙适配器状态
   */
  getAdapterState: async () => {
    try {
      const res = await Taro.getBluetoothAdapterState()
      get().addLog(`Adapter State: ${JSON.stringify(res)}`)
      set({ adapterState: res })
    } catch (err: any) {
      get().addLog(err?.errMsg || 'Get Adapter State Fail')
    }
  },

  /**
   * 开始搜寻附近的蓝牙外围设备
   * 流程：
   * 1. 开启蓝牙搜索 (startBluetoothDevicesDiscovery)
   * 2. 监听寻找到新设备的事件 (onBluetoothDeviceFound) 并更新设备列表
   */
  startDiscovery: async () => {
    try {
      // allowDuplicatesKey: true 允许重复上报同一设备，方便实时更新 RSSI
      await Taro.startBluetoothDevicesDiscovery({ allowDuplicatesKey: true })
      get().addLog('Start Discovery Success')

      Taro.onBluetoothDeviceFound((res) => {
        set((state) => {
          const newDevices = [...state.devices]
          res.devices.forEach(d => {
            const idx = newDevices.findIndex(item => item.deviceId === d.deviceId)
            if (idx > -1) {
              newDevices[idx] = d // 更新已知设备信息 (如 RSSI)
            } else {
              newDevices.push(d) // 添加新设备
            }
          })
          return { devices: newDevices }
        })
      })

      // 立即更新适配器状态（如 discovering 变为 true）
      get().getAdapterState()
    } catch (err: any) {
      get().addLog(err?.errMsg || 'Start Discovery Fail')
    }
  },

  /**
   * 停止搜寻附近的蓝牙外围设备
   */
  stopDiscovery: async () => {
    try {
      await Taro.stopBluetoothDevicesDiscovery()
      get().addLog('Stop Discovery Success')
      get().getAdapterState()
    } catch (err: any) {
      get().addLog(err?.errMsg || 'Stop Discovery Fail')
    }
  },

  /**
   * 获取在蓝牙模块生效期间所有已发现的蓝牙设备
   */
  getDevices: async () => {
    try {
      const res = await Taro.getBluetoothDevices()
      set({ devices: res.devices })
      get().addLog(`Get Devices: ${res.devices.length} found`)
    } catch (err: any) {
      get().addLog(err?.errMsg || 'Get Devices Fail')
    }
  },

  /**
   * 连接低功耗蓝牙设备
   * 流程：
   * 1. 创建 BLE 连接 (createBLEConnection)
   * 2. 连接成功后停止搜索以节省资源 (stopDiscovery)
   */
  connect: async (deviceId) => {
    get().addLog(`Connecting to ${deviceId}...`)
    try {
      await Taro.createBLEConnection({ deviceId })
      get().addLog(`Connected to ${deviceId}`)
      set({ connectedDeviceId: deviceId })
      // 连接成功后通常建议停止搜索
      get().stopDiscovery()
    } catch (err: any) {
      get().addLog(`Connect Fail: ${JSON.stringify(err)}`)
    }
  },

  /**
   * 断开与低功耗蓝牙设备的连接
   */
  closeConnection: async (deviceId) => {
    const targetId = deviceId || get().connectedDeviceId
    if (!targetId) return
    try {
      await Taro.closeBLEConnection({ deviceId: targetId })
      get().addLog(`Disconnected from ${targetId}`)
      // 清理连接相关的状态
      set({
        connectedDeviceId: '',
        services: [],
        characteristics: [],
        selectedServiceId: '',
        selectedCharId: ''
      })
    } catch (err: any) {
      get().addLog(err?.errMsg || 'Close Connection Fail')
    }
  },

  /**
   * 获取蓝牙设备所有服务 (service)
   */
  getServices: async (deviceId) => {
    try {
      const res = await Taro.getBLEDeviceServices({ deviceId })
      get().addLog(`Services: ${res.services.length} found`)
      set({ services: res.services })
    } catch (err: any) {
      get().addLog(err?.errMsg || 'Get Services Fail')
    }
  },

  /**
   * 获取蓝牙设备某个服务中所有特征值 (characteristic)
   */
  getCharacteristics: async (deviceId, serviceId) => {
    try {
      const res = await Taro.getBLEDeviceCharacteristics({ deviceId, serviceId })
      get().addLog(`Characteristics: ${res.characteristics.length} found`)
      set({ characteristics: res.characteristics })
    } catch (err: any) {
      get().addLog(err?.errMsg || 'Get Characteristics Fail')
    }
  },

  /**
   * 读取低功耗蓝牙设备的特征值的二进制数据值
   * 注意：必须先启用 notify 才能在 onBLECharacteristicValueChange 中监听到数据变化，
   * 但 read 操作本身是主动读取，读取结果也会在 onBLECharacteristicValueChange 中回调（部分平台）或直接返回。
   */
  readCharacteristic: async () => {
    const { connectedDeviceId, selectedServiceId, selectedCharId } = get()
    if (!connectedDeviceId || !selectedServiceId || !selectedCharId) {
      get().addLog('Please select a characteristic first')
      return
    }

    try {
      await Taro.readBLECharacteristicValue({
        deviceId: connectedDeviceId,
        serviceId: selectedServiceId,
        characteristicId: selectedCharId
      })
      get().addLog('Read Request Sent')
    } catch (err: any) {
      get().addLog(err?.errMsg || 'Read Fail')
    }
  },

  /**
   * 向低功耗蓝牙设备特征值中写入二进制数据
   * @param hex 16进制字符串
   * @param withResponse 是否需要对方确认 (write vs writeNoResponse)
   */
  writeCharacteristic: async (hex, withResponse) => {
    const { connectedDeviceId, selectedServiceId, selectedCharId } = get()
    if (!connectedDeviceId || !selectedServiceId || !selectedCharId) {
      get().addLog('Please select a characteristic first')
      return
    }

    const buffer = hexStringToBuffer(hex)
    try {
      await Taro.writeBLECharacteristicValue({
        deviceId: connectedDeviceId,
        serviceId: selectedServiceId,
        characteristicId: selectedCharId,
        value: buffer,
        writeType: withResponse ? 'write' : 'writeNoResponse'
      })
      get().addLog('Write Success')
    } catch (err: any) {
      get().addLog(err?.errMsg || 'Write Fail')
    }
  },

  /**
   * 启用低功耗蓝牙设备特征值变化时的 notify 功能
   * 订阅后，硬件发送的数据会在 onBLECharacteristicValueChange 中接收
   */
  notifyCharacteristic: async (enable) => {
    const { connectedDeviceId, selectedServiceId, selectedCharId } = get()
    if (!connectedDeviceId || !selectedServiceId || !selectedCharId) {
      get().addLog('Please select a characteristic first')
      return
    }

    try {
      await Taro.notifyBLECharacteristicValueChange({
        deviceId: connectedDeviceId,
        serviceId: selectedServiceId,
        characteristicId: selectedCharId,
        state: enable
      })
      get().addLog(`Notify ${enable} Success`)
    } catch (err: any) {
      get().addLog(err?.errMsg || 'Notify Fail')
    }
  },

  /**
   * 获取蓝牙设备的信号强度 (RSSI)
   */
  getRSSI: async () => {
    const { connectedDeviceId } = get()
    if (!connectedDeviceId) return
    try {
      const res = await Taro.getBLEDeviceRSSI({ deviceId: connectedDeviceId })
      get().addLog(`RSSI: ${res.RSSI}`)
    } catch (err: any) {
      get().addLog(err?.errMsg || 'Get RSSI Fail')
    }
  },

  /**
   * 协商设置蓝牙传输单元 (MTU)
   * 注意：仅安卓支持，iOS 系统会自动协商
   */
  setBLEMTU: async (mtu) => {
    const { connectedDeviceId } = get()
    if (!connectedDeviceId) {
      get().addLog('Not connected')
      return
    }
    try {
      await Taro.setBLEMTU({ deviceId: connectedDeviceId, mtu })
      get().addLog(`Set MTU ${mtu} success`)
      set({ mtu })
    } catch (err: any) {
      get().addLog(`Set MTU fail: ${JSON.stringify(err)}`)
    }
  }
}))
