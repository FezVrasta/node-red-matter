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

class ObservableMap<K, V> extends Map<K, V> {
  private listeners: Set<(value: any) => void> = new Set();

  override set(key: K, value: V): any {
    super.set(key, value);

    this.listeners.forEach((listener) => listener(this));
  }

  override get(key: K) {
    return super.get(key);
  }

  addListener(listener: (value: any) => void) {
    this.listeners.add(listener);
  }

  removeListener(listener: (value: any) => void) {
    this.listeners.delete(listener);
  }
}

export default function (RED: NodeAPI) {
  function MatterServerNode(
    this: MatterServerNode,
    config: MatterServerNodeConfig
  ) {
    const node = this;
    RED.nodes.createNode(node, config);

    const devices = new ObservableMap<string, boolean>();
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

    async function startServer() {
      node.log('Starting matter server');
      await matterServer.start();
      node.log('Connecting all commissioning controllers');
      await matterServer.connectAllCommissioningControllers();
      node.log('Matter server started');
      serverStart.resolve(matterServer.matterServer);
    }

    if (devices.size === 0) {
      serverInit.promise.then(() => {
        startServer();
      });
    }

    devices.addListener(async (devices) => {
      // Only start the server after all the devices have been added or failed to be added
      if (Array.from(devices.values()).every((value) => value)) {
        startServer();
      } else {
        node.log('Waiting for all devices to be added');
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

        devices.set(nodeId, true);
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
        matterServer.addCommissioningController(commissioningController);

        devices.set(nodeId, true);
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
