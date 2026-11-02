// Pembulatan HALF_UP untuk nilai tidak negatif; masukan diperiksa calculate.
const halfUpDivide = (value: bigint, divisor: bigint) => (value + divisor / 2n) / divisor;
export interface DeliverySettlementInput {
  loadingGrams: bigint;
  ticketGrams: bigint;
  sortingDeductionGrams: bigint;
  rejectGrams: bigint;
  sellingPriceMicroRupiahPerKg: bigint;
}
export interface DeliverySettlementBreakdown {
  loadingGrams: bigint;
  ticketGrams: bigint;
  shrinkageGrams: bigint;
  shrinkageBasisPoints: bigint;
  sortingDeductionGrams: bigint;
  rejectGrams: bigint;
  acceptedGrams: bigint;
  netGrams: bigint;
  sellingPriceMicroRupiahPerKg: bigint;
  grossRevenueRupiah: bigint;
  discountRupiah: bigint;
  netRevenueRupiah: bigint;
}
export type DeliverySettlementInvalidCode =
  | 'DELIVERY_QUANTITY_NEGATIVE'
  | 'DELIVERY_PRICE_NEGATIVE'
  | 'DELIVERY_TICKET_EXCEEDS_LOADING'
  | 'DELIVERY_REJECT_EXCEEDS_TICKET'
  | 'DELIVERY_SORTING_EXCEEDS_ACCEPTED';
export type DeliverySettlementResult =
  | { kind: 'ok'; breakdown: DeliverySettlementBreakdown }
  | { kind: 'invalid'; code: DeliverySettlementInvalidCode; message: string };
const GRAMS_PER_KG = 1000n;
const RATE_SCALE = 1_000_000n;
const rupiahFor = (grams: bigint, microRupiahPerKg: bigint): bigint =>
  halfUpDivide(grams * microRupiahPerKg, GRAMS_PER_KG * RATE_SCALE);
const invalid = (
  code: DeliverySettlementInvalidCode,
  message: string,
): DeliverySettlementResult => ({
  kind: 'invalid',
  code,
  message,
});
export const DeliverySettlementCalculator = {
  calculate(input: DeliverySettlementInput): DeliverySettlementResult {
    const { loadingGrams, ticketGrams, sortingDeductionGrams, rejectGrams } = input;
    if (ticketGrams < 0n || sortingDeductionGrams < 0n || rejectGrams < 0n) {
      return invalid('DELIVERY_QUANTITY_NEGATIVE', 'Jumlah tidak boleh negatif.');
    }
    if (input.sellingPriceMicroRupiahPerKg < 0n) {
      return invalid('DELIVERY_PRICE_NEGATIVE', 'Harga per kg tidak boleh negatif.');
    }
    if (ticketGrams > loadingGrams) {
      return invalid(
        'DELIVERY_TICKET_EXCEEDS_LOADING',
        'Jumlah bongkar/tiket tidak boleh melebihi jumlah yang dimuat.',
      );
    }
    if (rejectGrams > ticketGrams) {
      return invalid(
        'DELIVERY_REJECT_EXCEEDS_TICKET',
        'Jumlah reject tidak boleh melebihi jumlah bongkar/tiket.',
      );
    }
    const acceptedGrams = ticketGrams - rejectGrams;
    if (sortingDeductionGrams > acceptedGrams) {
      return invalid(
        'DELIVERY_SORTING_EXCEEDS_ACCEPTED',
        'Potongan sortasi tidak boleh melebihi jumlah yang diterima (bongkar dikurangi reject).',
      );
    }
    const shrinkageGrams = loadingGrams - ticketGrams;
    const grossRevenueRupiah = rupiahFor(acceptedGrams, input.sellingPriceMicroRupiahPerKg);
    const discountRupiah = rupiahFor(sortingDeductionGrams, input.sellingPriceMicroRupiahPerKg);
    return {
      kind: 'ok',
      breakdown: {
        loadingGrams,
        ticketGrams,
        shrinkageGrams,
        shrinkageBasisPoints:
          loadingGrams === 0n ? 0n : halfUpDivide(shrinkageGrams * 10_000n, loadingGrams),
        sortingDeductionGrams,
        rejectGrams,
        acceptedGrams,
        netGrams: acceptedGrams - sortingDeductionGrams,
        sellingPriceMicroRupiahPerKg: input.sellingPriceMicroRupiahPerKg,
        grossRevenueRupiah,
        discountRupiah,
        netRevenueRupiah: grossRevenueRupiah - discountRupiah,
      },
    };
  },
};
