import { createHash } from 'node:crypto';
import type { MikroORM } from '@mikro-orm/mysql';
import type { Express, Request } from 'express';
// Hanya tabel milik Inventory. Saldo dibaca dari baris terakhir, bukan dihitung ulang.
const ledger = `inventory_inventory_movements m
  JOIN inventory_inventory_pools p ON p.id = m.pool_id`;
const lastMovement = `NOT EXISTS (SELECT 1 FROM inventory_inventory_movements newer
  WHERE newer.pool_id = m.pool_id AND newer.sequence_no > m.sequence_no)`;
class InventoryQueryError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const movementTypes = [
  'RECEIPT',
  'ISSUE',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'REJECT_RETURN',
  'CONVERSION_IN',
  'CONVERSION_OUT',
];
function validDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value + 'T00:00:00Z')) &&
    new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value
  );
}
// Dua daftar memerlukan pemeriksaan filter yang sama; tetap lokal di file ini.
function readQuery(req: Request, kind: 'BALANCE' | 'MOVEMENT') {
  const prefix = `INVENTORY_${kind}_QUERY_`;
  const fail = (suffix: string, message: string): never => {
    throw new InventoryQueryError(prefix + suffix, message);
  };
  const keys =
    kind === 'BALANCE'
      ? ['warehouseId', 'productId']
      : ['warehouseId', 'productId', 'movementType', 'sourceId', 'dateFrom', 'dateTo'];
  const filters: Record<string, string | null> = {};
  for (const key of [...keys, 'limit', 'cursor']) {
    if (req.query[key] !== undefined && typeof req.query[key] !== 'string')
      throw new InventoryQueryError('MALFORMED_REQUEST', 'Parameter harus berupa satu nilai teks.');
  }
  for (const key of keys) filters[key] = (req.query[key] as string | undefined) ?? null;
  for (const key of ['warehouseId', 'productId', 'sourceId']) {
    if (filters[key] != null && !uuid.test(filters[key]!))
      fail('INVALID_REFERENCE_ID', `${key} harus berupa id yang valid.`);
  }
  if (filters.movementType != null && !movementTypes.includes(filters.movementType))
    fail('INVALID_MOVEMENT_TYPE', 'Jenis pergerakan tidak dikenal.');
  for (const key of ['dateFrom', 'dateTo']) {
    if (filters[key] != null && !validDate(filters[key]!))
      fail('INVALID_DATE', `${key} harus berupa tanggal yang valid (TTTT-BB-HH).`);
  }
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo)
    fail('INVALID_DATE_RANGE', 'Tanggal awal tidak boleh setelah tanggal akhir.');
  const limit = req.query.limit === undefined ? 50 : Number(req.query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 200)
    fail('INVALID_LIMIT', 'Batas data per halaman harus bilangan bulat antara 1 dan 200.');
  const filtersFingerprint = createHash('sha256')
    .update(JSON.stringify(filters))
    .digest('hex')
    .slice(0, 16);
  let after: Record<string, string> | null = null;
  if (req.query.cursor !== undefined) {
    try {
      const parsed = JSON.parse(
        Buffer.from(req.query.cursor as string, 'base64url').toString('utf8'),
      );
      if (
        !parsed ||
        parsed.filtersFingerprint !== filtersFingerprint ||
        typeof parsed.poolId !== 'string' ||
        !uuid.test(parsed.poolId)
      )
        throw Error();
      if (kind === 'BALANCE') {
        if (
          typeof parsed.warehouseId !== 'string' ||
          !uuid.test(parsed.warehouseId) ||
          typeof parsed.productId !== 'string' ||
          !uuid.test(parsed.productId)
        )
          throw Error();
      } else if (
        typeof parsed.movementDate !== 'string' ||
        !validDate(parsed.movementDate) ||
        typeof parsed.sequenceNo !== 'string' ||
        !/^[1-9]\d*$/.test(parsed.sequenceNo) ||
        BigInt(parsed.sequenceNo) > 9223372036854775807n
      )
        throw Error();
      after = parsed;
    } catch {
      fail('INVALID_CURSOR', 'Penanda halaman tidak valid, atau dibuat untuk filter yang berbeda.');
    }
  }
  const conditions: string[] = [];
  const values: string[] = [];
  for (const [key, column, operator] of [
    ['warehouseId', 'p.warehouse_id', '='],
    ['productId', 'p.product_id', '='],
    ['movementType', 'm.movement_type', '='],
    ['sourceId', 'm.source_id', '='],
    ['dateFrom', 'm.movement_date', '>='],
    ['dateTo', 'm.movement_date', '<='],
  ]) {
    if (filters[key] != null) {
      conditions.push(`${column} ${operator} ?`);
      values.push(filters[key]!);
    }
  }
  return { limit, filtersFingerprint, after, conditions, values };
}
export function registerInventoryRoutes(app: Express, orm: MikroORM): void {
  app.get('/api/v1/inventory/balances/by-warehouse', async (_req, res) => {
    const data = await orm.em.fork().execute(`SELECT p.warehouse_id AS warehouseId,
      COUNT(*) AS productCount, CAST(SUM(m.balance_quantity_grams) AS CHAR) AS quantityGrams,
      CAST(SUM(m.balance_value_rupiah) AS CHAR) AS inventoryValueRupiah
      FROM ${ledger} WHERE ${lastMovement} GROUP BY p.warehouse_id ORDER BY p.warehouse_id`);
    res.json({
      data: data.map((row: Record<string, unknown>) => ({
        ...row,
        productCount: Number(row.productCount),
      })),
      meta: {},
    });
  });
  app.get('/api/v1/inventory/balances', async (req, res, next) => {
    try {
      const { limit, filtersFingerprint, after, conditions, values } = readQuery(req, 'BALANCE');
      conditions.push(lastMovement);
      if (after) {
        conditions.push('(p.warehouse_id, p.product_id, p.id) > (?, ?, ?)');
        values.push(after.warehouseId, after.productId, after.poolId);
      }
      const rows = await orm.em.fork().execute<Record<string, string>[]>(
        `SELECT
        p.id AS inventoryPoolId, p.warehouse_id AS warehouseId, p.product_id AS productId,
        CAST(m.balance_quantity_grams AS CHAR) AS quantityGrams,
        CAST(m.balance_value_rupiah AS CHAR) AS inventoryValueRupiah,
        CAST(m.average_cost_microrupiah_per_kg AS CHAR) AS averageCostMicroRupiahPerKg,
        CAST(m.sequence_no AS CHAR) AS lastSequenceNo, m.id AS lastMovementId, DATE_FORMAT(p.updated_at, '%Y-%m-%dT%H:%i:%s.%fZ') AS updatedAt
        FROM ${ledger} WHERE ${conditions.join(' AND ')}
        ORDER BY p.warehouse_id, p.product_id, p.id LIMIT ?`,
        [...values, limit + 1],
      );
      const data = rows
        .slice(0, limit)
        .map((row) => ({ ...row, updatedAt: new Date(row.updatedAt).toISOString() }));
      const last = rows[Math.min(rows.length, limit) - 1];
      const hasMore = rows.length > limit;
      const nextCursor = hasMore
        ? Buffer.from(
            JSON.stringify({
              warehouseId: last.warehouseId,
              productId: last.productId,
              poolId: last.inventoryPoolId,
              filtersFingerprint,
            }),
          ).toString('base64url')
        : null;
      res.json({ data, meta: { limit, hasMore, nextCursor } });
    } catch (error) {
      if (error instanceof InventoryQueryError)
        res.status(400).json({ error: { code: error.code, message: error.message, details: {} } });
      else next(error);
    }
  });
  app.get('/api/v1/inventory/movements', async (req, res, next) => {
    try {
      const { limit, filtersFingerprint, after, conditions, values } = readQuery(req, 'MOVEMENT');
      if (after) {
        conditions.push(
          '(m.movement_date < ? OR (m.movement_date = ? AND (m.pool_id > ? OR (m.pool_id = ? AND m.sequence_no < ?))))',
        );
        values.push(
          after.movementDate,
          after.movementDate,
          after.poolId,
          after.poolId,
          after.sequenceNo,
        );
      }
      const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
      const rows = await orm.em.fork().execute<Record<string, string>[]>(
        `SELECT m.id AS movementId,
        m.pool_id AS poolId, p.warehouse_id AS warehouseId, p.product_id AS productId,
        DATE_FORMAT(m.movement_date, '%Y-%m-%d') AS movementDate, m.movement_type AS movementType,
        CAST(m.sequence_no AS CHAR) AS sequenceNo, m.source_context AS sourceContext,
        m.source_type AS sourceType, m.source_id AS sourceId,
        CAST(m.quantity_in_grams AS CHAR) AS quantityInGrams, CAST(m.quantity_out_grams AS CHAR) AS quantityOutGrams,
        CAST(m.value_in_rupiah AS CHAR) AS valueInRupiah, CAST(m.value_out_rupiah AS CHAR) AS valueOutRupiah,
        CAST(m.balance_quantity_grams AS CHAR) AS balanceQuantityGrams,
        CAST(m.balance_value_rupiah AS CHAR) AS balanceValueRupiah,
        CAST(m.average_cost_microrupiah_per_kg AS CHAR) AS averageCostMicroRupiahPerKg,
        m.cost_source AS costSource, CAST(m.recovery_variance_rupiah AS CHAR) AS recoveryVarianceRupiah,
        DATE_FORMAT(m.created_at, '%Y-%m-%dT%H:%i:%s.%fZ') AS createdAt FROM ${ledger} ${where}
        ORDER BY m.movement_date DESC, m.pool_id ASC, m.sequence_no DESC LIMIT ?`,
        [...values, limit + 1],
      );
      const data = rows
        .slice(0, limit)
        .map((row) => ({ ...row, createdAt: new Date(row.createdAt).toISOString() }));
      const last = rows[Math.min(rows.length, limit) - 1];
      const hasMore = rows.length > limit;
      const nextCursor = hasMore
        ? Buffer.from(
            JSON.stringify({
              movementDate: last.movementDate,
              poolId: last.poolId,
              sequenceNo: last.sequenceNo,
              filtersFingerprint,
            }),
          ).toString('base64url')
        : null;
      res.json({ data, meta: { limit, hasMore, nextCursor } });
    } catch (error) {
      if (error instanceof InventoryQueryError)
        res.status(400).json({ error: { code: error.code, message: error.message, details: {} } });
      else next(error);
    }
  });
}
