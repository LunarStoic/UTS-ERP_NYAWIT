import { randomUUID } from 'node:crypto';
import type { DeliverySettlementBreakdown } from '../shipment/delivery-settlement-calculator.js';
export class SalesSettlementRuleError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}
export class SalesSettlement {
  readonly id = randomUUID();
  readonly status = 'SETTLED';
  readonly version = 1;
  readonly createdAt = new Date();
  private constructor(readonly shipmentId: string, readonly settlementDate: string,
    readonly receivingReferenceNumber: string | null, readonly amounts: DeliverySettlementBreakdown) {}
  static create(input: { shipmentId: string; settlementDate: string;
    receivingReferenceNumber: string | null; amounts: DeliverySettlementBreakdown }) {
    const b = input.amounts;
    if (b.acceptedGrams <= 0n)
      throw new SalesSettlementRuleError('SALES_SETTLEMENT_INVALID_ACCEPTED_QUANTITY', 'Jumlah diterima harus lebih besar dari nol.');
    if (b.rejectGrams < 0n || b.shrinkageGrams < 0n)
      throw new SalesSettlementRuleError('SALES_SETTLEMENT_INVALID_QUANTITY', 'Jumlah tidak boleh negatif.');
    if ([b.sellingPriceMicroRupiahPerKg, b.grossRevenueRupiah, b.discountRupiah, b.netRevenueRupiah].some(x => x < 0n))
      throw new SalesSettlementRuleError('SALES_SETTLEMENT_INVALID_AMOUNT', 'Nilai penjualan tidak boleh negatif.');
    if (b.netRevenueRupiah !== b.grossRevenueRupiah - b.discountRupiah)
      throw new SalesSettlementRuleError('SALES_SETTLEMENT_REVENUE_MISMATCH', 'Pendapatan bersih tidak sesuai.');
    return new SalesSettlement(input.shipmentId, input.settlementDate, input.receivingReferenceNumber, { ...b });
  }
}
