import type { NodeAPI, Node, NodeDef } from 'node-red';
import { MatterDevice } from '../modules/matter-device';
import path from 'path';

interface MatterDeviceNodeConfig extends NodeDef {}

interface MatterDeviceNode extends Node {
  qrcode: string;
  manualPairingCode: string;
}

export type StatusChangeMessage = {
  type: 'OnOffLightDevice';
  status: boolean | undefined;
};

export default function (RED: NodeAPI) {
  console.log('setting up path');
  RED.httpAdmin.route('/node-red-matter/pairingcode').get(function (req, res) {
    console.log('FEZ');
    const deviceId = req.query['device-id' as never] as string;
    const node = RED.nodes.getNode(deviceId) as MatterDeviceNode;

    const message = {
      qrcode: node.qrcode,
      manualPairingCode: node.manualPairingCode,
    };

    console.log(message);

    res.json(message);
  });

  function MatterDeviceNode(
    this: MatterDeviceNode,
    config: MatterDeviceNodeConfig
  ) {
    const node = this;
    node.qrcode = 'foobar!';
    RED.nodes.createNode(node, config);

    const matterDevice = new MatterDevice();

    const nodeRedFolderPath = path.resolve(
      path.dirname(process.env.NODE_RED_HOME ?? '~/.node-red/node_modules'),
      '..'
    );

    matterDevice
      .start({
        storageLocation: `${nodeRedFolderPath}/.matter-devices/${this.id}`,
        onStatusChange: (status) => {
          const message: StatusChangeMessage = {
            type: 'OnOffLightDevice',
            status,
          };
          node.emit('status_change', message);
        },
      })
      .then((message) => {
        if (message) {
          node.qrcode = message.qrCode;
          node.manualPairingCode = message.manualPairingCode;

          matterDevice.onOffDevice?.isOn().then((status) => {
            const updateStatusMessage: StatusChangeMessage = {
              type: 'OnOffLightDevice',
              status,
            };
            node.emit('status_change', updateStatusMessage);
          });
        }
        /* done */
      })
      .catch((err) => console.error(err));

    node.addListener('change_status', (status) => {
      console.log('change status', status);
      matterDevice.onOffDevice?.onOff(status);
    });
  }

  RED.nodes.registerType('matter-device', MatterDeviceNode);
}
