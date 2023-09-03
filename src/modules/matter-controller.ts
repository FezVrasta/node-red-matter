import { CommissioningController } from '@project-chip/matter-node.js';
import {
  GeneralCommissioning,
  OnOffCluster,
} from '@project-chip/matter-node.js/cluster';
import { EndpointNumber } from '@project-chip/matter-node.js/datatype';
import { CommissioningOptions } from '@project-chip/matter-node.js/protocol';
import { ManualPairingCodeCodec } from '@project-chip/matter-node.js/schema';
import { logEndpoint } from '@project-chip/matter-node.js/util';

export class MatterController {
  commissioningController: CommissioningController;

  constructor(
    pairingCode: string,
    ip: string | undefined,
    port: number | undefined
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

    this.commissioningController = commissioningController;
  }

  addStatusChangeListener(
    onStatusChange: (data: {
      name: string;
      status: boolean | undefined;
      id: EndpointNumber | undefined;
    }) => void
  ) {
    const devices = this.commissioningController.getDevices();

    const device = devices[0];

    if (device == null) {
      console.error('No devices found');
      return;
    }

    // if the device has child endpoints, subscribe the on/off cluster on each of them
    if (device.getChildEndpoints().length > 0) {
      device.getChildEndpoints().forEach((endpoint) => {
        const onOff = endpoint.getClusterClient(OnOffCluster);

        if (onOff !== undefined) {
          onOff.getOnOffAttribute().then((value) => {
            onStatusChange({
              name: endpoint.name,
              status: value,
              id: endpoint.id,
            });
          });

          onOff.addOnOffAttributeListener((value) => {
            onStatusChange({
              name: endpoint.name,
              status: value,
              id: endpoint.id,
            });
          });
        }
      });
    }

    // Also subscribe the on/off cluster on the root endpoint if it exists
    const onOff = device.getClusterClient(OnOffCluster);
    if (onOff !== undefined) {
      onOff.getOnOffAttribute().then((value) => {
        onStatusChange({ name: device.name, status: value, id: device.id });
      });

      onOff.addOnOffAttributeListener((value) => {
        onStatusChange({ name: device.name, status: value, id: device.id });
      });
    }
  }
}
