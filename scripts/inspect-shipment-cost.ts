import { ShipmentCostAllocationPolicy } from '../apps/server/src/modules/inventory/domain/shipment-cost-allocation/shipment-cost-allocation-policy.js';
// Alat pemeriksaan belajar, bukan endpoint bisnis atau proses penyelesaian.
const [shipmentId, ticketKg, sortingKg, priceRupiah] = process.argv.slice(2);
if (
  !shipmentId ||
  [ticketKg, sortingKg, priceRupiah].some((value) => value === undefined || !/^[0-9]+$/.test(value))
) {
  throw Error(
    'Isi: shipmentId tiketKg sortasiKg hargaRupiahPerKg; angka harus bulat tidak negatif.',
  );
}
const base = process.env.API_BASE_URL ?? 'http://localhost:4000';
const detailResponse = await fetch(
  `${base}/api/v1/sales/shipments/${encodeURIComponent(shipmentId)}`,
);
const detailBody = await detailResponse.json();
if (!detailResponse.ok) throw Error(detailBody.error?.message ?? 'Dokumen tidak dapat dibaca.');
const shipment = detailBody.data;
const previewResponse = await fetch(
  `${base}/api/v1/sales/shipments/${encodeURIComponent(shipmentId)}/complete-delivery/preview`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ticketQuantityGrams: (BigInt(ticketKg!) * 1000n).toString(),
      sortingDeductionGrams: (BigInt(sortingKg!) * 1000n).toString(),
      rejectQuantityGrams: '0',
      sellingPriceMicroRupiahPerKg: (BigInt(priceRupiah!) * 1_000_000n).toString(),
    }),
  },
);
const previewBody = await previewResponse.json();
if (!previewResponse.ok) throw Error(previewBody.error?.message ?? 'Pratinjau gagal.');
if (previewBody.data.issue)
  throw Error(previewBody.data.issue.code + ': ' + previewBody.data.issue.message);
const breakdown = previewBody.data.breakdown;
if (!breakdown) throw Error('Rincian tiket belum tersedia.');
const allocation = ShipmentCostAllocationPolicy.allocate({
  loadingQuantity: BigInt(shipment.loadingQuantityGrams),
  acceptedQuantity: BigInt(breakdown.acceptedQuantityGrams),
  rejectQuantity: BigInt(breakdown.rejectQuantityGrams),
  shrinkageQuantity: BigInt(breakdown.shrinkageQuantityGrams),
  frozenLoadingInventoryCost: BigInt(shipment.loadingInventoryCostRupiah),
});
console.log(
  JSON.stringify(
    {
      documentNumber: shipment.documentNumber,
      status: shipment.status,
      loadingInventoryCostRupiah: shipment.loadingInventoryCostRupiah,
      acceptedQuantityGrams: breakdown.acceptedQuantityGrams,
      netQuantityGrams: breakdown.netQuantityGrams,
      netRevenueRupiah: breakdown.netRevenueRupiah,
      cogsRupiah: allocation.cogs.toString(),
      shrinkageLossRupiah: allocation.shrinkageLoss.toString(),
      rejectAllocatedValueRupiah: allocation.rejectAllocatedValue.toString(),
      allocatedTotalRupiah: (
        allocation.cogs +
        allocation.shrinkageLoss +
        allocation.rejectAllocatedValue
      ).toString(),
    },
    null,
    2,
  ),
);
