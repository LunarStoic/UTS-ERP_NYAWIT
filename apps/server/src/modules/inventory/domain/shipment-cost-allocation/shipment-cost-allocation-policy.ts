export class InvalidShipmentCostAllocationInputError extends Error {
  readonly code = 'INVENTORY_INVALID_SHIPMENT_COST_ALLOCATION_INPUT';
  constructor(reason: string) {
    super(`Data alokasi biaya pengiriman tidak valid: ${reason}`);
  }
}
export interface ShipmentCostAllocationInput {
  loadingQuantity: bigint;
  acceptedQuantity: bigint;
  rejectQuantity: bigint;
  shrinkageQuantity: bigint;
  frozenLoadingInventoryCost: bigint;
}
export interface ShipmentCostAllocationResult {
  cogs: bigint;
  rejectAllocatedValue: bigint;
  shrinkageLoss: bigint;
}
export const ShipmentCostAllocationPolicy = {
  allocate(input: ShipmentCostAllocationInput): ShipmentCostAllocationResult {
    if (input.loadingQuantity <= 0n) {
      throw new InvalidShipmentCostAllocationInputError('Jumlah muat harus lebih besar dari nol.');
    }
    // Quantity pada codebase aktif menolak nilai negatif; bigint lokal perlu pemeriksaan ini.
    if (
      [input.acceptedQuantity, input.rejectQuantity, input.shrinkageQuantity].some(
        (value) => value < 0n,
      )
    ) {
      throw new InvalidShipmentCostAllocationInputError(
        'Jumlah diterima, reject dan susut tidak boleh negatif.',
      );
    }
    if (
      input.acceptedQuantity + input.rejectQuantity + input.shrinkageQuantity !==
      input.loadingQuantity
    ) {
      throw new InvalidShipmentCostAllocationInputError(
        'loadingQuantity must equal acceptedQuantity + rejectQuantity + shrinkageQuantity.',
      );
    }
    if (input.frozenLoadingInventoryCost < 0n) {
      throw new InvalidShipmentCostAllocationInputError(
        'Biaya muat persediaan tidak boleh negatif.',
      );
    }
    const rejectAllocatedValue =
      (input.frozenLoadingInventoryCost * input.rejectQuantity) / input.loadingQuantity;
    const shrinkageLoss =
      (input.frozenLoadingInventoryCost * input.shrinkageQuantity) / input.loadingQuantity;
    const cogs = input.frozenLoadingInventoryCost - rejectAllocatedValue - shrinkageLoss;
    return { cogs, rejectAllocatedValue, shrinkageLoss };
  },
};
