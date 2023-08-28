#!/usr/bin/env node
/**
 * @license
 * Copyright 2022 The node-matter Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * This example shows how to create a simple on-off Matter device.
 * It can be used as CLI script and starting point for your own device node implementation.
 */

/**
 * Import needed modules from @project-chip/matter-node.js
 */
// Include this first to auto-register Crypto, Network and Time Node.js implementations
import {
  CommissioningServer,
  MatterServer,
} from '@project-chip/matter-node.js';

import {
  OnOffLightDevice,
  OnOffPluginUnitDevice,
} from '@project-chip/matter-node.js/device';
import { Level, Logger } from '@project-chip/matter-node.js/log';
import {
  StorageBackendDisk,
  StorageManager,
} from '@project-chip/matter-node.js/storage';
import {
  commandExecutor,
  logEndpoint,
} from '@project-chip/matter-node.js/util';
import { DeviceTypeId, VendorId } from '@project-chip/matter.js/datatype';
// @ts-ignore
import pickPort from 'pick-port';

Logger.defaultLogLevel = Level.FATAL;

export enum DeviceType {
  OnOffPluginUnitDevice = 'OnOffPluginUnitDevice',
  OnOffLightDevice = 'OnOffLightDevice',
}
interface CommissionMessage {
  qrCode: string;
  qrPairingCode: string;
  manualPairingCode: string;
  qrCodeUrl: string;
}

export class MatterOnOffDevice {
  private matterServer: MatterServer | undefined;
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
  productId = 0x8000;

  constructor(
    deviceType: DeviceType,
    port: number,
    uniqueId: string,
    discriminator: number
  ) {
    this.port = Number(port);
    this.deviceType = deviceType;
    this.uniqueId = uniqueId;
    this.discriminator = discriminator;

    this.productName = `node-matter ${this.deviceType}`;
  }

  async start({
    storageLocation,
    onStatusChange,
  }: {
    storageLocation: string;
    onStatusChange: (isOn: boolean | undefined) => void;
  }): Promise<CommissionMessage | undefined> {
    const port: number =
      this.port === 0
        ? await pickPort({ type: 'udp', minPort: 5400, maxPort: 5540 })
        : this.port;
    const storage = new StorageBackendDisk(storageLocation);

    /**
     * Initialize the storage system.
     *
     * The storage manager is then also used by the Matter server, so this code block in general is required,
     * but you can choose a different storage backend as long as it implements the required API.
     */

    const storageManager = new StorageManager(storage);
    await storageManager.initialize();

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

    /**
     * Create Matter Server and CommissioningServer Node
     *
     * To allow the device to be announced, found, paired and operated we need a MatterServer instance and add a
     * commissioningServer to it and add the just created device instance to it.
     * The CommissioningServer node defines the port where the server listens for the UDP packages of the Matter protocol
     * and initializes deice specific certificates and such.
     *
     * The below logic also adds command handlers for commands of clusters that normally are handled internally
     * like testEventTrigger (General Diagnostic Cluster) that can be implemented with the logic when these commands
     * are called.
     */

    this.matterServer = new MatterServer(storageManager);

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

    this.matterServer.addCommissioningServer(commissioningServer);

    /**
     * Start the Matter Server
     *
     * After everything was plugged together we can start the server. When not delayed announcement is set for the
     * CommissioningServer node then this command also starts the announcement of the device into the network.
     */

    await this.matterServer.start();

    logEndpoint(commissioningServer.getRootEndpoint());

    /**
     * Print Pairing Information
     *
     * If the device is not already commissioned (this info is stored in the storage system) then get and print the
     * pairing details. This includes the QR code that can be scanned by the Matter app to pair the device.
     */

    const pairingData = commissioningServer.getPairingCode({
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
    };
  }

  async stop() {
    await this.matterServer?.close();
  }
}
