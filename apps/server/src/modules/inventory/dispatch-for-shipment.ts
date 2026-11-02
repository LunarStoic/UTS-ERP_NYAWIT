import type { EntityManager } from '@mikro-orm/mysql';
import { recordInventoryMovement } from './record-inventory-movement.js';
export function dispatchForShipment(
  em: EntityManager,
  input: {
    shipmentId: string;
    warehouseId: string;
    productId: string;
    quantity: bigint;
    movementDate: string;
  },
) {
  return recordInventoryMovement(em, {
    type: 'ISSUE',
    warehouseId: input.warehouseId,
    productId: input.productId,
    movementDate: input.movementDate,
    sourceId: input.shipmentId,
    quantity: input.quantity,
  });
}
