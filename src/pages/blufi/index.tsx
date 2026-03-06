import { View, Text, Button, Input, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useBLEStore } from '../../store/bleStore'
import { useWifiList } from '../../hooks/useWifiList'
import { bufferToHex } from '../../utils/ble'
import * as BlufiConstants from '../../utils/blufi/constants'
import { BlufiSession } from '../../utils/blufi/session'
import './index.scss'

/**
 * BluFi 配网页面。
 *
 * 设计目标：
 * 1. 页面只负责 UI 与流程编排；
 * 2. 协议细节全部下沉到 BlufiSession；
 * 3. 按 ESP32 BluFi 定义保持明文流程可运行。
 */
export default function BlufiPage() {
  const {
    adapterState,
    devices,
    openAdapter,
    startDiscovery,
    stopDiscovery,
    connect,
    getServices,
    getCharacteristics,
    notifyCharacteristic,
    writeCharacteristic,
    setOnDataReceived,
    addLog,
    logs,
    clearLogs
  } = useBLEStore()

  const [ssid, setSsid] = useState('')
  const [password, setPassword] = useState('')
  const [showWifiList, setShowWifiList] = useState(false)
  const [status, setStatus] = useState('Idle')
  const [version, setVersion] = useState('')
  const [nameFilter, setNameFilter] = useState('')
  const [isConfiguring, setIsConfiguring] = useState(false)

  const { wifiList, isScanning, scanWifi, getCachedPassword, saveCachedPassword } = useWifiList()
  const sessionRef = useRef<BlufiSession | null>(null)

  /**
   * 向 BluFi 写特征发送数据。
   *
   * 关键点：
   * - 统一设置 service/char，避免页面散落写入逻辑；
   * - 优先按特征能力选择 writeType，并保留一次兜底重试。
   */
  const writeToBlufi = useCallback(async (buffer: Uint8Array) => {
    useBLEStore.setState({
      selectedServiceId: BlufiConstants.BLUFI_SERVICE_UUID,
      selectedCharId: BlufiConstants.BLUFI_WRITE_CHARACTERISTIC_UUID
    })

    const hex = bufferToHex(buffer.buffer as ArrayBuffer)
    const chars = useBLEStore.getState().characteristics
    const writeChar = chars.find(
      c => c.uuid.toUpperCase() === BlufiConstants.BLUFI_WRITE_CHARACTERISTIC_UUID || c.uuid.toUpperCase().includes('FF01')
    )

    let withResponse = true
    if (writeChar?.properties?.writeNoResponse) {
      withResponse = false
    } else if (writeChar?.properties?.write) {
      withResponse = true
    }

    try {
      await writeCharacteristic(hex, withResponse)
    } catch {
      await writeCharacteristic(hex, !withResponse)
    }
  }, [writeCharacteristic])

  /**
   * 初始化或获取会话实例。
   */
  const getSession = useCallback(() => {
    if (sessionRef.current) {
      return sessionRef.current
    }

    sessionRef.current = new BlufiSession({
      mtu: 270,
      write: writeToBlufi,
      handlers: {
        onLog: message => addLog(message),
        onVersion: (major, minor) => {
          setVersion(`${major}.${minor}`)
        },
        onWifiState: staStatus => {
          if (staStatus === 0) {
            setStatus('Done')
            addLog('WiFi 连接成功')
            Taro.showToast({ title: 'Success', icon: 'success' })
          } else {
            setStatus('Error')
            addLog(`WiFi 连接失败: ${staStatus}`)
          }
        },
        onError: code => {
          setStatus('Error')
          addLog(`设备返回错误码: ${code}`)
        }
      }
    })

    return sessionRef.current
  }, [addLog, writeToBlufi])

  useEffect(() => {
    if (!adapterState.available) {
      openAdapter()
    }

    const session = getSession()
    setOnDataReceived((deviceId, serviceId, characteristicId, value) => {
      void session.handleIncoming(deviceId, serviceId, characteristicId, value).catch(err => {
        addLog(`处理设备数据失败: ${String(err)}`)
      })
    })

    return () => {
      setOnDataReceived(undefined)
      session.reset()
      sessionRef.current = null
    }
  }, [adapterState.available, addLog, getSession, openAdapter, setOnDataReceived])

  /**
   * 设备筛选规则：
   * - 优先按名称过滤；
   * - 默认匹配 BLUFI/ESP 前缀或广播中含 FFFF 服务。
   */
  const blufiDevices = devices.filter(d => {
    if (nameFilter) {
      return d.name && d.name.toUpperCase().includes(nameFilter.toUpperCase())
    }
    const nameMatch = d.name && (d.name.startsWith('BLUFI') || d.name.startsWith('ESP'))
    const uuidMatch = d.advertisServiceUUIDs && d.advertisServiceUUIDs.some(u => u.toUpperCase().includes('FFFF'))
    return nameMatch || uuidMatch
  })

  /**
   * 扫描设备。
   */
  const handleScan = () => {
    setStatus('Scanning')
    startDiscovery()
  }

  /**
   * 建立连接并完成 BluFi 通道初始化。
   *
   * 初始化步骤：
   * 1. connect；
   * 2. service/characteristic discovery；
   * 3. 设置 notify；
   * 4. 请求版本，确认协议连通性。
   */
  const handleConnect = async (device: any) => {
    try {
      stopDiscovery()
      setStatus('Connecting')
      getSession().reset()

      await connect(device.deviceId)
      await getServices(device.deviceId)

      setTimeout(async () => {
        await getCharacteristics(device.deviceId, BlufiConstants.BLUFI_SERVICE_UUID)
        useBLEStore.setState({
          selectedServiceId: BlufiConstants.BLUFI_SERVICE_UUID,
          selectedCharId: BlufiConstants.BLUFI_NOTIFY_CHARACTERISTIC_UUID
        })
        await useBLEStore.getState().setBLEMTU(270)
        await notifyCharacteristic(true)
        setStatus('Connected')
        await getSession().requestVersion()
      }, 1200)
    } catch (err) {
      setStatus('Error')
      addLog(`连接设备失败: ${String(err)}`)
    }
  }

  /**
   * 下发 STA 配网参数。
   *
   * 说明：
   * - 当前使用明文模式以优先跑通流程；
   * - 协议顺序严格遵循 ESP32 BluFi：OP_MODE -> SSID -> PASSWORD -> CONNECT。
   */
  const handleConfigure = async () => {
    if (isConfiguring) {
      addLog('正在发送配置，请稍候')
      return
    }
    if (!ssid) {
      Taro.showToast({ title: '请输入 SSID', icon: 'none' })
      return
    }

    setIsConfiguring(true)
    setStatus('Configuring')
    try {
      await getSession().configureSta(ssid, password)
      saveCachedPassword(ssid, password)
      addLog('Configuration Sent. Waiting for connection...')
    } catch (err) {
      setStatus('Error')
      addLog(`发送 WiFi 配置失败: ${String(err)}`)
    } finally {
      setIsConfiguring(false)
    }
  }

  /**
   * 请求设备状态。
   */
  const handleGetStatus = async () => {
    await getSession().requestStatus()
  }

  /**
   * 请求设备版本。
   */
  const handleGetVersion = async () => {
    await getSession().requestVersion()
  }

  /**
   * 选择 Wi-Fi 并回填缓存密码。
   */
  const handleSelectWifi = (wifi: Taro.WifiInfo) => {
    setSsid(wifi.SSID)
    const cached = getCachedPassword(wifi.SSID)
    setPassword(cached || '')
    setShowWifiList(false)
  }

  /**
   * 展开或收起 Wi-Fi 列表。
   */
  const toggleWifiList = () => {
    if (!showWifiList) {
      scanWifi()
    }
    setShowWifiList(!showWifiList)
  }

  return (
    <View className='blufi-page'>
      <View className='section'>
        <Text className='title'>1. Select Device {version && <Text style={{fontSize: '12px', color: '#999'}}>(v{version})</Text>}</Text>

        <View className='input-group' style={{marginBottom: '10px'}}>
          <Input className='input' value={nameFilter} onInput={e => setNameFilter(e.detail.value)} placeholder='Filter by Name (e.g. BLUFI)' />
        </View>

        <View style={{marginBottom: '10px'}}>
          <Button className='btn' size='mini' onClick={handleScan} disabled={status === 'Scanning'}>Scan</Button>
          <Button className='btn' size='mini' onClick={handleGetVersion}>Version</Button>
          <Button className='btn' size='mini' onClick={handleGetStatus}>Status</Button>
        </View>

        <ScrollView scrollY className='device-list'>
          {blufiDevices.map(d => (
            <View key={d.deviceId} className='device-item' onClick={() => handleConnect(d)}>
              <Text className='name'>{d.name || 'Unknown'}</Text>
              <Text className='rssi'>RSSI: {d.RSSI}</Text>
            </View>
          ))}
          {blufiDevices.length === 0 && <View style={{padding: '10px'}}>No BluFi devices found</View>}
        </ScrollView>
      </View>

      <View className='section'>
        <Text className='title'>2. WiFi Settings</Text>
        <View className='input-group'>
          <Text className='label'>SSID</Text>
          <View style={{display: 'flex', alignItems: 'center'}}>
            <Input className='input' style={{flex: 1}} value={ssid} onInput={e => setSsid(e.detail.value)} placeholder='WiFi Name' />
            <Button size='mini' style={{marginLeft: '5px'}} onClick={toggleWifiList}>Select</Button>
          </View>
        </View>

        {showWifiList && (
          <View className='wifi-list' style={{border: '1px solid #eee', maxHeight: '200px', marginBottom: '10px', overflowY: 'scroll'}}>
            {isScanning && <View style={{padding: '10px', color: '#999'}}>Scanning WiFi...</View>}
            {!isScanning && wifiList.length === 0 && <View style={{padding: '10px', color: '#999'}}>No WiFi found</View>}
            {wifiList.map((w, i) => (
              <View key={i} style={{padding: '10px', borderBottom: '1px solid #f5f5f5', display: 'flex', justifyContent: 'space-between'}} onClick={() => handleSelectWifi(w)}>
                <Text>{w.SSID}</Text>
                <Text style={{fontSize: '12px', color: '#999'}}>{w.signalStrength}dBm</Text>
              </View>
            ))}
          </View>
        )}

        <View className='input-group'>
          <Text className='label'>Password</Text>
          <Input className='input' password value={password} onInput={e => setPassword(e.detail.value)} placeholder='WiFi Password' />
        </View>
        <Button
          className='btn'
          type='primary'
          onClick={handleConfigure}
          disabled={status === 'Connecting' || isConfiguring}
        >
          Configure
        </Button>
        <Text style={{marginLeft: '10px', color: '#666'}}>Status: {status}</Text>
      </View>

      <View className='section'>
        <View style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <Text className='section-title'>Logs</Text>
          <Button size='mini' onClick={clearLogs}>Clear</Button>
        </View>
        <ScrollView scrollY className='logs'>
          {logs.map((log, i) => <View key={i} className='log-item'>{log.time} {log.content}</View>)}
        </ScrollView>
      </View>
    </View>
  )
}
