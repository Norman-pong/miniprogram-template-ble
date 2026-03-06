import { useState } from 'react'
import { View, Text, Button, ScrollView, Input, Switch } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import { useBLE } from '../../hooks/useBLE'
import './index.scss'

export default function Index() {
  const {
    logs, adapterState, devices, connectedDeviceId, services, characteristics,
    selectedServiceId, selectedCharId,
    openAdapter, closeAdapter, getAdapterState,
    startDiscovery, stopDiscovery, getDevices,
    connect, closeConnection, getServices, getCharacteristics, getRSSI, setBLEMTU,
    readCharacteristic, writeCharacteristic, notifyCharacteristic,
    setSelectedServiceId, setSelectedCharId, clearLogs
  } = useBLE()

  const [writeVal, setWriteVal] = useState('')
  const [writeWithResponse, setWriteWithResponse] = useState(true)
  const [mtuVal, setMtuVal] = useState('23')

  useLoad(() => {
    console.log('Page loaded.')
  })

  return (
    <View className='index'>
      <View className='section'>
        <Text className='section-title'>1. Adapter</Text>
        <View className='btn-group'>
          <Button className='btn' size='mini' onClick={openAdapter}>Open</Button>
          <Button className='btn' size='mini' onClick={closeAdapter}>Close</Button>
          <Button className='btn' size='mini' onClick={getAdapterState}>State</Button>
        </View>
        <View style={{fontSize: '12px', marginTop: '5px'}}>
           Available: {adapterState.available ? 'Yes' : 'No'},
           Discovering: {adapterState.discovering ? 'Yes' : 'No'}
        </View>
      </View>

      <View className='section'>
        <Text className='section-title'>2. Discovery</Text>
        <View className='btn-group'>
          <Button className='btn' size='mini' onClick={startDiscovery}>Start</Button>
          <Button className='btn' size='mini' onClick={stopDiscovery}>Stop</Button>
          <Button className='btn' size='mini' onClick={getDevices}>Refresh</Button>
        </View>
        <ScrollView scrollY style={{height: '150px', marginTop: '10px', border: '1px solid #eee'}}>
          {devices
            .sort((a, b) => b.RSSI - a.RSSI) // Sort by signal strength
            .map(d => (
            <View key={d.deviceId} className='device-item' onClick={() => connect(d.deviceId)}>
              <View className='device-name'>
                {d.name || 'Unknown'}
                {/* Show signal strength prominently */}
                <Text style={{fontSize: '10px', marginLeft: '5px', color: d.RSSI > -60 ? 'green' : 'gray'}}>
                   ({d.RSSI})
                </Text>
              </View>
              <View style={{fontSize: '10px', color: '#666'}}>ID: {d.deviceId}</View>
              {/* Show Advertised UUIDs to help identify device when name is Unknown */}
              {d.advertisServiceUUIDs && d.advertisServiceUUIDs.length > 0 && (
                <View style={{fontSize: '9px', color: 'blue'}}>
                  UUIDs: {d.advertisServiceUUIDs.join(', ')}
                </View>
              )}
            </View>
          ))}
          {devices.length === 0 && <View style={{padding:'10px', color:'#999'}}>No devices found</View>}
        </ScrollView>
      </View>

      <View className='section'>
        <Text className='section-title'>3. Connection</Text>
        {connectedDeviceId ? (
          <View>
             <Text style={{fontWeight: 'bold', color: 'green'}}>Connected: {connectedDeviceId}</Text>
             <View className='btn-group' style={{marginTop: '5px'}}>
               <Button className='btn' size='mini' type='warn' onClick={() => closeConnection()}>Disconnect</Button>
               <Button className='btn' size='mini' onClick={() => getServices(connectedDeviceId)}>Get Services</Button>
               <Button className='btn' size='mini' onClick={getRSSI}>RSSI</Button>
             </View>
             <View className='write-group' style={{marginTop: '5px', display: 'flex', alignItems: 'center'}}>
               <Input
                 style={{border: '1px solid #ddd', width: '60px', padding: '2px', marginRight: '5px'}}
                 value={mtuVal}
                 onInput={e => setMtuVal(e.detail.value)}
                 type='number'
               />
               <Button className='btn' size='mini' onClick={() => setBLEMTU(Number(mtuVal))}>Set MTU</Button>
             </View>
          </View>
        ) : (
          <Text style={{color: '#999'}}>Not connected</Text>
        )}

        {services.length > 0 && (
          <View style={{marginTop: '10px'}}>
            <Text style={{fontWeight:'bold'}}>Services:</Text>
            <ScrollView scrollY style={{height: '100px', border: '1px solid #eee'}}>
              {services.map(s => (
                <View key={s.uuid}
                      style={{padding: '5px', background: selectedServiceId === s.uuid ? '#e6f7ff' : 'transparent'}}
                      onClick={() => {
                        setSelectedServiceId(s.uuid)
                        getCharacteristics(connectedDeviceId, s.uuid)
                        setSelectedCharId('')
                      }}>
                  <Text style={{fontSize: '12px'}}>{s.uuid}</Text>
                  {s.isPrimary && <Text style={{fontSize: '10px', color: 'orange', marginLeft: '5px'}}>Primary</Text>}
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {selectedServiceId && (
        <View className='section'>
          <Text className='section-title'>4. Characteristics</Text>
          <ScrollView scrollY style={{height: '100px', border: '1px solid #eee'}}>
            {characteristics.map(c => (
              <View key={c.uuid}
                    style={{padding: '5px', background: selectedCharId === c.uuid ? '#e6f7ff' : 'transparent'}}
                    onClick={() => setSelectedCharId(c.uuid)}>
                <Text style={{fontSize: '12px', display: 'block'}}>{c.uuid}</Text>
                <Text style={{fontSize: '10px', color: '#666'}}>
                  {Object.keys(c.properties).filter(k => c.properties[k]).join(', ')}
                </Text>
              </View>
            ))}
          </ScrollView>

          {selectedCharId && (
            <View className='operations' style={{marginTop: '10px'}}>
               <View className='btn-group'>
                 <Button className='btn' size='mini' onClick={readCharacteristic}>Read</Button>
                 <Button className='btn' size='mini' onClick={() => notifyCharacteristic(true)}>Notify On</Button>
                 <Button className='btn' size='mini' onClick={() => notifyCharacteristic(false)}>Notify Off</Button>
               </View>
               <View className='write-group' style={{marginTop: '10px'}}>
                 <View style={{display:'flex', alignItems:'center', marginBottom: '5px'}}>
                   <Text style={{fontSize:'12px', marginRight:'5px'}}>Write w/ Resp:</Text>
                   <Switch checked={writeWithResponse} onChange={e => setWriteWithResponse(e.detail.value)}  />
                 </View>
                 <Input
                    style={{border: '1px solid #ddd', padding: '5px', marginBottom: '5px'}}
                    placeholder='Hex (e.g. AA BB)'
                    value={writeVal}
                    onInput={e => setWriteVal(e.detail.value)}
                 />
                 <Button className='btn' size='mini' onClick={() => writeCharacteristic(writeVal, writeWithResponse)}>Write</Button>
               </View>
            </View>
          )}
        </View>
      )}

      <View className='section'>
        <View style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
           <Text className='section-title'>Logs</Text>
           <Button size='mini' onClick={clearLogs}>Clear</Button>
        </View>
        <ScrollView className='logs' scrollY>
          {logs.map((log, i) => <View key={i} className='log-item'>{log.time} {log.content}</View>)}
        </ScrollView>
      </View>
    </View>
  )
}
