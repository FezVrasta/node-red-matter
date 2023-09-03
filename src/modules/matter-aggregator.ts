import { Aggregator } from '@project-chip/matter-node.js/device';
import { MatterAccessory } from './matter-accessory';
import { DeviceType, MatterDevice } from './matter-device';

export class MatterAggregator extends MatterDevice {
  override device: Aggregator;

  constructor(
    port: number,
    uniqueId: string,
    discriminator: number,
    productId: number,
    deviceName: string
  ) {
    super({
      deviceType: DeviceType.Aggregator,
      port,
      uniqueId,
      discriminator,
      productId,
      deviceName,
    });

    this.device = new Aggregator();
  }

  addBridgedDevice(device: MatterAccessory) {
    this.device.addBridgedDevice(device.device, {
      nodeLabel: device.deviceName,
      productName: device.deviceName,
      productLabel: device.deviceName,
      serialNumber: `node-red-matter-${device.uniqueId}`,
      reachable: true,
    });
  }
}
