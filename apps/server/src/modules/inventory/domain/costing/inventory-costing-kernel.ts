// Semua angka menggunakan gram, rupiah, atau micro-rupiah/kg, bukan number pecahan.
export function computeValue(quantity: bigint, rate: bigint): bigint {
  return (quantity * rate + 500_000_000n) / 1_000_000_000n;
}
export function computeAverage(value: bigint, quantity: bigint): bigint {
  if (quantity === 0n) return 0n;
  if ((value < 0n && quantity > 0n) || (value > 0n && quantity < 0n))
    throw Error('Biaya rata-rata tidak boleh negatif.');
  const absoluteValue = value < 0n ? -value : value;
  const absoluteQuantity = quantity < 0n ? -quantity : quantity;
  return (absoluteValue * 1_000_000_000n + absoluteQuantity / 2n) / absoluteQuantity;
}
// Domain Service: kebijakan biaya, tanpa identitas, SQL, HTTP atau clock.
export const InventoryCostingKernel = {
  receipt(input: {
    quantity: bigint;
    value: bigint;
    receiptQuantity: bigint;
    totalReceiptValue: bigint;
    purchaseRate: bigint;
  }) {
    if (input.receiptQuantity <= 0n) throw Error('Jumlah penerimaan harus positif.');
    let recoveryVariance = 0n;
    if (input.quantity < 0n) {
      const deficit = -input.quantity;
      const recovery = input.receiptQuantity < deficit ? input.receiptQuantity : deficit;
      const provisional =
        recovery === deficit
          ? -input.value
          : computeValue(recovery, computeAverage(input.value, input.quantity));
      const actual =
        recovery === input.receiptQuantity
          ? input.totalReceiptValue
          : computeValue(recovery, input.purchaseRate);
      recoveryVariance = actual - provisional;
    }
    const valueIn = input.totalReceiptValue - recoveryVariance;
    const quantity = input.quantity + input.receiptQuantity;
    const value = quantity === 0n ? 0n : input.value + valueIn;
    return {
      quantity,
      value,
      average: computeAverage(value, quantity),
      valueIn,
      valueOut: 0n,
      recoveryVariance,
      costSource: 'PURCHASE_PRICE',
    };
  },
  issue(input: {
    quantity: bigint;
    value: bigint;
    issueQuantity: bigint;
    lastNonzero: bigint;
    defaultPurchasePrice: bigint;
    allowNegativeStock: boolean;
  }) {
    if (input.issueQuantity <= 0n) throw Error('Jumlah keluar harus positif.');
    if (input.issueQuantity > input.quantity && !input.allowNegativeStock)
      throw Error('INVENTORY_NEGATIVE_STOCK_NOT_ALLOWED');
    const currentAverage = computeAverage(input.value, input.quantity);
    const rate =
      input.quantity > 0n
        ? currentAverage
        : input.lastNonzero > 0n
          ? input.lastNonzero
          : input.defaultPurchasePrice;
    const costSource =
      input.quantity > 0n
        ? 'CURRENT_AVERAGE'
        : input.lastNonzero > 0n
          ? 'LAST_KNOWN_AVERAGE'
          : input.defaultPurchasePrice > 0n
            ? 'DEFAULT_PURCHASE_PRICE'
            : 'ZERO_FALLBACK';
    const exactDrain = input.quantity > 0n && input.issueQuantity === input.quantity;
    const valueOut = exactDrain ? input.value : computeValue(input.issueQuantity, rate);
    const quantity = input.quantity - input.issueQuantity;
    const value = exactDrain ? 0n : input.value - valueOut;
    return {
      quantity,
      value,
      average: computeAverage(value, quantity),
      valueIn: 0n,
      valueOut,
      recoveryVariance: 0n,
      costSource,
    };
  },
};
