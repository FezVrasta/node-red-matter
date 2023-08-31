import type { NodeAPI, Node, NodeDef } from 'node-red';
import { DeviceType, MatterOnOffDevice } from '../modules/matter-device';
import { MatterServerNode } from './matter-server-node';
import { MatterAggregator } from '../modules/matter-aggregator';
import { ObservableMap } from '../utils/ObservableMap';
import { DeviceCategory } from './matter-device-node';

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
  server: MatterServerNode;
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
    node.server = server;

    const matterDevice = new MatterAggregator(
      Number(config.port),
      node.id,
      Number(config.discriminator),
      Number(config.productid ?? 0x8000)
    );

    const relatedNodes: ObservableMap<string, boolean> = new ObservableMap();
    RED.nodes.eachNode((n: NodeDef) => {
      if (
        (n as any).aggregator === node.id &&
        (n as any).devicecategory === DeviceCategory.aggregated
      ) {
        relatedNodes.set(n.id, false);
      }
    });

    const matterDevices: MatterOnOffDevice[] = [];
    node.addListener(
      'add_bridged_device',
      async (id: string, device: MatterOnOffDevice) => {
        node.log(`Adding device ${id} to aggregator`);
        matterDevices.push(device);
        relatedNodes.set(id, true);
      }
    );

    if (relatedNodes.size === 0) {
      startAggregator();
    }

    const timeout = setTimeout(() => {
      node.warn(
        'Not all devices were added to the aggregator, starting anyway but in a potentially unstable state'
      );
      startAggregator();
    }, 8000);

    relatedNodes.addListener(async (relatedNodes) => {
      // Only start the server after all the devices have been added or failed to be added
      if (Array.from(relatedNodes.values()).every((value) => value)) {
        clearTimeout(timeout);
        node.log(
          `All related nodes added (${relatedNodes.size}/${relatedNodes.size})`
        );
        startAggregator();
      } else {
        const addedDevices = Array.from(relatedNodes.values()).filter(
          (value) => value === true
        ).length;
        node.log(
          `Waiting for all bridged devices to be added (${addedDevices}/${relatedNodes.size})`
        );
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
