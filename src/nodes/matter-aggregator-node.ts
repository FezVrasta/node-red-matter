import type { NodeAPI, Node, NodeDef } from 'node-red';
import { DeviceType, MatterOnOffDevice } from '../modules/matter-device';
import { MatterServerNode } from './matter-server-node';
import { MatterAggregator } from '../modules/matter-aggregator';
import { ObservableMap } from '../utils/ObservableMap';

export interface MatteraggregatorNodeConfig extends NodeDef {
  server: string;
  devicetype: DeviceType;
  port: number;
  discriminator: number;
  productid: string;
}

export interface MatterAggregatorNode extends Node {
  qrcode: string;
  manualPairingCode: string;
  commissioned: boolean;
}

export default function (RED: NodeAPI) {
  RED.httpAdmin
    .route('/node-red-matter/aggregator/pairingcode')
    .get(function (req, res) {
      const deviceId = req.query['device-id' as never] as string;
      const node = RED.nodes.getNode(deviceId) as MatterAggregatorNode;

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

  function MatterAggregatorNode(
    this: MatterAggregatorNode,
    config: MatteraggregatorNodeConfig
  ) {
    const node = this;
    RED.nodes.createNode(node, config);

    const server = RED.nodes.getNode(config.server) as MatterServerNode;

    const matterDevice = new MatterAggregator(
      Number(config.port),
      node.id,
      Number(config.discriminator),
      Number(config.productid ?? 0x8000)
    );

    const devices: ObservableMap<string, boolean> = new ObservableMap();
    RED.nodes.eachNode((n: NodeDef) => {
      if ((n as any).aggregator === node.id) {
        devices.set(n.id, false);
      }
    });
    console.log(devices);

    const matterDevices: MatterOnOffDevice[] = [];
    node.addListener(
      'add_bridged_device',
      async (id: string, device: MatterOnOffDevice) => {
        node.log(`Adding device ${id} to aggregator`);
        matterDevices.push(device);
        devices.set(id, true);
      }
    );

    if (devices.size === 0) {
      startAggregator();
    }

    devices.addListener(async (devices) => {
      // Only start the server after all the devices have been added or failed to be added
      if (Array.from(devices.values()).every((value) => value)) {
        startAggregator();
      } else {
        node.log('Waiting for all bridged devices to be added');
      }
    });

    function startAggregator() {
      node.log('Starting matter aggregator');
      matterDevice
        .start({ devices: matterDevices })
        .then(async (commissioningServer) => {
          // Register device to Matter server
          node.log(`Registering device to Matter server ${config.server}`);

          if (server == null) {
            node.warn(`Matter server ${config.server} not found`);
            return;
          }
          server.emit('add_commissioning_server', node.id, commissioningServer);

          await server.serverPromise;

          const message = await matterDevice.getPairingData();

          // Store pairing code
          node.qrcode = message.qrCode;
          node.manualPairingCode = message.manualPairingCode;
          node.commissioned = message.commissioned;
        });
    }
  }

  RED.nodes.registerType('matter-aggregator', MatterAggregatorNode);
}
