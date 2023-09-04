import type { NodeAPI, Node, NodeDef } from 'node-red';
import { DeviceType } from '../modules/matter-device';
import { MatterAccessory, levelUnit } from '../modules/matter-accessory';
import { MatterServerNode } from './matter-server-node';
import { EndpointNumber } from '@project-chip/matter-node.js/datatype';
import { MatterAggregatorNode } from './matter-aggregator-node';
import {
  DimmableLightDevice,
  DimmablePluginUnitDevice,
  OnOffLightDevice,
  OnOffPluginUnitDevice,
} from '@project-chip/matter-node.js/device';

export enum DeviceCategory {
  standalone = 'standalone',
  aggregated = 'aggregated',
}

export interface MatterDeviceNodeConfig extends NodeDef {
  server: string;
  aggregator: string;
  devicecategory: DeviceCategory;
  devicetype:
    | DeviceType.OnOffLightDevice
    | DeviceType.OnOffPluginUnitDevice
    | DeviceType.DimmableLightDevice
    | DeviceType.DimmablePluginUnitDevice;
  port: number;
  discriminator: number;
  productid: string;
}

export interface MatterDeviceNode extends Node {
  qrcode: string;
  manualPairingCode: string;
  commissioned: boolean;
  device: MatterAccessory;
}

export type StatusChangeMessage =
  | {
      type: DeviceType.OnOffLightDevice | DeviceType.OnOffPluginUnitDevice;
      name: string;
      id: EndpointNumber | undefined;
      status: {
        on?: boolean | null;
      };
    }
  | {
      type:
        | DeviceType.DimmableLightDevice
        | DeviceType.DimmablePluginUnitDevice;
      name: string;
      id: EndpointNumber | undefined;
      status: {
        on?: boolean | null;
        level?: number | null;
      };
    };

export default function (RED: NodeAPI) {
  RED.httpAdmin
    .route('/node-red-matter/device/pairingcode')
    .get(function (req, res) {
      const deviceId = req.query['device-id' as never] as string;
      const node = RED.nodes.getNode(deviceId) as MatterDeviceNode | undefined;

      if (node == null) {
        res.status(404).send('Device not found');
        return;
      }

      const message = {
        commissioned: node.commissioned,
        qrcode: node.qrcode,
        manualPairingCode: node.manualPairingCode,
      };

      res.json(message);
    });

  function MatterDeviceNode(
    this: MatterDeviceNode,
    config: MatterDeviceNodeConfig
  ) {
    const node = this;
    RED.nodes.createNode(node, config);

    const server = RED.nodes.getNode(config.server) as
      | MatterServerNode
      | undefined;
    const aggregator = RED.nodes.getNode(config.aggregator) as
      | MatterAggregatorNode
      | undefined;

    if (config.devicecategory === DeviceCategory.standalone && server == null) {
      node.error(`Matter server ${config.server} not found`);
      return;
    } else if (
      config.devicecategory === DeviceCategory.aggregated &&
      aggregator == null
    ) {
      node.error(`Matter aggregator ${config.aggregator} not found`);
      return;
    }

    const matterDevice = new MatterAccessory({
      deviceType: config.devicetype,
      port: Number(config.port),
      uniqueId: node.id,
      discriminator: Number(config.discriminator),
      productId: Number(config.productid ?? 0x8000),
      deviceName: node.name ?? node.id,
      onStatusChange: (status) => {
        node.emit('status_change', status);
      },
    });
    node.device = matterDevice;

    async function start() {
      // If the accessory is standalone, start the commissioning server
      if (
        config.devicecategory === DeviceCategory.standalone &&
        server != null
      ) {
        const commissioningServer = await matterDevice.start();

        server.emit('add_commissioning_server', node.id, commissioningServer);
        await server.serverPromise;

        // Pairing data is available only if running as standalone device
        const message = await matterDevice.getPairingData();
        // Store pairing code
        node.qrcode = message.qrCode;
        node.manualPairingCode = message.manualPairingCode;
        node.commissioned = message.commissioned;
      } else if (
        config.devicecategory === DeviceCategory.aggregated &&
        aggregator != null
      ) {
        aggregator.emit('add_bridged_device', node.id, matterDevice);
        await aggregator.server.serverPromise;
      } else {
        node.error('No server or aggregator found');
        return;
      }
    }
    start();

    // Receive status change requests from matter-device-control nodes
    node.addListener('change_status', (status) => {
      Object.entries(status).forEach(([key, value]) => {
        switch (key) {
          case 'on':
            if (
              matterDevice.device instanceof DimmableLightDevice ||
              matterDevice.device instanceof DimmablePluginUnitDevice ||
              matterDevice.device instanceof OnOffLightDevice ||
              matterDevice.device instanceof OnOffPluginUnitDevice
            ) {
              if (typeof value !== 'boolean') {
                node.warn(
                  `Invalid status ${status} for device type ${config.devicetype}`
                );
                return;
              }
              matterDevice.device.onOff(value);
            } else {
              node.warn(
                `Invalid status ${status} for device type ${config.devicetype}`
              );
            }
            break;
          case 'level':
            if (
              matterDevice.device instanceof DimmableLightDevice ||
              matterDevice.device instanceof DimmablePluginUnitDevice
            ) {
              if (typeof value !== 'number') {
                node.warn(
                  `Invalid status ${status} for device type ${config.devicetype}`
                );
                return;
              }
              matterDevice.device.setCurrentLevel(value / levelUnit);
            } else {
              node.warn(
                `Invalid status ${status} for device type ${config.devicetype}`
              );
            }
            break;
          default:
            node.warn(`Unknown device type ${config.devicetype}`);
        }
      });
    });
  }

  RED.nodes.registerType('matter-device', MatterDeviceNode);
}
