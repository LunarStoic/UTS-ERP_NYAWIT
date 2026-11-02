import type { DeliverySettlementBreakdown } from './delivery-settlement-calculator.js';
export class ShipmentRuleError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
// Aggregate Root satu pengiriman. Inventory menentukan biaya; Shipment menyimpan faktanya.
export class Shipment {
  status = 'IN_TRANSIT';
  version = 1;
  createdAt = new Date();
  private constructor(
    readonly id: string,
    readonly documentNumber: string,
    readonly shipmentDate: string,
    readonly warehouseId: string,
    readonly productId: string,
    readonly customerId: string | null,
    readonly loadingQuantity: bigint,
    readonly loadingInventoryCost: bigint,
  ) {}

  static reconstitute(input: Parameters<typeof Shipment.create>[0] & { status: string; version: number; createdAt: Date }) {
    const shipment = new Shipment(input.id, input.documentNumber, input.shipmentDate,
      input.warehouseId, input.productId, input.customerId, input.loadingQuantity, input.loadingInventoryCost);
    shipment.status = input.status; shipment.version = input.version; shipment.createdAt = input.createdAt;
    return shipment;
  }

  completeDelivery(b: DeliverySettlementBreakdown): void {
    if (this.status !== 'IN_TRANSIT')
      throw new ShipmentRuleError('SHIPMENT_INVALID_STATE_TRANSITION', 'Pengiriman tidak lagi IN_TRANSIT.');
    if ([b.acceptedGrams, b.rejectGrams, b.shrinkageGrams].some(x => x < 0n) ||
      b.acceptedGrams + b.rejectGrams + b.shrinkageGrams !== this.loadingQuantity)
      throw new ShipmentRuleError('SHIPMENT_PHYSICAL_QUANTITY_RECONCILIATION_MISMATCH', 'Jumlah diterima, reject dan susut harus sama dengan muat.');
    if ([b.grossRevenueRupiah, b.discountRupiah, b.netRevenueRupiah].some(x => x < 0n) ||
      b.netRevenueRupiah !== b.grossRevenueRupiah - b.discountRupiah)
      throw new ShipmentRuleError('SHIPMENT_SETTLEMENT_REVENUE_MISMATCH', 'Pendapatan bersih tidak sesuai.');
    this.status = 'COMPLETED';
  }


  static create(input: {
    id: string;
    documentNumber: string;
    shipmentDate: string;
    warehouseId: string;
    productId: string;
    customerId: string | null;
    loadingQuantity: bigint;
    loadingInventoryCost: bigint;
  }) {
    if (!input.documentNumber.trim())
      throw new ShipmentRuleError(
        'SHIPMENT_INVALID_DOCUMENT_NUMBER',
        'Nomor dokumen pengiriman tidak boleh kosong.',
      );
    if (input.loadingQuantity <= 0n)
      throw new ShipmentRuleError(
        'SHIPMENT_INVALID_LOADING_QUANTITY',
        'Jumlah muat harus lebih besar dari nol.',
      );
    if (input.loadingInventoryCost < 0n) throw Error('Biaya muat tidak boleh negatif.');
    return new Shipment(
      input.id,
      input.documentNumber,
      input.shipmentDate,
      input.warehouseId,
      input.productId,
      input.customerId,
      input.loadingQuantity,
      input.loadingInventoryCost,
    );
  }
}
