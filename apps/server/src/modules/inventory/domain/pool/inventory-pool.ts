export interface InventoryMovement {
  id: string;
  movementDate: string;
  movementType: string;
  sequenceNo: bigint;
  quantityInGrams: bigint;
  valueInRupiah: bigint;
}
export interface RecordReceiptInput {
  id: string;
  movementDate: string;
  receiptQuantity: bigint;
  purchaseRate: bigint;
}
// Model domain satu pasangan Produk–Gudang. Tidak mengetahui SQL, Express atau MikroORM.
export class InventoryPool {
  constructor(
    readonly id: string,
    readonly warehouseId: string,
    readonly productId: string,
    private movements: readonly InventoryMovement[],
  ) {}
  recordReceipt(input: RecordReceiptInput) {
    if (input.receiptQuantity <= 0n) throw new Error('Jumlah penerimaan harus lebih besar dari nol.');
    if (input.purchaseRate < 0n) throw new Error('Harga pembelian tidak boleh negatif.');
    if (this.movements.some(movement => movement.movementType !== 'RECEIPT')) {
      throw new Error('Perhitungan tahap ini hanya mendukung penerimaan.');
    }
    const valueIn = (input.receiptQuantity * input.purchaseRate + 500_000_000n) / 1_000_000_000n;
    const receipt: InventoryMovement = {
      id: input.id, movementDate: input.movementDate, movementType: 'RECEIPT',
      sequenceNo: BigInt(this.movements.length + 1), quantityInGrams: input.receiptQuantity,
      valueInRupiah: valueIn,
    };
    const ordered = [...this.movements, receipt].sort((a, b) => a.movementDate.localeCompare(b.movementDate)
      || (a.sequenceNo < b.sequenceNo ? -1 : a.sequenceNo > b.sequenceNo ? 1 : 0));
    let quantity = 0n;
    let value = 0n;
    let lastNonzeroAverageCostMicroRupiahPerKg = 0n;
    const movements = ordered.map((movement, index) => {
      quantity += movement.quantityInGrams;
      value += movement.valueInRupiah;
      const average = (value * 1_000_000_000n + quantity / 2n) / quantity;
      if (average > 0n) lastNonzeroAverageCostMicroRupiahPerKg = average;
      return { ...movement, sequenceNo: BigInt(index + 1), balanceQuantityGrams: quantity,
        balanceValueRupiah: value, averageCostMicroRupiahPerKg: average };
    });
    this.movements = movements;
    return { movements, receiptValueRupiah: valueIn, lastNonzeroAverageCostMicroRupiahPerKg };
  }
}
