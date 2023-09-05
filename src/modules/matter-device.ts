import { CommissioningServer } from '@project-chip/matter-node.js';
// @ts-ignore
import pickPort from 'pick-port';
import {
  Aggregator,
  DeviceTypes,
  OnOffLightDevice,
  OnOffPluginUnitDevice,
} from '@project-chip/matter-node.js/device';
import { VendorId } from '@project-chip/matter-node.js/datatype';

export enum DeviceTypeIds {
  Aggregator = DeviceTypes.AGGREGATOR.code,
  OnOffPluginUnitDevice = DeviceTypes.ON_OFF_PLUGIN_UNIT.code,
  OnOffLightDevice = DeviceTypes.ON_OFF_LIGHT.code,
  DimmablePluginUnitDevice = DeviceTypes.DIMMABLE_PLUGIN_UNIT.code,
  DimmableLightDevice = DeviceTypes.DIMMABLE_LIGHT.code,
}

export enum DeviceType {
  Aggregator = 'Aggregator',
  OnOffPluginUnitDevice = 'OnOffPluginUnitDevice',
  OnOffLightDevice = 'OnOffLightDevice',
  DimmablePluginUnitDevice = 'DimmablePluginUnitDevice',
  DimmableLightDevice = 'DimmableLightDevice',
}

const deviceTypeNames = {
  [DeviceType.Aggregator]: 'Aggregator',
  [DeviceType.OnOffPluginUnitDevice]: 'OnOffPluginUnitDevice',
  [DeviceType.OnOffLightDevice]: 'OnOffLightDevice',
  [DeviceType.DimmablePluginUnitDevice]: 'DimmablePluginUnitDevice',
  [DeviceType.DimmableLightDevice]: 'DimmableLightDevice',
};

interface CommissionMessage {
  qrCode: string;
  qrPairingCode: string;
  manualPairingCode: string;
  qrCodeUrl: string;
  commissioned: boolean;
}

export class MatterDevice<SubDeviceType extends DeviceType> {
  device: OnOffPluginUnitDevice | OnOffLightDevice | Aggregator | undefined;
  commissioningServer: CommissioningServer | undefined;
  uniqueId: string;
  port: number;
  deviceType: SubDeviceType;
  deviceName = 'Matter test device';
  vendorName = 'Node RED Matter';
  passcode = 20202021;
  discriminator: number;
  // product name / id and vendor id should match what is in the device certificate
  vendorId = 0xfff1;
  productName: string = 'Matter test device';
  productId: number;

  constructor({
    deviceType,
    port,
    uniqueId,
    discriminator,
    productId,
    deviceName,
  }: {
    deviceType: SubDeviceType;
    port: number;
    uniqueId: string;
    discriminator: number;
    productId: number;
    deviceName: string;
  }) {
    this.port = Number(port);
    this.uniqueId = uniqueId;
    this.discriminator = discriminator;
    this.productId = productId;
    this.deviceName = deviceName;
    this.deviceType = deviceType;
    this.productName = deviceTypeNames[deviceType];
  }

  async getPortNumber(port: number): Promise<number> {
    return port === 0
      ? pickPort({ type: 'udp', minPort: 5400, maxPort: 5540 })
      : port;
  }

  async getPairingData(): Promise<CommissionMessage> {
    if (this.commissioningServer == null) {
      throw new Error('Commissioning server not initialized');
    }

    /**
     * Print Pairing Information
     *
     * If the device is not already commissioned (this info is stored in the storage system) then get and print the
     * pairing details. This includes the QR code that can be scanned by the Matter app to pair the device.
     */

    const commissioned = this.commissioningServer.isCommissioned();
    const pairingData = this.commissioningServer.getPairingCode({
      ble: false,
      softAccessPoint: false,
      onIpNetwork: false,
    });

    const { qrCode, qrPairingCode, manualPairingCode } = pairingData;

    return {
      qrCode,
      qrPairingCode,
      manualPairingCode,
      qrCodeUrl: `https://project-chip.github.io/connectedhomeip/qrcode.html?data=${qrPairingCode}`,
      commissioned,
    };
  }

  async start(): Promise<CommissioningServer> {
    if (this.device == null) {
      throw new Error('Device not initialized');
    }

    const port: number = await this.getPortNumber(this.port);

    const commissioningServer = new CommissioningServer({
      port,
      deviceName: this.deviceName,
      deviceType: DeviceTypeIds[this.deviceType],
      passcode: this.passcode,
      discriminator: this.discriminator,
      basicInformation: {
        vendorName: this.vendorName,
        vendorId: VendorId(this.vendorId),
        nodeLabel: this.productName,
        productName: this.productName,
        productLabel: this.productName,
        productId: this.productId,
        serialNumber: `node-red-matter-${this.uniqueId}`,
      },
      delayedAnnouncement: false,
    });

    commissioningServer.addDevice(this.device);
    this.commissioningServer = commissioningServer;

    return commissioningServer;
  }
}
