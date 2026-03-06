export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/blufi/index'
  ],
  tabBar: {
    color: '#999',
    selectedColor: '#007aff',
    backgroundColor: '#fff',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/index/index',
        text: 'Debug'
      },
      {
        pagePath: 'pages/blufi/index',
        text: 'BluFi'
      }
    ]
  },
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: 'BLE Debugger',
    navigationBarTextStyle: 'black'
  },
  permission: {
    "scope.userLocation": {
      "desc": "Used for Bluetooth scanning"
    },
    "scope.bluetooth": {
      "desc": "Used for Bluetooth"
    }
  }
})
