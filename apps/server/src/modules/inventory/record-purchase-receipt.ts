import type { EntityManager } from '@mikro-orm/mysql';
import type { PurchaseReceiptAcceptedV1Payload } from './index.js';
import { recordInventoryMovement } from './record-inventory-movement.js';

export function recordPurchaseReceipt(
  em: EntityManager,
  receipt: PurchaseReceiptAcceptedV1Payload,
) {
  return recordInventoryMovement(em, {
    type: 'RECEIPT',
    warehouseId: receipt.warehouseId,
    productId: receipt.productId,
    movementDate: receipt.receiptDate,
    sourceId: receipt.purchaseReceiptId,
    quantity: BigInt(receipt.quantityGrams),
    purchaseRate: BigInt(receipt.unitPriceMicroRupiahPerKg),
    total: BigInt(receipt.totalAmountRupiah),
  });
}
