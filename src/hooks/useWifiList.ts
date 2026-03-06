import { useState, useEffect, useRef } from 'react'
import Taro from '@tarojs/taro'

const WIFI_CACHE_KEY = 'blufi_wifi_cache'

export function useWifiList() {
  const [wifiList, setWifiList] = useState<Taro.WifiInfo[]>([])
  const [isScanning, setIsScanning] = useState(false)
  
  // Use a simple ref to track scanning state to avoid re-entry
  const scanningRef = useRef(false)

  // Initialize WiFi module
  useEffect(() => {
    const init = async () => {
      try {
        await Taro.startWifi()
      } catch (e) {
        console.error('Start WiFi failed', e)
      }
    }
    init()
    
    // Register listener once
    Taro.onGetWifiList((res) => {
      if (res.wifiList) {
        setWifiList(res.wifiList)
        setIsScanning(false)
        scanningRef.current = false
      }
    })
    
    return () => {
      Taro.offGetWifiList()
      Taro.stopWifi()
    }
  }, [])

  const scanWifi = async () => {
    if (scanningRef.current) return
    scanningRef.current = true
    setIsScanning(true)
    setWifiList([]) // Clear old list
    
    try {
      await Taro.getWifiList()
      // The result will come in onGetWifiList callback
    } catch (e) {
      console.error('Get WiFi List failed', e)
      setIsScanning(false)
      scanningRef.current = false
      Taro.showToast({ title: 'Scan Failed', icon: 'none' })
    }
  }

  const getCachedPassword = (ssid: string): string => {
    try {
      const cache = Taro.getStorageSync(WIFI_CACHE_KEY) || {}
      return cache[ssid] || ''
    } catch (e) {
      return ''
    }
  }

  const saveCachedPassword = (ssid: string, password: string) => {
    if (!ssid || !password) return
    try {
      const cache = Taro.getStorageSync(WIFI_CACHE_KEY) || {}
      cache[ssid] = password
      Taro.setStorageSync(WIFI_CACHE_KEY, cache)
    } catch (e) {
      console.error('Save wifi cache failed', e)
    }
  }

  return {
    wifiList,
    isScanning,
    scanWifi,
    getCachedPassword,
    saveCachedPassword
  }
}
