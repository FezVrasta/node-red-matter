import type { NodeAPI, Node, NodeDef } from 'node-red';
import { MatterDeviceNode, StatusChangeMessage } from './matter-device-node';
import { DeviceType } from '../modules/matter-device';

interface MatterDeviceNodeConfig extends NodeDef {
  device: string;
}

interface MatterDeviceStatusNode extends Node {
  qrcode: string;
}

export function MatterDeviceStatusNode(RED: NodeAPI) {
  return function (
    this: MatterDeviceStatusNode,
    config: MatterDeviceNodeConfig
  ) {
    const node = this;
    RED.nodes.createNode(node, config);

    const matterDeviceNode = RED.nodes.getNode(config.device) as
      | MatterDeviceNode
      | undefined;

    node.status({
      fill: 'grey',
      shape: 'dot',
      text: 'unknown',
    });

    if (matterDeviceNode == null) {
      node.error(`Associated matter-device node (${config.device}) not found`);
      return;
    }

    matterDeviceNode.addListener(
      'status_change',
      (status: StatusChangeMessage) => {
        node.send({
          payload: status,
        });

        if (
          status.type === DeviceType.OnOffLightDevice ||
          status.type === DeviceType.OnOffPluginUnitDevice
        ) {
          node.status({
            fill: status.status
              ? 'green'
              : status.status === false
              ? 'red'
              : 'grey',
            shape: 'dot',
            text: status.status
              ? 'on'
              : status.status === false
              ? 'off'
              : 'unknown',
          });
        }
      }
    );
  };
}

export default function (RED: NodeAPI) {
  RED.nodes.registerType('matter-device-status', MatterDeviceStatusNode(RED));
}
