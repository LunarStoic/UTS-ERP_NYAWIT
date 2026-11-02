import { randomUUID } from 'node:crypto';
import type { EntityManager } from '@mikro-orm/mysql';
import type { PurchaseReceiptAcceptedV1Payload } from './index.js';
import { InventoryPool } from './domain/pool/inventory-pool.js';
// Koordinasi lokal: kontrak publik → domain Inventory → penyimpanan Inventory.
export async function recordPurchaseReceipt(em: EntityManager, receipt: PurchaseReceiptAcceptedV1Payload): Promise<void> {
  const now = new Date();
  await em.execute(`INSERT INTO inventory_inventory_pools
    (id, warehouse_id, product_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE id = inventory_inventory_pools.id`,
    [randomUUID(), receipt.warehouseId, receipt.productId, now, now]);
  const pools = await em.execute<{ id: string }[]>(`SELECT id FROM inventory_inventory_pools
    WHERE warehouse_id = ? AND product_id = ? FOR UPDATE`, [receipt.warehouseId, receipt.productId]);
  const poolId = pools[0]!.id;
  const recorded = await em.execute<{ id: string }[]>(`SELECT id FROM inventory_inventory_movements
    WHERE pool_id = ? AND source_context = 'PROCUREMENT' AND source_type = 'PurchaseReceipt'
      AND source_id = ?`, [poolId, receipt.purchaseReceiptId]);
  if (recorded.length > 0) return;
  const rows = await em.execute<{
    id: string; movement_date: string; movement_type: string;
    sequence_no: string; quantity_in_grams: string; value_in_rupiah: string;
  }[]>(`SELECT id, DATE_FORMAT(movement_date, '%Y-%m-%d') AS movement_date, movement_type,
    CAST(sequence_no AS CHAR) AS sequence_no, CAST(quantity_in_grams AS CHAR) AS quantity_in_grams,
    CAST(value_in_rupiah AS CHAR) AS value_in_rupiah
    FROM inventory_inventory_movements WHERE pool_id = ? ORDER BY sequence_no`, [poolId]);
  const pool = new InventoryPool(poolId, receipt.warehouseId, receipt.productId, rows.map(row => ({
    id: row.id, movementDate: row.movement_date, movementType: row.movement_type,
    sequenceNo: BigInt(row.sequence_no), quantityInGrams: BigInt(row.quantity_in_grams),
    valueInRupiah: BigInt(row.value_in_rupiah),
  })));
  const movementId = randomUUID();
  const outcome = pool.recordReceipt({ id: movementId, movementDate: receipt.receiptDate,
    receiptQuantity: BigInt(receipt.quantityGrams), purchaseRate: BigInt(receipt.unitPriceMicroRupiahPerKg) });
  if (outcome.receiptValueRupiah !== BigInt(receipt.totalAmountRupiah)) {
    throw new Error('Nilai penerimaan tidak sesuai jumlah dan harga pada kontrak.');
  }
  const incoming = outcome.movements.find(movement => movement.id === movementId)!;
  await em.execute(`INSERT INTO inventory_inventory_movements
    (id, pool_id, sequence_no, movement_date, movement_type,
     quantity_in_grams, value_in_rupiah, balance_quantity_grams, balance_value_rupiah,
     average_cost_microrupiah_per_kg, cost_source, source_context, source_type, source_id,
     occurred_at, created_at)
    VALUES (?, ?, ?, ?, 'RECEIPT', ?, ?, ?, ?, ?, 'PURCHASE_PRICE', 'PROCUREMENT', 'PurchaseReceipt', ?, ?, ?)`,
    [movementId, poolId, (rows.length + 1).toString(), receipt.receiptDate,
      incoming.quantityInGrams.toString(), incoming.valueInRupiah.toString(),
      incoming.balanceQuantityGrams.toString(), incoming.balanceValueRupiah.toString(),
      incoming.averageCostMicroRupiahPerKg.toString(), receipt.purchaseReceiptId, now, now]);
  // Nomor sementara hanya detail penyimpanan; urutan bisnis telah diputuskan domain.
  await em.execute(`UPDATE inventory_inventory_movements SET sequence_no = sequence_no + ?
    WHERE pool_id = ?`, [outcome.movements.length, poolId]);
  for (const movement of outcome.movements) {
    await em.execute(`UPDATE inventory_inventory_movements SET sequence_no = ?,
      balance_quantity_grams = ?, balance_value_rupiah = ?, average_cost_microrupiah_per_kg = ?
      WHERE id = ? AND pool_id = ?`,
      [movement.sequenceNo.toString(), movement.balanceQuantityGrams.toString(),
        movement.balanceValueRupiah.toString(), movement.averageCostMicroRupiahPerKg.toString(), movement.id, poolId]);
  }
  await em.execute(`UPDATE inventory_inventory_pools
    SET last_nonzero_average_cost_microrupiah_per_kg = ?, version = version + 1, updated_at = ?
    WHERE id = ?`, [outcome.lastNonzeroAverageCostMicroRupiahPerKg.toString(), now, poolId]);
}