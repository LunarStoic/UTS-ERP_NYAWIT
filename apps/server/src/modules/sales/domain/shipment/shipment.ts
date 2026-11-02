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
  readonly status = 'IN_TRANSIT';
  readonly version = 1;
  readonly createdAt = new Date();
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
