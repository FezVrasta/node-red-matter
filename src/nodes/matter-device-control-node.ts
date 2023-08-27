import type { NodeAPI, Node, NodeDef } from 'node-red';
import { StatusChangeMessage } from './matter-device-node';

interface MatterDeviceNodeConfig extends NodeDef {
  device: string;
}

interface MatterDeviceControlNode extends Node {
  qrcode: string;
}

export default function (RED: NodeAPI) {
  function MatterDeviceControlNode(
    this: MatterDeviceControlNode,
    config: MatterDeviceNodeConfig
  ) {
    const node = this;
    RED.nodes.createNode(node, config);

    const matterDeviceNode = RED.nodes.getNode(config.device);

    node.on('input', (msg) => {
      const payload = msg.payload as StatusChangeMessage['status'];
      matterDeviceNode.emit('change_status', payload);
    });
  }

  RED.nodes.registerType('matter-device-control', MatterDeviceControlNode);
}
