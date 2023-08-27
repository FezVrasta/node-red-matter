import type { NodeAPI, Node, NodeDef } from 'node-red';
import { DeviceType, MatterOnOffDevice } from '../modules/matter-on-off-device';
import path from 'path';

interface MatterDeviceNodeConfig extends NodeDef {
  devicetype: DeviceType;
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

    const matterDevice = new MatterOnOffDevice(config.devicetype);

    const nodeRedFolderPath = path.resolve(
      path.dirname(process.env.NODE_RED_HOME ?? '~/.node-red/node_modules'),
      '..'
    );

    matterDevice
      .start({
        storageLocation: `${nodeRedFolderPath}/.matter-devices/${this.id}`,
        onStatusChange: (status) => {
          const message: StatusChangeMessage = {
            type: config.devicetype,
            status,
          };
          node.emit('status_change', message);
        },
      })
      .then((message) => {
        if (message) {
          node.qrcode = message.qrCode;
          node.manualPairingCode = message.manualPairingCode;

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
        }
      })
      .catch((err) => console.error(err));

    node.addListener('change_status', (status) => {
      if (matterDevice.device == null) {
        return;
      }

      switch (config.devicetype) {
        case DeviceType.OnOffLightDevice:
        case DeviceType.OnOffPluginUnitDevice:
          matterDevice.device.onOff(status);
          break;
        default:
          node.warn(`Unknown device type ${config.devicetype}`);
      }
    });
  }

  RED.nodes.registerType('matter-device', MatterDeviceNode);
}
