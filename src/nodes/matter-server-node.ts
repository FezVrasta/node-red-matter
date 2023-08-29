import type { NodeAPI, Node, NodeDef } from 'node-red';
import { MatterServer } from '../modules/matter-server';
import {
  CommissioningServer,
  MatterServer as MatterNodeServer,
} from '@project-chip/matter-node.js';
import { Deferred } from 'ts-deferred';

interface MatterServerNodeConfig extends NodeDef {}

export interface MatterServerNode extends Node {
  serverPromise: Promise<MatterNodeServer>;
}

export default function (RED: NodeAPI) {
  function MatterServerNode(
    this: MatterServerNode,
    config: MatterServerNodeConfig
  ) {
    const node = this;
    RED.nodes.createNode(node, config);

    const devices = new Map<string, boolean>();
    RED.nodes.eachNode((n: NodeDef) => {
      if ((n as any).server === node.id) {
        devices.set(n.id, false);
      }
    });

    const nodeRedFolderPath = RED.settings.userDir;

    const deferred = new Deferred<MatterNodeServer>();
    node.serverPromise = deferred.promise;

    const matterServer = new MatterServer();
    matterServer.init({
      storageLocation: `${nodeRedFolderPath}/node-red-matter/matter-servers/${node.id}`,
    });

    console.log(devices);

    if (devices.size === 0) {
      node.log('Starting matter server');
      matterServer.start().then(() => {
        deferred.resolve(matterServer.matterServer);
      });
    }

    node.addListener(
      'add_commissioning_server',
      async (nodeId: string, commissioningServer: CommissioningServer) => {
        devices.set(nodeId, true);

        try {
          matterServer.addCommissioningServer(commissioningServer);
          node.log(`Added commissioning server for ${nodeId}`);
        } catch (e) {
          node.error(e);
        }

        // Only start the server after all the devices have been added or failed to be added
        if (Array.from(devices.values()).every((value) => value)) {
          node.log('Starting matter server');
          await matterServer.start();
          deferred.resolve(matterServer.matterServer);
        }
      }
    );

    node.on('close', async (done: () => void) => {
      node.log('Stopping matter server');
      await matterServer.stop();
      done();
    });
  }

  RED.nodes.registerType('matter-server', MatterServerNode);
}
