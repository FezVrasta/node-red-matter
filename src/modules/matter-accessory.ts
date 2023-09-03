import {
  OnOffLightDevice,
  OnOffPluginUnitDevice,
} from '@project-chip/matter-node.js/device';
import { commandExecutor } from '@project-chip/matter-node.js/util';
import { DeviceType, MatterDevice } from './matter-device';

export class MatterAccessory extends MatterDevice {
  override device: OnOffPluginUnitDevice | OnOffLightDevice;

  constructor({
    deviceType,
    port,
    uniqueId,
    discriminator,
    productId,
    deviceName,
    onStatusChange,
  }: {
    deviceType: DeviceType;
    port: number;
    uniqueId: string;
    discriminator: number;
    productId: number;
    deviceName: string;
    onStatusChange: (isOn: boolean | undefined) => void;
  }) {
    super({
      deviceType,
      port,
      uniqueId,
      discriminator,
      productId,
      deviceName,
    });

    switch (deviceType) {
      case DeviceType.OnOffPluginUnitDevice:
        this.device = new OnOffPluginUnitDevice();
        break;
      case DeviceType.OnOffLightDevice:
        this.device = new OnOffLightDevice();
        break;
      default:
        throw new Error('Unknown device type');
    }

    this.device.addOnOffListener((on) => {
      commandExecutor(on ? 'on' : 'off')?.();
      onStatusChange(on);
    });

    this.device.isOn().then((on) => {
      onStatusChange(on);
    });
  }
}
