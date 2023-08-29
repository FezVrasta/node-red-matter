import type { NodeAPI, Node, NodeDef } from 'node-red';
import { MatterServer } from '../modules/matter-server';
import { CommissioningServer } from '@project-chip/matter-node.js';
import { MatterDeviceNodeConfig } from './matter-device-node';

interface MatterServerNodeConfig extends NodeDef {}

interface MatterServerNode extends Node {}

export default function (RED: NodeAPI) {
  function MatterServerNode(
    this: MatterServerNode,
    config: MatterServerNodeConfig
  ) {
    const node = this;
    RED.nodes.createNode(node, config);

    const devices = new Map<string, boolean>();
    RED.nodes.eachNode((node: NodeDef) => {
      if (node.type === 'matter-device') {
        if ((node as MatterDeviceNodeConfig).server == null) return;

        devices.set(node.id, false);
      }
    });

    const nodeRedFolderPath = RED.settings.userDir;

    const matterServer = new MatterServer();
    matterServer.init({
      storageLocation: `${nodeRedFolderPath}/node-red-matter/matter-servers/${node.id}`,
    });

    node.addListener(
      'add_commissioning_server',
      async (nodeId: string, commissioningServer: CommissioningServer) => {
        devices.set(nodeId, true);

        try {
          matterServer.addCommissioningServer(commissioningServer);
        } catch (e) {
          node.error(e);
        }

        // Only start the server after all the devices have been added or failed to be added
        if (Array.from(devices.values()).every((value) => value)) {
          await matterServer.start();
        }
      }
    );
  }

  RED.nodes.registerType('matter-server', MatterServerNode);
}
