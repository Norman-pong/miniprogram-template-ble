import asyncio
import logging
import sys
from typing import Any
from bless import (
    BlessServer,
    BlessGATTCharacteristic,
    GATTCharacteristicProperties,
    GATTAttributePermissions
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# UUIDs - Using Standard 16-bit UUIDs for testing
# Heart Rate Service: 0x180D -> 0000180D-0000-1000-8000-00805F9B34FB
# Heart Rate Measurement Characteristic: 0x2A37 -> 00002A37-0000-1000-8000-00805F9B34FB
SERVICE_UUID = "0000180D-0000-1000-8000-00805F9B34FB"
CHARACTERISTIC_UUID = "00002A37-0000-1000-8000-00805F9B34FB"

# Global server reference
server_instance = None

def read_request(characteristic: BlessGATTCharacteristic, **kwargs) -> bytearray:
    logger.info(f"Read Request for {characteristic.uuid}")
    # Return dummy heart rate value
    return bytearray([0x00, 0x40])

def write_request(characteristic: BlessGATTCharacteristic, value: Any, **kwargs):
    logger.info(f"Write Request for {characteristic.uuid}: {value}")
    characteristic.value = value

async def run():
    global server_instance

    logger.info("Initializing BLE Server...")

    # Use a very short name to avoid packet overflow
    my_local_name = "HR-Sim"
    server = BlessServer(name=my_local_name)

    server.read_request_func = read_request
    server.write_request_func = write_request
    server_instance = server

    # Add Service
    logger.info(f"Adding Service {SERVICE_UUID}...")
    await server.add_new_service(SERVICE_UUID)

    # Add Characteristic
    char_flags = (
        GATTCharacteristicProperties.read |
        GATTCharacteristicProperties.notify
    )

    permissions = (
        GATTAttributePermissions.readable
    )

    logger.info(f"Adding Characteristic {CHARACTERISTIC_UUID}...")
    await server.add_new_characteristic(
        SERVICE_UUID,
        CHARACTERISTIC_UUID,
        char_flags,
        bytearray([0x00, 0x40]),
        permissions
    )

    logger.info("Starting Server...")
    # start() handles advertising. On Windows, it uses the OS BLE stack.
    await server.start()

    print("\n" + "="*60)
    print(f"BLE ADVERTISING STARTED AS '{my_local_name}'")
    print("="*60)
    print(f"Service UUID: {SERVICE_UUID} (Heart Rate)")
    print("-" * 60)
    print("IMPORTANT:")
    print("1. We switched to a standard Heart Rate UUID to rule out packet size issues.")
    print("2. Please scan again in your Mini Program.")
    print(f"3. Look for '{my_local_name}' or UUID '...180D...'")
    print("="*60 + "\n")

    # Keep the server running
    try:
        while True:
            await asyncio.sleep(1)
            # Update value periodically to simulate heart rate
            if server_instance:
                import random
                hr = random.randint(60, 100)
                # Flag 0, HR value
                val = bytearray([0x00, hr])
                server_instance.get_characteristic(CHARACTERISTIC_UUID).value = val
                server_instance.update_value(SERVICE_UUID, CHARACTERISTIC_UUID)
    except asyncio.CancelledError:
        logger.info("Stopping...")
        await server.stop()
    except Exception as e:
        logger.error(f"Error during runtime: {e}")
        await server.stop()

if __name__ == "__main__":
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        print("\nUser stopped server.")
    except Exception as e:
        print(f"\nError: {e}")
