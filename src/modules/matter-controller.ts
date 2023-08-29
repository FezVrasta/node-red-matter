import {
  CommissioningController,
  MatterServer,
} from '@project-chip/matter-node.js';
import {
  BasicInformationCluster,
  GeneralCommissioning,
  OnOffCluster,
} from '@project-chip/matter-node.js/cluster';
import { CommissioningOptions } from '@project-chip/matter-node.js/protocol';
import { ManualPairingCodeCodec } from '@project-chip/matter-node.js/schema';
import { logEndpoint } from '@project-chip/matter-node.js/util';

export class MatterController {
  private matterServer: MatterServer;

  constructor(matterServer: MatterServer) {
    this.matterServer = matterServer;
  }

  async pair(
    pairingCode: string,
    ip: string | undefined,
    port: number | undefined,
    onStatusChange: (status: boolean | undefined) => void
  ) {
    const pairingCodeCodec = ManualPairingCodeCodec.decode(pairingCode);
    const shortDiscriminator = pairingCodeCodec.shortDiscriminator;
    const passcode = pairingCodeCodec.passcode;

    const commissioningOptions: CommissioningOptions = {
      regulatoryLocation:
        GeneralCommissioning.RegulatoryLocationType.IndoorOutdoor,
      regulatoryCountryCode: 'XX',
    };

    const commissioningController = new CommissioningController({
      serverAddress:
        ip != null && port != null ? { ip, port, type: 'udp' } : undefined,
      longDiscriminator: undefined,
      shortDiscriminator,
      passcode,
      delayedPairing: true,
      commissioningOptions,
      subscribeAllAttributes: true,
    });

    logEndpoint(commissioningController.getRootEndpoint());

    this.matterServer.addCommissioningController(commissioningController);

    await commissioningController.connect();

    const devices = commissioningController.getDevices();
    const info = commissioningController.getRootClusterClient(
      BasicInformationCluster
    );

    if (info !== undefined) {
      console.log(await info.getProductNameAttribute());
    } else {
      console.log(
        'No BasicInformation Cluster found. This should never happen!'
      );
    }

    console.log('devices', devices.length);
    if (devices[0]) {
      const onOff = devices[0].getClusterClient(OnOffCluster);
      if (onOff !== undefined) {
        const onOffStatus = await onOff.getOnOffAttribute();
        onStatusChange(onOffStatus);

        onOff.addOnOffAttributeListener((value) => {
          console.log('onOffStatus', value);
          onStatusChange(value);
        });
      }
    }
  }
}
