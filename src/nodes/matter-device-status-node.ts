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

        switch (status.type) {
          case DeviceType.OnOffLightDevice:
          case DeviceType.OnOffPluginUnitDevice: {
            node.status({
              fill: status.status.on
                ? 'green'
                : status.status.on === false
                ? 'red'
                : 'grey',
              shape: 'dot',
              text: status.status.on
                ? 'on'
                : status.status.on === false
                ? 'off'
                : 'unknown',
            });
            break;
          }
          case DeviceType.DimmableLightDevice:
          case DeviceType.DimmablePluginUnitDevice: {
            const level = status.status.level;
            const levelText =
              level != null ? ` (${Math.round(level)}%)` : '(unknown %)';
            node.status({
              fill: status.status.on
                ? 'green'
                : status.status.on === false
                ? 'red'
                : 'grey',
              shape: 'dot',
              text: status.status.on
                ? `on ${levelText}`
                : status.status.on === false
                ? `off ${levelText}`
                : 'unknown',
            });
            break;
          }
        }
      }
    );
  };
}

export default function (RED: NodeAPI) {
  RED.nodes.registerType('matter-device-status', MatterDeviceStatusNode(RED));
}
