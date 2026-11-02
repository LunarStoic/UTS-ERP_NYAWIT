import { correctLoadingInventoryCosts } from '../apps/server/src/modules/sales/index.js';
import { createOrm } from '../apps/server/src/orm.js';
import { recordPurchaseReceipt } from '../apps/server/src/modules/inventory/index.js';
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL harus tersedia.');
const orm = await createOrm(databaseUrl);
try {
  // Pembacaan sumber untuk pengisian data lama dilakukan di luar modul Inventory.
  const receipts = await orm.em.execute<{
    id: string; document_number: string; receipt_date: string; supplier_id: string;
    product_id: string; warehouse_id: string; quantity_grams: string;
    unit_price_microrupiah_per_kg: string; total_amount_rupiah: string;
  }[]>(`SELECT id, document_number, DATE_FORMAT(receipt_date, '%Y-%m-%d') AS receipt_date,
    supplier_id, product_id, warehouse_id, CAST(quantity_grams AS CHAR) AS quantity_grams,
    CAST(unit_price_microrupiah_per_kg AS CHAR) AS unit_price_microrupiah_per_kg,
    CAST(total_amount_rupiah AS CHAR) AS total_amount_rupiah
    FROM procurement_purchase_receipts WHERE status = 'ACCEPTED'
    ORDER BY receipt_date, created_at, id`);
  for (const receipt of receipts) {
    await orm.em.fork().transactional(async em => {
      const inventory = await recordPurchaseReceipt(em, {
      purchaseReceiptId: receipt.id, documentNumber: receipt.document_number,
      receiptDate: receipt.receipt_date, supplierId: receipt.supplier_id,
      productId: receipt.product_id, warehouseId: receipt.warehouse_id,
      quantityGrams: receipt.quantity_grams, unitPriceMicroRupiahPerKg: receipt.unit_price_microrupiah_per_kg,
      totalAmountRupiah: receipt.total_amount_rupiah, requestLoanDeduction: false,
      });
      await correctLoadingInventoryCosts(em, inventory.affectedShipments);
    });
    console.log('Diperiksa: ' + receipt.document_number);
  }
  console.log('Pemeriksaan penerimaan lama selesai.');
} finally {
  await orm.close(true);
}
