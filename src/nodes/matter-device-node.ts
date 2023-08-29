import type { NodeAPI, Node, NodeDef } from 'node-red';
import { DeviceType, MatterOnOffDevice } from '../modules/matter-device';

export interface MatterDeviceNodeConfig extends NodeDef {
  server: string;
  devicetype: DeviceType;
  port: number;
  discriminator: number;
  productid: string;
}

interface MatterDeviceNode extends Node {
  qrcode: string;
  manualPairingCode: string;
}

export type StatusChangeMessage = {
  type: DeviceType;
  status: boolean | undefined;
};

export default function (RED: NodeAPI) {
  RED.httpAdmin.route('/node-red-matter/pairingcode').get(function (req, res) {
    const deviceId = req.query['device-id' as never] as string;
    const node = RED.nodes.getNode(deviceId) as MatterDeviceNode;

    if (node == null) {
      res.status(404).send('Device not found');
      return;
    }

    const message = {
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

    const matterDevice = new MatterOnOffDevice(
      config.devicetype,
      Number(config.port),
      node.id,
      Number(config.discriminator),
      Number(config.productid ?? 0x8000)
    );

    const nodeRedFolderPath = RED.settings.userDir;

    matterDevice
      .start({
        storageLocation: `${nodeRedFolderPath}/node-red-matter/matter-devices/${this.id}`,
        onStatusChange: (status) => {
          const message: StatusChangeMessage = {
            type: config.devicetype,
            status,
          };
          node.emit('status_change', message);
        },
      })
      .then((message) => {
        // Register device to Matter server
        const commissioningServer = message.commissioningServer;
        const matterServer = RED.nodes.getNode(config.server) as Node;

        if (matterServer == null) {
          node.warn(`Matter server ${config.server} not found`);
          return;
        }

        matterServer.emit(
          'add_commissioning_server',
          node.id,
          commissioningServer
        );

        // Store pairing code
        node.qrcode = message.qrCode;
        node.manualPairingCode = message.manualPairingCode;

        // Handle device updates
        if (matterDevice.device == null) {
          return;
        }

        switch (config.devicetype) {
          case DeviceType.OnOffLightDevice:
          case DeviceType.OnOffPluginUnitDevice:
            matterDevice.device.isOn().then((status) => {
              const updateStatusMessage: StatusChangeMessage = {
                type: config.devicetype,
                status,
              };
              node.emit('status_change', updateStatusMessage);
            });
            break;
          default:
            node.warn(`Unknown device type ${config.devicetype}`);
        }
      })
      .catch((err) => console.error(err));

    // Receive status change requests from matter-device-control nodes
    node.addListener('change_status', (status) => {
      if (matterDevice.device == null) {
        return;
      }

      switch (config.devicetype) {
        case DeviceType.OnOffLightDevice:
        case DeviceType.OnOffPluginUnitDevice:
          if (typeof status !== 'boolean') {
            node.warn(
              `Invalid status ${status} for device type ${config.devicetype}`
            );
            return;
          }
          matterDevice.device.onOff(status);
          break;
        default:
          node.warn(`Unknown device type ${config.devicetype}`);
      }
    });
  }

  RED.nodes.registerType('matter-device', MatterDeviceNode);
}
