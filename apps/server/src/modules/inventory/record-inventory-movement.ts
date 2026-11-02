import { randomUUID } from 'node:crypto';
import type { EntityManager } from '@mikro-orm/mysql';
import { InventoryPool, type InventoryMovement } from './domain/pool/inventory-pool.js';
export type InventoryInput = {
  warehouseId: string;
  productId: string;
  movementDate: string;
  sourceId: string;
} & (
  | { type: 'RECEIPT'; quantity: bigint; purchaseRate: bigint; total: bigint }
  | { type: 'ISSUE'; quantity: bigint }
);
// Penyimpanan konkret dua operasi Inventory; pemanggil menyediakan transaksi yang sama.
export async function recordInventoryMovement(em: EntityManager, input: InventoryInput) {
  const now = new Date();
  await em.execute(
    `INSERT INTO inventory_inventory_pools (id, warehouse_id, product_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE id = inventory_inventory_pools.id`,
    [randomUUID(), input.warehouseId, input.productId, now, now],
  );
  const pools = await em.execute<{ id: string }[]>(
    `SELECT id FROM inventory_inventory_pools
    WHERE warehouse_id = ? AND product_id = ? FOR UPDATE`,
    [input.warehouseId, input.productId],
  );
  const poolId = pools[0]!.id;
  const rows = await em.execute<Record<string, string>[]>(
    `SELECT id,
    DATE_FORMAT(movement_date, '%Y-%m-%d') AS movement_date, movement_type, source_type, source_id,
    CAST(sequence_no AS CHAR) AS sequence_no, CAST(quantity_in_grams AS CHAR) AS quantity_in_grams,
    CAST(quantity_out_grams AS CHAR) AS quantity_out_grams, CAST(value_in_rupiah AS CHAR) AS value_in_rupiah,
    CAST(value_out_rupiah AS CHAR) AS value_out_rupiah, CAST(recovery_variance_rupiah AS CHAR) AS recovery_variance_rupiah,
    CAST(balance_quantity_grams AS CHAR) AS balance_quantity_grams
    FROM inventory_inventory_movements WHERE pool_id = ? ORDER BY sequence_no`,
    [poolId],
  );
  const sourceType = input.type === 'RECEIPT' ? 'PurchaseReceipt' : 'Shipment';
  const existing = rows.find(
    (row) => row.source_type === sourceType && row.source_id === input.sourceId,
  );
  if (existing)
    return {
      movementId: existing.id,
      frozenInventoryCost: existing.value_out_rupiah,
      affectedShipments: [],
      negativeStockNotice: null,
    };
  const history: InventoryMovement[] = rows.map((row) => ({
    id: row.id,
    movementDate: row.movement_date,
    movementType: row.movement_type,
    sequenceNo: BigInt(row.sequence_no),
    sourceType: row.source_type,
    sourceId: row.source_id,
    quantityInGrams: BigInt(row.quantity_in_grams),
    quantityOutGrams: BigInt(row.quantity_out_grams),
    valueInRupiah: BigInt(row.value_in_rupiah),
    valueOutRupiah: BigInt(row.value_out_rupiah),
    recoveryVarianceRupiah: BigInt(row.recovery_variance_rupiah),
    balanceQuantityGrams: BigInt(row.balance_quantity_grams),
  }));
  const pool = new InventoryPool(poolId, input.warehouseId, input.productId, history);
  const id = randomUUID();
  const outcome =
    input.type === 'RECEIPT'
      ? pool.recordReceipt({
          id,
          movementDate: input.movementDate,
          receiptQuantity: input.quantity,
          purchaseRate: input.purchaseRate,
          sourceId: input.sourceId,
        })
      : pool.recordIssue({
          id,
          movementDate: input.movementDate,
          issueQuantity: input.quantity,
          sourceId: input.sourceId,
        });
  if (
    input.type === 'RECEIPT' &&
    outcome.incoming.valueInRupiah + outcome.incoming.recoveryVarianceRupiah !== input.total
  )
    throw Error('Nilai penerimaan tidak sesuai kontrak.');
  const own = outcome.incoming;
  await em.execute(
    `INSERT INTO inventory_inventory_movements
    (id, pool_id, sequence_no, movement_date, movement_type, quantity_in_grams, quantity_out_grams,
     value_in_rupiah, value_out_rupiah, balance_quantity_grams, balance_value_rupiah,
     average_cost_microrupiah_per_kg, recovery_variance_rupiah, cost_source,
     source_context, source_type, source_id, occurred_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      poolId,
      (rows.length + 1).toString(),
      input.movementDate,
      input.type,
      own.quantityInGrams.toString(),
      own.quantityOutGrams.toString(),
      own.valueInRupiah.toString(),
      own.valueOutRupiah.toString(),
      own.balanceQuantityGrams.toString(),
      own.balanceValueRupiah.toString(),
      own.averageCostMicroRupiahPerKg.toString(),
      own.recoveryVarianceRupiah.toString(),
      own.costSource,
      input.type === 'RECEIPT' ? 'PROCUREMENT' : 'SALES',
      sourceType,
      input.sourceId,
      now,
      now,
    ],
  );
  await em.execute(
    'UPDATE inventory_inventory_movements SET sequence_no = sequence_no + ? WHERE pool_id = ?',
    [outcome.movements.length, poolId],
  );
  for (const m of outcome.movements) {
    await em.execute(
      `UPDATE inventory_inventory_movements SET sequence_no = ?, value_in_rupiah = ?, value_out_rupiah = ?,
      balance_quantity_grams = ?, balance_value_rupiah = ?, average_cost_microrupiah_per_kg = ?,
      recovery_variance_rupiah = ?, cost_source = ? WHERE id = ? AND pool_id = ?`,
      [
        m.sequenceNo.toString(),
        m.valueInRupiah.toString(),
        m.valueOutRupiah.toString(),
        m.balanceQuantityGrams.toString(),
        m.balanceValueRupiah.toString(),
        m.averageCostMicroRupiahPerKg.toString(),
        m.recoveryVarianceRupiah.toString(),
        m.costSource,
        m.id,
        poolId,
      ],
    );
  }
  await em.execute(
    `UPDATE inventory_inventory_pools SET last_nonzero_average_cost_microrupiah_per_kg = ?,
    version = version + 1, updated_at = ? WHERE id = ?`,
    [outcome.lastNonzeroAverageCostMicroRupiahPerKg.toString(), now, poolId],
  );
  return {
    movementId: id,
    frozenInventoryCost: own.valueOutRupiah.toString(),
    affectedShipments: outcome.affectedShipments,
    negativeStockNotice: outcome.negativeStockNotice,
  };
}
