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
import { Time } from '@project-chip/matter-node.js/time';
import {
  commandExecutor,
  getIntParameter,
  getParameter,
  logEndpoint,
  requireMinNodeVersion,
} from '@project-chip/matter-node.js/util';
import { DeviceTypeId, VendorId } from '@project-chip/matter.js/datatype';

Logger.defaultLogLevel = Level.INFO;

requireMinNodeVersion(16);

interface CommissionMessage {
  qrCode: string;
  qrPairingCode: string;
  manualPairingCode: string;
  qrCodeUrl: string;
}

export class MatterDevice {
  private matterServer: MatterServer | undefined;
  uniqueId: number | undefined;
  onOffDevice: OnOffLightDevice | OnOffPluginUnitDevice | undefined;

  async start({
    storageLocation,
    onStatusChange,
  }: {
    storageLocation: string;
    onStatusChange: (isOn: boolean | undefined) => void;
  }): Promise<CommissionMessage | undefined> {
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
     * Collect all needed data
     *
     * This block makes sure to collect all needed data from cli or storage. Replace this with where ever your data
     * come from.
     *
     * Note: This example also uses the initialized storage system to store the device parameter data for convenience
     * and easy reuse. When you also do that be careful to not overlap with Matter-Server own contexts
     * (so maybe better not ;-)).
     */

    const deviceStorage = storageManager.createContext('Device');

    if (deviceStorage.has('isSocket')) {
      console.info('Device type found in storage. -type parameter is ignored.');
    }
    const isSocket = deviceStorage.get(
      'isSocket',
      getParameter('type') === 'socket'
    );
    const deviceName = 'Matter test device';
    const vendorName = 'matter-node.js';
    const passcode =
      getIntParameter('passcode') ?? deviceStorage.get('passcode', 20202021);
    const discriminator =
      getIntParameter('discriminator') ??
      deviceStorage.get('discriminator', 3840);
    // product name / id and vendor id should match what is in the device certificate
    const vendorId =
      getIntParameter('vendorid') ?? deviceStorage.get('vendorid', 0xfff1);
    const productName = `node-matter OnOff ${isSocket ? 'Socket' : 'Light'}`;
    const productId =
      getIntParameter('productid') ?? deviceStorage.get('productid', 0x8000);

    const netAnnounceInterface = getParameter('announceinterface');
    const port = getIntParameter('port') ?? 5540;

    const uniqueId =
      getIntParameter('uniqueid') ??
      deviceStorage.get('uniqueid', Time.nowMs());
    this.uniqueId = uniqueId;

    deviceStorage.set('passcode', passcode);
    deviceStorage.set('discriminator', discriminator);
    deviceStorage.set('vendorid', vendorId);
    deviceStorage.set('productid', productId);
    deviceStorage.set('isSocket', isSocket);
    deviceStorage.set('uniqueid', uniqueId);

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

    const onOffDevice = isSocket
      ? new OnOffPluginUnitDevice()
      : new OnOffLightDevice();
    this.onOffDevice = onOffDevice;
    onOffDevice.addOnOffListener((on) =>
      commandExecutor(on ? 'on' : 'off')?.()
    );

    onOffDevice.addCommandHandler(
      'identify',
      async ({ request: { identifyTime } }) =>
        console.info(`Identify called for OnOffDevice: ${identifyTime}`)
    );

    onOffDevice.addOnOffListener(() => {
      onOffDevice.isOn().then((on) => {
        onStatusChange(on);
      });
    });
    onOffDevice.isOn().then((on) => {
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

    this.matterServer = new MatterServer(storageManager, netAnnounceInterface);

    const commissioningServer = new CommissioningServer({
      port,
      deviceName,
      deviceType: DeviceTypeId(onOffDevice.deviceType),
      passcode,
      discriminator,
      basicInformation: {
        vendorName,
        vendorId: VendorId(vendorId),
        nodeLabel: productName,
        productName,
        productLabel: productName,
        productId,
        serialNumber: `node-matter-${uniqueId}`,
      },
      delayedAnnouncement: false,
    });

    commissioningServer.addDevice(onOffDevice);

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
