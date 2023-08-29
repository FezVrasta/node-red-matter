import { CommissioningServer } from '@project-chip/matter-node.js';
import {
  OnOffLightDevice,
  OnOffPluginUnitDevice,
} from '@project-chip/matter-node.js/device';
import {
  commandExecutor,
  logEndpoint,
} from '@project-chip/matter-node.js/util';
import { DeviceTypeId, VendorId } from '@project-chip/matter.js/datatype';
// @ts-ignore
import pickPort from 'pick-port';

export enum DeviceType {
  OnOffPluginUnitDevice = 'OnOffPluginUnitDevice',
  OnOffLightDevice = 'OnOffLightDevice',
}
interface CommissionMessage {
  qrCode: string;
  qrPairingCode: string;
  manualPairingCode: string;
  qrCodeUrl: string;
  commissioned: boolean;
}

export class MatterOnOffDevice {
  commissioningServer: CommissioningServer | undefined;
  uniqueId: string;
  device: OnOffPluginUnitDevice | OnOffLightDevice | undefined;

  port: number;
  deviceType: DeviceType;
  deviceName = 'Matter test device';
  vendorName = 'Node RED Matter';
  passcode = 20202021;
  discriminator: number;
  // product name / id and vendor id should match what is in the device certificate
  vendorId = 0xfff1;
  productName: string;
  productId: number;

  constructor(
    deviceType: DeviceType,
    port: number,
    uniqueId: string,
    discriminator: number,
    productId: number
  ) {
    this.port = Number(port);
    this.deviceType = deviceType;
    this.uniqueId = uniqueId;
    this.discriminator = discriminator;
    this.productId = productId;

    this.productName = this.deviceType.substring(0, 32);
  }

  async start({
    onStatusChange,
  }: {
    onStatusChange: (isOn: boolean | undefined) => void;
  }): Promise<CommissioningServer> {
    const port: number =
      this.port === 0
        ? await pickPort({ type: 'udp', minPort: 5400, maxPort: 5540 })
        : this.port;

    /**
     * Create Device instance and add needed Listener
     *
     * Create an instance of the matter device class you want to use.
     * This example uses the OnOffLightDevice or OnOffPluginUnitDevice depending on the value of the type  parameter.
     * To execute the on/off scripts defined as parameters a listener for the onOff attribute is registered via the
     * device specific API.
     *
     * The below logic also adds command handlers for commands of clusters that normally are handled device internally
     * like identify that can be implemented with the logic when these commands are called.
     */

    switch (this.deviceType) {
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

    const commissioningServer = new CommissioningServer({
      port,
      deviceName: this.deviceName,
      deviceType: DeviceTypeId(this.device.deviceType),
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

    logEndpoint(commissioningServer.getRootEndpoint());
    return commissioningServer;
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
}
