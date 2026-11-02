// Bentuk fakta mengikuti payload aktif; di tahap ini disampaikan lewat pemanggilan sinkron.
export interface PurchaseReceiptAcceptedV1Payload {
  purchaseReceiptId: string;
  documentNumber: string;
  receiptDate: string;
  supplierId: string;
  productId: string;
  warehouseId: string;
  quantityGrams: string;
  unitPriceMicroRupiahPerKg: string;
  totalAmountRupiah: string;
  requestLoanDeduction: boolean;
}
export { recordPurchaseReceipt } from './record-purchase-receipt.js';

export { dispatchForShipment } from './dispatch-for-shipment.js';

export { ShipmentCostAllocationPolicy } from './domain/shipment-cost-allocation/shipment-cost-allocation-policy.js';
