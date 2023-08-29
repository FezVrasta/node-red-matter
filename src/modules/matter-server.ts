import {
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

Logger.defaultLogLevel = Level.FATAL;

export class MatterServer {
  private matterServer: MatterNodeServer | undefined;

  async init({ storageLocation }: { storageLocation: string }) {
    const storage = new StorageBackendDisk(storageLocation);
    const storageManager = new StorageManager(storage);
    await storageManager.initialize();

    this.matterServer = new MatterNodeServer(storageManager);
  }

  addCommissioningServer(commissioningServer: CommissioningServer) {
    this.matterServer?.addCommissioningServer(commissioningServer);
  }

  async start() {
    await this.matterServer?.start();
  }

  async stop() {
    await this.matterServer?.close();
  }
}
