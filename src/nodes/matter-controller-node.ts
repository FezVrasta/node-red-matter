import type { NodeAPI, Node, NodeDef } from 'node-red';
import { MatterController } from '../modules/matter-controller';
import { MatterServerNode } from './matter-server-node';
import { StatusChangeMessage } from './matter-device-node';
import { DeviceType } from '../modules/matter-device';

export interface MatterControllerNodeConfig extends NodeDef {
  server: string;
  pairingcode: string;
  port: number | undefined;
  ip: string | undefined;
}

interface MatterControllerNode extends Node {}

export default function (RED: NodeAPI) {
  function MatterDeviceNode(
    this: MatterControllerNode,
    config: MatterControllerNodeConfig
  ) {
    const node = this;
    RED.nodes.createNode(node, config);

    const server = RED.nodes.getNode(config.server) as MatterServerNode;

    if (server == null) {
      node.error(`Associated matter-server node (${config.server}) not found`);
      return;
    }

    server.serverPromise.then((matterServer) => {
      console.log('got a server');
      const controller = new MatterController(matterServer);

      controller
        .pair(config.pairingcode, config.ip, config.port, (status) => {
          console.log('status', status);
          const updateStatusMessage: StatusChangeMessage = {
            type: DeviceType.OnOffLightDevice,
            status,
          };
          node.emit('status_change', updateStatusMessage);
        })
        .catch((e) => {
          node.error(e);
        });
    });
  }

  RED.nodes.registerType('matter-controller', MatterDeviceNode);
}
