import {
  CommissioningController,
  CommissioningServer,
  MatterServer as MatterNodeServer,
} from '@project-chip/matter-node.js';
import {
  StorageBackendDisk,
  StorageManager,
} from '@project-chip/matter-node.js/storage';
// @ts-ignore
import pickPort from 'pick-port';
import fs from 'node:fs';
import { logEndpoint } from '@project-chip/matter-node.js/util';

export class MatterServer {
  matterServer: MatterNodeServer;
  storageLocation: string;

  constructor({ storageLocation }: { storageLocation: string }) {
    this.storageLocation = storageLocation;
    const storage = new StorageBackendDisk(storageLocation);
    const storageManager = new StorageManager(storage);

    // This is async but the StorageBackendDisk is not actually making use of async operations
    storageManager.initialize();

    this.matterServer = new MatterNodeServer(storageManager);
  }

  private commissioningServers: CommissioningServer[] = [];
  addCommissioningServer(commissioningServer: CommissioningServer) {
    this.commissioningServers.push(commissioningServer);
    this.matterServer.addCommissioningServer(commissioningServer);
  }

  private logAllEndpoints() {
    [...this.commissioningServers, ...this.commissioningControllers].forEach(
      (item) => {
        logEndpoint(item.getRootEndpoint());
      }
    );
  }

  private commissioningControllers: CommissioningController[] = [];
  private connectAllCommissioningControllers() {
    return Promise.all(
      this.commissioningControllers.map((commissioningController) => {
        return commissioningController.connect();
      })
    );
  }

  addCommissioningController(commissioningController: CommissioningController) {
    this.commissioningControllers.push(commissioningController);
    this.matterServer.addCommissioningController(commissioningController);
  }

  async start() {
    await this.matterServer.start();
    this.logAllEndpoints();
    await this.connectAllCommissioningControllers();
  }

  async stop() {
    await this.matterServer.close();
  }

  async destroy() {
    await this.matterServer.close();

    fs.rmdirSync(this.storageLocation, { recursive: true });
  }
}
