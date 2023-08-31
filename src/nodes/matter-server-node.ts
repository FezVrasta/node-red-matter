import type { NodeAPI, Node, NodeDef } from 'node-red';
import { MatterServer } from '../modules/matter-server';
import {
  CommissioningController,
  CommissioningServer,
  MatterServer as MatterNodeServer,
} from '@project-chip/matter-node.js';
import { Deferred } from 'ts-deferred';
import { ObservableMap } from '../utils/ObservableMap';
import { DeviceCategory } from './matter-device-node';

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

    const relatedNodes = new ObservableMap<string, boolean>();
    RED.nodes.eachNode((n: NodeDef) => {
      if (
        (n as any).server === node.id &&
        (n as any).devicecategory === DeviceCategory.standalone
      ) {
        relatedNodes.set(n.id, false);
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

    async function startServer() {
      clearTimeout(timeout);

      node.log('Starting matter server');
      await matterServer.start();
      node.log('Connecting all commissioning controllers');
      try {
        await matterServer.connectAllCommissioningControllers();
      } catch (e) {
        node.error(e);
      }
      node.log('Matter server started');
      serverStart.resolve(matterServer.matterServer);
    }

    const timeout = setTimeout(() => {
      node.warn(
        'Not all devices were added to the server, starting anyway but in a potentially unstable state'
      );
      startServer();
    }, 10000);

    if (relatedNodes.size === 0) {
      serverInit.promise.then(() => {
        startServer();
      });
    }

    relatedNodes.addListener(async (relatedNodes) => {
      // Only start the server after all the devices have been added or failed to be added
      if (Array.from(relatedNodes.values()).every((value) => value)) {
        clearTimeout(timeout);
        node.log(
          `All related nodes added (${relatedNodes.size}/${relatedNodes.size})`
        );
        startServer();
      } else {
        const addedDevices = Array.from(relatedNodes.values()).filter(
          (value) => value === true
        ).length;
        node.log(
          `Waiting for all related nodes to be added (${addedDevices}/${relatedNodes.size}))`
        );
      }
    });

    node.addListener(
      'add_commissioning_server',
      async (nodeId: string, commissioningServer: CommissioningServer) => {
        await serverInit.promise;

        try {
          matterServer.addCommissioningServer(commissioningServer);
          node.log(`Added commissioning server for ${nodeId}`);
        } catch (e) {
          node.error(e);
        }

        relatedNodes.set(nodeId, true);
      }
    );

    node.addListener(
      'add_commissioning_controller',
      async (
        nodeId: string,
        commissioningController: CommissioningController
      ) => {
        await serverInit.promise;

        node.log(`Added commissioning controller for ${nodeId}`);
        try {
          matterServer.addCommissioningController(commissioningController);
        } catch (e) {
          node.error(e);
        }

        relatedNodes.set(nodeId, true);
      }
    );

    node.on('close', async (destroyed: boolean, done: () => void) => {
      await serverInit.promise;
      if (destroyed === false) {
        node.log('Stopping matter server');
        await matterServer.stop();
      } else {
        node.log('Destroying matter server');
        await matterServer.destroy();
      }
      done();
    });
  }

  RED.nodes.registerType('matter-server', MatterServerNode);
}
