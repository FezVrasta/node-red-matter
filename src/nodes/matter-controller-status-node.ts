import type { NodeAPI } from 'node-red';
import { MatterDeviceStatusNode } from './matter-device-status-node';

export default function (RED: NodeAPI) {
  RED.nodes.registerType(
    'matter-controller-status',
    MatterDeviceStatusNode(RED)
  );
}
