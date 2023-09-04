import {
  DimmableLightDevice,
  DimmablePluginUnitDevice,
  OnOffLightDevice,
  OnOffPluginUnitDevice,
} from '@project-chip/matter-node.js/device';
import { commandExecutor } from '@project-chip/matter-node.js/util';
import { DeviceType, MatterDevice } from './matter-device';
import { StatusChangeMessage } from '../nodes/matter-device-node';

export const levelUnit = 100 / 254;

export class MatterAccessory extends MatterDevice<
  | DeviceType.OnOffLightDevice
  | DeviceType.OnOffPluginUnitDevice
  | DeviceType.DimmableLightDevice
  | DeviceType.DimmablePluginUnitDevice
> {
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
    deviceType:
      | DeviceType.OnOffLightDevice
      | DeviceType.OnOffPluginUnitDevice
      | DeviceType.DimmableLightDevice
      | DeviceType.DimmablePluginUnitDevice;
    port: number;
    uniqueId: string;
    discriminator: number;
    productId: number;
    deviceName: string;
    onStatusChange: (isOn: StatusChangeMessage) => void;
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

    if (
      this.device instanceof DimmableLightDevice ||
      this.device instanceof DimmablePluginUnitDevice
    ) {
      this.device.addCurrentLevelListener(async (level) => {
        commandExecutor('brightness')?.();
        const on = await this.device.isOn();

        onStatusChange({
          type: this.deviceType as
            | DeviceType.DimmableLightDevice
            | DeviceType.DimmablePluginUnitDevice,
          name: this.deviceName,
          id: this.device.id,
          status: { level: level != null ? level * levelUnit : level, on },
        });
      });
    }

    this.device.addOnOffListener((on) => {
      commandExecutor(on ? 'on' : 'off')?.();

      if (
        this.device instanceof DimmableLightDevice ||
        this.device instanceof DimmablePluginUnitDevice
      ) {
        const level = this.device.getCurrentLevel();
        onStatusChange({
          type: this.deviceType as
            | DeviceType.DimmableLightDevice
            | DeviceType.DimmablePluginUnitDevice,
          name: this.deviceName,
          id: this.device.id,
          status: {
            on,
            level: level != null ? level * levelUnit : level,
          },
        });
      } else {
        onStatusChange({
          type: this.deviceType,
          name: this.deviceName,
          id: this.device.id,
          status: {
            on,
          },
        });
      }
    });

    this.device.isOn().then((on) => {
      console.log('IS ON', on);
      onStatusChange({
        type: this.deviceType,
        name: this.deviceName,
        id: this.device.id,
        status: { on },
      });
    });
  }
}
