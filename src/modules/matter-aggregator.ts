import { CommissioningServer } from '@project-chip/matter-node.js';
import { Aggregator, DeviceTypes } from '@project-chip/matter-node.js/device';
import { logEndpoint } from '@project-chip/matter-node.js/util';
import { VendorId } from '@project-chip/matter.js/datatype';
// @ts-ignore
import pickPort from 'pick-port';
import { MatterOnOffDevice } from './matter-device';

interface CommissionMessage {
  qrCode: string;
  qrPairingCode: string;
  manualPairingCode: string;
  qrCodeUrl: string;
  commissioned: boolean;
}

export class MatterAggregator {
  commissioningServer: CommissioningServer | undefined;
  uniqueId: string;
  device: Aggregator | undefined;

  port: number;
  deviceName = 'Matter test device';
  vendorName = 'Node RED Matter';
  passcode = 20202021;
  discriminator: number;
  // product name / id and vendor id should match what is in the device certificate
  vendorId = 0xfff1;
  productName: string;
  productId: number;

  constructor(
    port: number,
    uniqueId: string,
    discriminator: number,
    productId: number,
    deviceName: string
  ) {
    this.port = Number(port);
    this.uniqueId = uniqueId;
    this.discriminator = discriminator;
    this.productId = productId;

    this.productName = 'Aggregator';
    this.deviceName = deviceName;
  }

  async start({
    devices,
  }: {
    devices: MatterOnOffDevice[];
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

    this.device = new Aggregator();

    const commissioningServer = new CommissioningServer({
      port,
      deviceName: this.deviceName,
      deviceType: DeviceTypes.AGGREGATOR.code,
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

    devices.forEach((device) => {
      if (device.device == null) {
        console.warn(
          `Device ${device.uniqueId} not initialized so cannot be added`
        );
        return;
      }

      this.device?.addBridgedDevice(device.device, {
        nodeLabel: device.deviceName,
        productName: device.deviceName,
        productLabel: device.deviceName,
        serialNumber: `node-red-matter-${device.uniqueId}`,
        reachable: true,
      });
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
