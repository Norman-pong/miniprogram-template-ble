import asyncio
from bleak.backends.winrt.util import allow_sta
from winrt.windows.devices.radios import Radio
from winrt.windows.devices.bluetooth import BluetoothAdapter

async def check_adapter():
    print("Checking Bluetooth Adapter Capabilities...")
    try:
        adapter = await BluetoothAdapter.get_default_async()
        if not adapter:
            print("No Bluetooth Adapter found!")
            return

        print(f"Adapter ID: {adapter.device_id}")
        print(f"Is Low Energy Supported: {adapter.is_low_energy_supported}")
        print(f"Is Peripheral Role Supported: {adapter.is_peripheral_role_supported}")
        print(f"Is Central Role Supported: {adapter.is_central_role_supported}")
        print(f"Is Advertisement Offload Supported: {adapter.is_advertisement_offload_supported}")
        
        if not adapter.is_peripheral_role_supported:
            print("\n[CRITICAL]: Your Bluetooth adapter DOES NOT support Peripheral Role.")
            print("You cannot simulate a BLE device on this PC.")
        else:
            print("\n[OK]: Your adapter supports Peripheral Role.")

    except Exception as e:
        print(f"Error checking adapter: {e}")

if __name__ == "__main__":
    allow_sta()
    asyncio.run(check_adapter())
