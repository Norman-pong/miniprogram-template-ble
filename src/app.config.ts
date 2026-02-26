export default defineAppConfig({
  pages: [
    'pages/index/index'
  ],
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
