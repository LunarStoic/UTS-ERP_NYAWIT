import {
  computeAverage,
  computeValue,
  InventoryCostingKernel,
} from '../costing/inventory-costing-kernel.js';

export interface InventoryMovement {
  id: string;
  movementDate: string;
  movementType: string;
  sequenceNo: bigint;
  quantityInGrams: bigint;
  quantityOutGrams: bigint;
  valueInRupiah: bigint;
  valueOutRupiah: bigint;
  recoveryVarianceRupiah: bigint;
  balanceQuantityGrams: bigint;
  sourceType: string;
  sourceId: string;
}
export interface RecordReceiptInput {
  id: string;
  movementDate: string;
  receiptQuantity: bigint;
  purchaseRate: bigint;
  sourceId: string;
}

export class InventoryPool {
  constructor(readonly id: string, readonly warehouseId: string, readonly productId: string, private movements: readonly InventoryMovement[]) {}

  recordReceipt(input: RecordReceiptInput) {
    if (input.receiptQuantity <= 0n) throw Error('Jumlah penerimaan harus lebih besar dari nol.');
    if (input.purchaseRate < 0n) throw Error('Harga pembelian tidak boleh negatif.');
    const receiptValueRupiah = computeValue(input.receiptQuantity, input.purchaseRate);
    const result = this.record(
      {
        id: input.id,
        movementDate: input.movementDate,
        movementType: 'RECEIPT',
        sequenceNo: BigInt(this.movements.length + 1),
        quantityInGrams: input.receiptQuantity,
        quantityOutGrams: 0n,
        valueInRupiah: receiptValueRupiah,
        valueOutRupiah: 0n,
        recoveryVarianceRupiah: 0n,
        balanceQuantityGrams: 0n,
        sourceType: 'PurchaseReceipt',
        sourceId: input.sourceId,
      },
      input.purchaseRate,
    );
    return { ...result, receiptValueRupiah };
  }

  recordIssue(input: {
    id: string;
    movementDate: string;
    issueQuantity: bigint;
    sourceId: string;
  }) {
    if (input.issueQuantity <= 0n) throw Error('Jumlah keluar harus lebih besar dari nol.');
    return this.record({
      id: input.id,
      movementDate: input.movementDate,
      movementType: 'ISSUE',
      sequenceNo: BigInt(this.movements.length + 1),
      quantityInGrams: 0n,
      quantityOutGrams: input.issueQuantity,
      valueInRupiah: 0n,
      valueOutRupiah: 0n,
      recoveryVarianceRupiah: 0n,
      balanceQuantityGrams: 0n,
      sourceType: 'Shipment',
      sourceId: input.sourceId,
    });
  }

  private record(incoming: InventoryMovement, incomingPurchaseRate?: bigint) {
    const ordered = [...this.movements, incoming].sort(
      (a, b) =>
        a.movementDate.localeCompare(b.movementDate) ||
        Number(a.movementType === 'ISSUE') - Number(b.movementType === 'ISSUE') ||
        (a.sequenceNo < b.sequenceNo ? -1 : a.sequenceNo > b.sequenceNo ? 1 : 0),
    );
    let quantity = 0n,
      value = 0n,
      lastNonzero = 0n,
      availableBeforeIncoming = 0n;
    const currentStock = this.movements.at(-1)?.balanceQuantityGrams ?? 0n;
    const affectedShipments: { shipmentId: string; newLoadingInventoryCostRupiah: string }[] = [];
    const laterShortfalls: {
      movementDate: string;
      sourceType: string;
      sourceId: string;
      balanceGrams: string;
    }[] = [];
    const movements = ordered.map((movement, index) => {
      if (movement.id === incoming.id) availableBeforeIncoming = quantity;
      if (!['RECEIPT', 'ISSUE'].includes(movement.movementType))
        throw Error('Jenis pergerakan belum didukung.');
      const totalReceiptValue = movement.valueInRupiah + movement.recoveryVarianceRupiah;
      const outcome =
        movement.movementType === 'RECEIPT'
          ? InventoryCostingKernel.receipt({
              quantity,
              value,
              receiptQuantity: movement.quantityInGrams,
              totalReceiptValue,
              purchaseRate:
                movement.id === incoming.id && incomingPurchaseRate !== undefined
                  ? incomingPurchaseRate
                  : computeAverage(totalReceiptValue, movement.quantityInGrams),
            })
          : // Produk tahap ini belum mempunyai baris konfigurasi: default aktif adalah true dan harga 0.
            InventoryCostingKernel.issue({
              quantity,
              value,
              issueQuantity: movement.quantityOutGrams,
              lastNonzero,
              defaultPurchasePrice: 0n,
              allowNegativeStock: true,
            });
      quantity = outcome.quantity;
      value = outcome.value;
      if (quantity > 0n && outcome.average > 0n) lastNonzero = outcome.average;
      if (
        movement.id !== incoming.id &&
        movement.sourceType === 'Shipment' &&
        movement.valueOutRupiah !== outcome.valueOut
      )
        affectedShipments.push({
          shipmentId: movement.sourceId,
          newLoadingInventoryCostRupiah: outcome.valueOut.toString(),
        });
      if (movement.id !== incoming.id && movement.balanceQuantityGrams >= 0n && quantity < 0n)
        laterShortfalls.push({
          movementDate: movement.movementDate,
          sourceType: movement.sourceType,
          sourceId: movement.sourceId,
          balanceGrams: quantity.toString(),
        });
      return {
        ...movement,
        sequenceNo: BigInt(index + 1),
        valueInRupiah: outcome.valueIn,
        valueOutRupiah: outcome.valueOut,
        recoveryVarianceRupiah: outcome.recoveryVariance,
        balanceQuantityGrams: quantity,
        balanceValueRupiah: value,
        averageCostMicroRupiahPerKg: outcome.average,
        costSource: outcome.costSource,
      };
    });
    const own = movements.find((row) => row.id === incoming.id)!;
    const exceedsStockOnDate =
      incoming.quantityOutGrams > 0n && incoming.quantityOutGrams > availableBeforeIncoming;
    const negativeStockNotice =
      exceedsStockOnDate || laterShortfalls.length
        ? {
            movementDate: incoming.movementDate,
            exceedsStockOnDate,
            availableAsOfGrams: (availableBeforeIncoming > 0n
              ? availableBeforeIncoming
              : 0n
            ).toString(),
            issueGrams: incoming.quantityOutGrams.toString(),
            resultingBalanceGrams: own.balanceQuantityGrams.toString(),
            currentStockGrams: currentStock.toString(),
            laterShortfalls,
          }
        : null;
    this.movements = movements;
    return {
      movements,
      incoming: own,
      affectedShipments,
      negativeStockNotice,
      lastNonzeroAverageCostMicroRupiahPerKg: lastNonzero,
    };
  }
}
