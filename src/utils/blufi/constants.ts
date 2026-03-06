/** BluFi 服务 UUID（主服务） */
export const BLUFI_SERVICE_UUID = '0000FFFF-0000-1000-8000-00805F9B34FB'
/** BluFi 写入特征 UUID（手机 -> 设备） */
export const BLUFI_WRITE_CHARACTERISTIC_UUID = '0000FF01-0000-1000-8000-00805F9B34FB'
/** BluFi 通知特征 UUID（设备 -> 手机） */
export const BLUFI_NOTIFY_CHARACTERISTIC_UUID = '0000FF02-0000-1000-8000-00805F9B34FB'

/** 帧类型：控制帧（Type 低 2 bit = 0） */
export const FRAME_CTRL = 0x00
/** 帧类型：数据帧（Type 低 2 bit = 1） */
export const FRAME_DATA = 0x01

/** 控制子类型：ACK（回复被确认帧的序号） */
export const CTRL_ACK = 0x00
/** 控制子类型：设置安全模式（高 4bit 控制帧，低 4bit 数据帧） */
export const CTRL_SET_SEC_MODE = 0x01
/** 控制子类型：设置 Wi-Fi 工作模式（NULL/STA/AP/AP+STA） */
export const CTRL_SET_WIFI_OPMODE = 0x02
/** 控制子类型：通知设备开始连接 AP */
export const CTRL_CONNECT_WIFI = 0x03
/** 控制子类型：断开设备当前 AP 连接 */
export const CTRL_DISCONNECT_WIFI = 0x04
/** 控制子类型：查询 Wi-Fi 状态（设备随后上报 0x0F 数据帧） */
export const CTRL_GET_WIFI_STATUS = 0x05
/** 控制子类型：在 SoftAP 模式下踢除指定 STA */
export const CTRL_DEAUTHENTICATE_STA = 0x06
/** 控制子类型：查询版本（设备返回 DATA_VERSION=0x10） */
export const CTRL_GET_VERSION = 0x07
/** 控制子类型：断开 BLE GATT 链路 */
export const CTRL_DISCONNECT_BLE = 0x08
/** 控制子类型：触发设备扫描周边 Wi-Fi */
export const CTRL_GET_WIFI_LIST = 0x09
/** 控制子类型：Wi-Fi 状态报告（部分实现会用该值） */
export const CTRL_WIFI_STATUS = 0x0F

/** 数据子类型：安全协商数据（DH/RSA/ECC 等协商负载） */
export const DATA_NEG = 0x00
/** 数据子类型：STA BSSID（隐藏 SSID 场景） */
export const DATA_STA_BSSID = 0x01
/** 数据子类型：STA SSID */
export const DATA_STA_SSID = 0x02
/** 数据子类型：STA 密码 */
export const DATA_STA_PASSWORD = 0x03
/** 数据子类型：SoftAP SSID */
export const DATA_SOFTAP_SSID = 0x04
/** 数据子类型：SoftAP 密码 */
export const DATA_SOFTAP_PASSWORD = 0x05
/** 数据子类型：SoftAP 最大连接数（1~4） */
export const DATA_SOFTAP_MAX_CONNECTION = 0x06
/** 数据子类型：SoftAP 认证模式（OPEN/WPA/WPA2 等） */
export const DATA_SOFTAP_AUTH_MODE = 0x07
/** 数据子类型：SoftAP 信道（1~14） */
export const DATA_SOFTAP_CHANNEL = 0x08
/** 数据子类型：Wi-Fi 连接状态报告（opmode、STA 状态、SoftAP 连接数等） */
export const DATA_WIFI_CONNECTION_STATE = 0x0F
/** 数据子类型：版本信息（data[0]=major, data[1]=minor） */
export const DATA_VERSION = 0x10
/** 数据子类型：Wi-Fi 列表（length + RSSI + SSID，可分片） */
export const DATA_WIFI_LIST = 0x11
/** 数据子类型：错误上报（序号错/校验错/解密错等） */
export const DATA_ERROR = 0x12
/** 数据子类型：自定义应用数据 */
export const DATA_CUSTOM_DATA = 0x13

/** Wi-Fi 模式：NULL */
export const WIFI_MODE_NULL = 0x00
/** Wi-Fi 模式：STA */
export const WIFI_MODE_STA = 0x01

/** 兼容保留：旧实现中 SSID Tag */
export const WIFI_TAG_STA_SSID = 0x01
/** 兼容保留：旧实现中密码 Tag */
export const WIFI_TAG_STA_PASSWORD = 0x02

/** 协商负载字段：先发 PGK 总长度 */
export const NEG_SECURITY_SET_TOTAL_LENGTH = 0x00
/** 协商负载字段：再发完整 PGK 内容 */
export const NEG_SECURITY_SET_ALL_DATA = 0x01

/** 包类型值：控制包 */
export const PKT_TYPE_CTRL = 0x00
/** 包类型值：数据包 */
export const PKT_TYPE_DATA = 0x01

/** 旧命名兼容：映射到 STA SSID */
export const DATA_WIFI_RONLY = DATA_STA_SSID
/** 旧命名兼容：映射到 STA PASSWORD */
export const DATA_WIFI_RO = DATA_STA_PASSWORD
/** 旧命名兼容：映射到 SOFTAP SSID */
export const DATA_WIFI_WO = DATA_SOFTAP_SSID
/** 旧命名兼容：映射到 SOFTAP PASSWORD */
export const DATA_WIFI_RW = DATA_SOFTAP_PASSWORD
