import type { NodeAPI, Node, NodeDef } from 'node-red';
import { MatterServer } from '../modules/matter-server';
import {
  CommissioningController,
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

    const serverInit = new Deferred<void>();

    const serverStart = new Deferred<MatterNodeServer>();
    node.serverPromise = serverStart.promise;

    const matterServer = new MatterServer();
    matterServer
      .init({
        storageLocation: `${nodeRedFolderPath}/node-red-matter/matter-servers/${node.id}`,
      })
      .then(() => {
        serverInit.resolve();
      });

    if (devices.size === 0) {
      serverInit.promise.then(() => {
        node.log('Starting matter server');
        matterServer.start().then(() => {
          serverStart.resolve(matterServer.matterServer);
        });
      });
    }

    node.addListener(
      'add_commissioning_server',
      async (nodeId: string, commissioningServer: CommissioningServer) => {
        await serverInit.promise;
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
          serverStart.resolve(matterServer.matterServer);
        }
      }
    );

    node.addListener(
      'add_commissioning_controller',
      async (
        nodeId: string,
        commissioningController: CommissioningController
      ) => {
        await serverInit.promise;
        devices.set(nodeId, true);

        matterServer.addCommissioningController(commissioningController);

        // Only start the server after all the devices have been added or failed to be added
        if (Array.from(devices.values()).every((value) => value)) {
          node.log('Starting matter server');
          await matterServer.start();
          try {
            await commissioningController.connect();
          } catch (e) {
            node.error(e);
          }
          serverStart.resolve(matterServer.matterServer);
        }
      }
    );

    node.on('close', async (done: () => void) => {
      node.log('Stopping matter server');
      await serverInit.promise;
      await matterServer.stop();
      done();
    });
  }

  RED.nodes.registerType('matter-server', MatterServerNode);
}
