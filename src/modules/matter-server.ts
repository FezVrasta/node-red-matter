import {
  CommissioningController,
  CommissioningServer,
  MatterServer as MatterNodeServer,
} from '@project-chip/matter-node.js';
import { Level, Logger } from '@project-chip/matter-node.js/log';
import {
  StorageBackendDisk,
  StorageManager,
} from '@project-chip/matter-node.js/storage';
// @ts-ignore
import pickPort from 'pick-port';
import fs from 'node:fs';

const LOG_LEVEL = Number(process.env.NODE_RED_MATTER_LOG_LEVEL);
switch (LOG_LEVEL) {
  case 0:
    Logger.defaultLogLevel = Level.DEBUG;
    break;
  case 1:
    Logger.defaultLogLevel = Level.INFO;
    break;
  case 2:
    Logger.defaultLogLevel = Level.WARN;
    break;
  case 3:
    Logger.defaultLogLevel = Level.ERROR;
    break;
  case 4:
    Logger.defaultLogLevel = Level.FATAL;
    break;
  default:
    Logger.defaultLogLevel = Level.ERROR;
}

export class MatterServer {
  matterServer: MatterNodeServer | undefined;
  storageLocation: string | undefined;

  async init({ storageLocation }: { storageLocation: string }) {
    this.storageLocation = storageLocation;
    const storage = new StorageBackendDisk(storageLocation);
    const storageManager = new StorageManager(storage);
    await storageManager.initialize();

    this.matterServer = new MatterNodeServer(storageManager);
  }

  addCommissioningServer(commissioningServer: CommissioningServer) {
    if (this.matterServer == null) {
      throw new Error('Matter server not initialized');
    }

    this.matterServer?.addCommissioningServer(commissioningServer);
  }

  private commissioningControllers: CommissioningController[] = [];
  connectAllCommissioningControllers() {
    return Promise.all(
      this.commissioningControllers.map((commissioningController) => {
        return commissioningController.connect();
      })
    );
  }

  addCommissioningController(commissioningController: CommissioningController) {
    if (this.matterServer == null) {
      throw new Error('Matter server not initialized');
    }

    this.commissioningControllers.push(commissioningController);
    this.matterServer?.addCommissioningController(commissioningController);
  }

  async start() {
    if (this.matterServer == null) {
      throw new Error('Matter server not initialized');
    }
    await this.matterServer?.start();
  }

  async stop() {
    if (this.matterServer == null) {
      throw new Error('Matter server not initialized');
    }
    await this.matterServer?.close();
  }

  async destroy() {
    if (this.matterServer == null) {
      throw new Error('Matter server not initialized');
    }
    await this.matterServer?.close();
    if (this.storageLocation == null) {
      throw new Error('Storage location not initialized');
    }

    fs.rmdirSync(this.storageLocation, { recursive: true });
  }
}
