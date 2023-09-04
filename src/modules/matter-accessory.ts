import {
  DimmableLightDevice,
  DimmablePluginUnitDevice,
  OnOffLightDevice,
  OnOffPluginUnitDevice,
} from '@project-chip/matter-node.js/device';
import { commandExecutor } from '@project-chip/matter-node.js/util';
import { DeviceType, MatterDevice } from './matter-device';

export class MatterAccessory extends MatterDevice {
  override device:
    | OnOffPluginUnitDevice
    | OnOffLightDevice
    | DimmablePluginUnitDevice
    | DimmableLightDevice;

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

    const options = {
      uniqueStorageKey: uniqueId,
    };

    switch (deviceType) {
      case DeviceType.OnOffPluginUnitDevice:
        this.device = new OnOffPluginUnitDevice(undefined, options);
        break;
      case DeviceType.OnOffLightDevice:
        this.device = new OnOffLightDevice(undefined, options);
        break;
      case DeviceType.DimmablePluginUnitDevice:
        this.device = new DimmablePluginUnitDevice(
          undefined,
          undefined,
          options
        );
        break;
      case DeviceType.DimmableLightDevice:
        this.device = new DimmableLightDevice(undefined, undefined, options);
        break;
      default:
        throw new Error('Unknown device type');
    }

    this.device.addOnOffListener((on) => {
      commandExecutor(on ? 'on' : 'off')?.();
      onStatusChange(on);
    });

    this.device.isOn().then((on) => {
      console.log('IS ON', on);
      onStatusChange(on);
    });
  }
}
