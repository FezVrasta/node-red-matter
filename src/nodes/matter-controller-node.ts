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

    const server = RED.nodes.getNode(config.server) as
      | MatterServerNode
      | undefined;

    if (server == null) {
      node.error(`Associated matter-server node (${config.server}) not found`);
      return;
    }

    const controller = new MatterController(
      config.pairingcode,
      config.ip,
      config.port
    );

    server.emit(
      'add_commissioning_controller',
      node.id,
      controller.commissioningController
    );

    server.serverPromise.then(() => {
      controller.addStatusChangeListener(({ name, status, id }) => {
        const updateStatusMessage: StatusChangeMessage = {
          type: DeviceType.OnOffLightDevice,
          name,
          id,
          status: { on: status },
        };
        node.emit('status_change', updateStatusMessage);
      });
    });
  }

  RED.nodes.registerType('matter-controller', MatterDeviceNode);
}
