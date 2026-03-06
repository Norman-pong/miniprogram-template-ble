# 小程序 BLE 蓝牙调试工具 - 开发指南

本文档旨在介绍 BLE (Bluetooth Low Energy) 的基础概念、服务设计原则以及在微信小程序开发中的兼容性规范与最佳实践。

## 1. BLE 基础架构：GATT Server

BLE 设备通常作为 **GATT Server**，其数据结构层级如下：

```text
GATT Server（设备）
├── Service 1 (UUID: xxx)               <- 逻辑功能分组
│   ├── Characteristic A (读/写/通知)     <- 具体数据点
│   └── Characteristic B (只读)
├── Service 2 (UUID: yyy)
│   └── Characteristic C (可写 + 通知)
└── Service 3 (标准服务，如 Battery Service)
    └── Battery Level (只读)
```

- **Service (服务)**：功能的逻辑集合（如“设备信息”、“传感器数据”、“控制接口”）。
- **Characteristic (特征值)**：具体的数据交互点（如温度值、开关状态、固件版本）。
- **UUID**：每个 Service 和 Characteristic 都有唯一的 UUID（16-bit 标准定义 或 128-bit 自定义）。

> ✅ **提示**：服务数量应根据功能模块划分，无硬性限制，但过多的服务会增加发现时间并占用内存。

## 2. 属性 (Properties) vs 权限 (Permissions)

BLE 特征值的 **属性** 和 **权限** 是两个核心概念，需严格区分：

### 2.1 属性 (Properties)
**决定“能做什么操作”**（客户端可见）。

| 属性 | 说明 |
| :--- | :--- |
| `READ` | 中心设备（手机）可读取数据 |
| `WRITE` | 可写入数据（需要设备响应回复） |
| `WRITE_WITHOUT_RESPONSE` | 可写入数据（无需设备响应，速度快） |
| `NOTIFY` | 设备可主动推送数据（无需手机轮询，无应用层确认） |
| `INDICATE` | 设备可主动推送数据（需要手机应用层确认，可靠性高） |

> 💡 小程序通过 `wx.getBLEDeviceCharacteristics` 获取到的 `properties` 对象即对应上述内容。

### 2.2 权限 (Permissions)
**决定“操作是否需要加密/认证”**（底层协议栈控制）。

| 权限（ESP-IDF 示例） | 说明 | 小程序兼容性 |
| :--- | :--- | :--- |
| `ESP_GATT_PERM_READ` | 允许明文读取 | ✅ 支持 |
| `ESP_GATT_PERM_WRITE` | 允许明文写入 | ✅ 支持 |
| `ESP_GATT_PERM_READ_ENCRYPTED` | 必须加密配对后才能读 | ❌ 不支持 |
| `ESP_GATT_PERM_WRITE_ENCRYPTED` | 必须加密配对后才能写 | ❌ 不支持 |

> 🔒 **注意**：如果使用了 `_ENCRYPTED` 权限，连接时系统会要求进行 BLE 配对（Pairing）。若未配对，操作将被拒绝。

## 3. 服务设计案例：智能灯

场景：一款支持开关、亮度调节及固件升级的智能灯。

| 服务 | 特征值 (Characteristic) | 属性 (Properties) | 权限 (Permissions) | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| **Custom Control Service**<br>`(128-bit UUID)` | `Switch` | READ, WRITE | 明文 | 开/关控制 |
| | `Brightness` | READ, WRITE | 明文 | 0~100 亮度值 |
| **Device Info Service**<br>`(标准 0x180A)` | `Manufacturer` | READ | 明文 | 厂商名，如 "MyBrand" |
| | `Firmware Rev` | READ | 明文 | 版本号，如 "v1.2.0" |
| **OTA Service**<br>`(自定义)` | `Firmware Data` | WRITE_NO_RESP | 明文* | 固件升级数据传输 |

> \*注：OTA 服务虽然敏感，但在小程序环境中通常需设为明文权限，安全性通过应用层加密保障。

## 4. 微信小程序兼容性规范

由于微信小程序 **无法主动触发系统的 BLE 配对弹窗**，且不同 Android/iOS 系统对配对行为的处理差异巨大，因此建议遵循以下规范：

### 4.1 权限设置
所有用于小程序交互的特征值，**必须使用明文权限**。

```c
// ESP32 示例：允许小程序直接读写
ESP_GATT_PERM_READ | ESP_GATT_PERM_WRITE
```

### 4.2 避免加密权限
**严禁使用 `*_ENCRYPTED` 权限**。
如果特征值设置了加密权限，小程序在尝试读写时会失败，通常返回错误码 `10008` 或系统错误 `0x05 (GATT_INSUF_AUTHENTICATION)`。

### 4.3 安全传输方案
对于敏感数据（如 Wi-Fi 密码、Token），请在 **应用层 (Application Layer)** 进行加密，而非依赖 BLE 链路层加密。
- **小程序端**：使用 `AES` / `RSA` 加密数据（推荐 `crypto-js` 库）。
- **设备端**：解密数据包（如 ESP32 使用 `mbedtls`）。
- **密钥交换**：可通过设备二维码、ECDH 协商或硬编码（不推荐）方式获取密钥。

## 5. 开发注意事项

1.  **UUID 格式与一致性**
    *   **设备端 (如 ESP32)**：通常定义为小端字节序数组。
    *   **小程序端**：API 接收标准字符串格式（如 `0000xxxx-0000-1000-8000-00805F9B34FB`）。
    *   **建议**：在小程序中进行 UUID 匹配时，建议使用 `toLowerCase()` 统一转为小写，并使用 `includes()` 进行模糊匹配，以兼容 16-bit 和 128-bit 格式差异。

2.  **广播数据 (Advertising)**
    *   设备广播包中应包含主服务的 `Service UUID`。
    *   小程序调用 `startBluetoothDevicesDiscovery` 时，传入 `services: ['UUID']` 可提高搜索效率并过滤无关设备。

3.  **MTU (最大传输单元)**
    *   默认 MTU 通常为 23 字节（有效载荷 20 字节）。
    *   安卓支持 `setBLEMTU` 协商更大的包长（如 512 字节），iOS 会自动协商。
    *   **建议**：设计协议时考虑分包策略，以适应不同 MTU。

## 6. 常见误区澄清

| 误区 | 正确理解 |
| :--- | :--- |
| “BLE 设备必须有 3 个服务” | ❌ 服务数量自由定义，最少 1 个即可。 |
| “权限只有读和写” | ❌ 权限还包括加密、认证 (Authenticated)、授权 (Authorized) 等层级。 |
| “Notify 不需要权限” | ⚠️ Notify 是属性，但如果特征值本身设置了 `READ_ENCRYPTED` 权限，订阅 Notify 往往也需要配对。 |
| “小程序能用所有 BLE 功能” | ❌ 小程序受限于宿主环境，不支持主动配对、不支持作为从机（Peripheral Mode 仅部分支持）、不支持读取所有广播数据（如 iOS 无法获取 MAC 地址）。 |

## 7. 最佳实践

1.  **最小化服务数量**：将相关功能合并到同一服务中，减少 GATT 服务发现阶段的耗时与资源开销。
2.  **明确权限分级**：
    *   **公开数据**（如环境温度）：明文 READ。
    *   **控制指令**（如开关）：明文 WRITE。
    *   **敏感操作**（如恢复出厂）：明文 WRITE，但数据内容需带 Token 或加密。
3.  **利用标准服务**：
    *   尽量使用 SIG 定义的标准服务（如 Battery Service `0x180F`, Device Info `0x180A`）。
    *   这有助于通用工具（如 nRF Connect）自动解析和展示数据。

---

## 8. 项目内 BluFi 逻辑总览

- [ESP32 BluFi 配网文档](https://docs.espressif.com/projects/esp-idf/zh_CN/stable/esp32/api-guides/ble/blufi.html)
- [Android 客户端](https://github.com/EspressifApp/EspBlufiForAndroid)

本节说明当前仓库中 BluFi 配网相关代码的职责划分、协议流程和扩展方式，便于后续维护与迭代。

### 8.1 相关目录

- `src/utils/blufi/constants.ts`：BluFi 协议常量（控制/数据子类型、UUID、模式值）
- `src/utils/blufi/packet.ts`：协议包编解码（pack / unpack）
- `src/utils/blufi/crc.ts`：CRC16 校验
- `src/utils/blufi/session.ts`：BluFi 会话层（收发、ACK、分片、事件分发）
- `src/pages/blufi/index.tsx`：页面编排层（连接、输入、触发会话 API、展示状态）

### 8.2 架构分层

当前实现采用“页面层 + 会话层 + 协议工具层”：

1. **页面层 (`index.tsx`)**
   - 负责 UI 和用户交互（扫码、连接、输入 SSID/密码、点击配置）
   - 不直接处理协议细节
   - 通过会话层回调更新页面状态（版本、配网结果、错误）

2. **会话层 (`session.ts`)**
   - 维护会话状态：发送序号、接收序号、ACK 等待表、分片缓存
   - 处理协议收发主流程：发送、分片、ACK、数据解码分发
   - 对上暴露业务语义 API：`requestVersion`、`requestStatus`、`configureSta`

3. **协议工具层 (`packet.ts` / `crc.ts`)**
   - 聚焦字节编解码和校验算法
   - 不感知页面状态与业务流程

### 8.3 BluFi 特征与 UUID 约定

本项目默认按 Espressif BluFi 示例约定：

- 主服务 UUID：`0000FFFF-0000-1000-8000-00805F9B34FB`
- 写特征 UUID：`0000FF01-0000-1000-8000-00805F9B34FB`
- 通知特征 UUID：`0000FF02-0000-1000-8000-00805F9B34FB`

页面连接后会完成：

1. 发现服务与特征
2. 设置 MTU（安卓优先尝试 270）
3. 打开 Notify
4. 通过会话层发送版本查询，验证链路

### 8.4 当前配网模式（明文模式）

当前仓库默认采用“先跑通链路”的策略，使用**明文模式**：

- 不启用 DH/AES 安全协商
- 不启用数据帧 CRC（发送侧）
- 接收侧如果包声明有 CRC，仍会按协议校验

> 说明：ESP-IDF BluFi 文档定义中，若未设置安全模式，可使用无加密/无校验方式通信。后续若要提升安全性，可在会话层恢复协商流程并接入 `aes.ts` / `dh.ts`。

### 8.5 STA 配网发送顺序（严格遵循 BluFi）

`session.ts` 中 `configureSta(ssid, password)` 采用如下顺序：

1. `CTRL_SET_WIFI_OPMODE`，值设为 `WIFI_MODE_STA (0x01)`
2. `DATA_STA_SSID (0x02)`，发送 SSID 字节
3. `DATA_STA_PASSWORD (0x03)`，发送密码字节
4. `CTRL_CONNECT_WIFI (0x03)`，通知设备开始连接 AP

每个步骤之间会有短间隔，降低不同手机蓝牙栈下的写入抖动风险。

### 8.6 接收处理逻辑

会话层 `handleIncoming(...)` 的主要行为：

1. 校验是否来自 Notify 特征（`FF02`）
2. `unpack` 解析协议头
3. 记录并检查接收序号（用于发现乱序/丢包）
4. 若对端要求 ACK，则自动回 ACK
5. 处理分片重组
6. 按 `type/subtype` 分发事件

关键数据子类型处理：

- `DATA_VERSION (0x10)`：上报版本，更新页面显示
- `DATA_WIFI_CONNECTION_STATE (0x0F)`：上报 STA 连接结果
- `DATA_WIFI_LIST (0x11)`：上报扫描列表原始数据
- `DATA_ERROR (0x12)`：上报设备错误码

### 8.7 分片与 ACK 机制

#### 分片规则

- 发送时若负载超过单包最大长度，会自动分片
- 非最后一片在 data 前 2 字节附带“剩余总长度”
- 接收端会做分片长度一致性校验，异常分片会被丢弃

#### ACK 规则

- 当收到包 `requireAck=1` 时，会话层自动回 ACK
- 若发送端主动要求 ACK，会维护等待表并带超时控制

### 8.8 页面状态说明

`index.tsx` 主要状态：

- `Idle`：初始状态
- `Scanning`：扫描设备
- `Connecting`：建立连接中
- `Connected`：连接已建立，可下发命令
- `Configuring`：发送配网参数中
- `Done`：配网成功
- `Error`：流程异常

Configure 按钮禁用条件：

- `status === 'Connecting'` 或 `isConfiguring === true`

这样可避免连接过程误点，以及重复提交配置。

### 8.9 常量映射（与 ESP32 BluFi 对照）

控制子类型（节选）：

- `0x01`：`CTRL_SET_SEC_MODE`
- `0x02`：`CTRL_SET_WIFI_OPMODE`
- `0x03`：`CTRL_CONNECT_WIFI`
- `0x05`：`CTRL_GET_WIFI_STATUS`
- `0x07`：`CTRL_GET_VERSION`
- `0x09`：`CTRL_GET_WIFI_LIST`

数据子类型（节选）：

- `0x00`：`DATA_NEG`
- `0x02`：`DATA_STA_SSID`
- `0x03`：`DATA_STA_PASSWORD`
- `0x0F`：`DATA_WIFI_CONNECTION_STATE`
- `0x10`：`DATA_VERSION`
- `0x11`：`DATA_WIFI_LIST`
- `0x12`：`DATA_ERROR`

### 8.10 扩展建议

1. **恢复安全协商**
   - 在 `session.ts` 增加“明文/安全模式”开关
   - 接入 `dh.ts` 计算共享密钥
   - 接入 `aes.ts` 完成加解密和校验

2. **拆分会话层**
   - 可进一步拆成 `transport.ts`（收发）+ `protocol.ts`（子类型分发）+ `session.ts`（状态机）

3. **补充可观测性**
   - 增加统一 trace id
   - 区分“协议错误 / 链路错误 / 设备业务错误”

4. **补充测试**
   - 为 `packet.ts`、`crc.ts`、`session.ts` 的分片/ACK/子类型分发补单元测试

### 8.11 快速排障清单

1. **一直收不到版本**
   - 检查是否订阅了 `FF02` Notify
   - 检查写特征是否是 `FF01`
   - 检查设备是否真的暴露了 `FFFF` 服务

2. **版本能收到但配网失败**
   - 确认子类型是否使用 `DATA_STA_SSID (0x02)` 和 `DATA_STA_PASSWORD (0x03)`
   - 检查发送顺序是否为 OP_MODE -> SSID -> PASSWORD -> CONNECT

3. **连接频繁中断**
   - 尝试降低发送频率（增大片间隔）
   - 安卓机型尝试不同 MTU（如 128/185/247/270）

4. **小程序端接口失败**
   - 检查设备权限是否包含 `*_ENCRYPTED`
   - 小程序场景优先用明文权限，安全性放到应用层实现
