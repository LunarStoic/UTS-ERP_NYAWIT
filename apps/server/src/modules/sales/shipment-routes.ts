import { createHash, randomUUID } from 'node:crypto';
import type { Express } from 'express';
import type { MikroORM } from '@mikro-orm/mysql';
import type { AppRepositories } from '../../app.js';
import { dispatchForShipment } from '../inventory/index.js';
import { correctLoadingInventoryCosts } from './index.js';
import { Shipment, ShipmentRuleError } from './domain/shipment/shipment.js';
const selectShipment = `SELECT id, document_number AS documentNumber,
  DATE_FORMAT(shipment_date, '%Y-%m-%d') AS shipmentDate, warehouse_id AS warehouseId,
  product_id AS productId, customer_id AS customerId,
  CAST(loading_quantity_grams AS CHAR) AS loadingQuantityGrams,
  CAST(loading_inventory_cost_rupiah AS CHAR) AS loadingInventoryCostRupiah, status,
  version, created_by AS createdBy, completed_by AS completedBy,
  DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s.%fZ') AS createdAt,
  DATE_FORMAT(completed_at, '%Y-%m-%dT%H:%i:%s.%fZ') AS completedAt,
  DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%s.%fZ') AS updatedAt FROM sales_shipments`;
function toView(row: Record<string, unknown>) {
  return {
    ...row,
    version: Number(row.version),
    createdAt: new Date(row.createdAt as string).toISOString(),
    updatedAt: new Date(row.updatedAt as string).toISOString(),
    completedAt: row.completedAt ? new Date(row.completedAt as string).toISOString() : null,
  };
}
export function registerShipmentRoutes(app: Express, orm: MikroORM, masters: AppRepositories) {
  app.post('/api/v1/sales/shipments', async (req, res) => {
    const {
      shipmentDate,
      warehouseId,
      productId,
      customerId = null,
      loadingQuantityGrams,
    } = req.body ?? {};
    const reject = (status: number, code: string, message: string) =>
      res.status(status).json({ error: { code, message, details: {} } });
    if (
      [shipmentDate, warehouseId, productId, loadingQuantityGrams].some(
        (x) => typeof x !== 'string',
      ) ||
      (customerId !== null && typeof customerId !== 'string')
    ) {
      reject(
        400,
        'MALFORMED_REQUEST',
        'Tanggal, gudang, produk dan jumlah muat wajib berupa teks; pelanggan boleh kosong.',
      );
      return;
    }
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(shipmentDate) ||
      !Number.isFinite(Date.parse(shipmentDate + 'T00:00:00Z')) ||
      new Date(shipmentDate + 'T00:00:00Z').toISOString().slice(0, 10) !== shipmentDate ||
      +shipmentDate.slice(0, 4) < 1000
    ) {
      reject(
        422,
        'SHIPMENT_INVALID_SHIPMENT_DATE_FORMAT',
        'Tanggal pengiriman harus berupa tanggal yang valid (TTTT-BB-HH).',
      );
      return;
    }
    if (!/^-?\d+$/.test(loadingQuantityGrams)) {
      reject(
        422,
        'SHIPMENT_INVALID_LOADING_QUANTITY_FORMAT',
        'Jumlah muat (gram) harus berupa angka bulat.',
      );
      return;
    }
    const quantity = BigInt(loadingQuantityGrams);
    if (quantity <= 0n) {
      reject(422, 'SHIPMENT_INVALID_LOADING_QUANTITY', 'Jumlah muat harus lebih besar dari nol.');
      return;
    }
    if (quantity > 9223372036854775807n) {
      reject(400, 'MALFORMED_REQUEST', 'Jumlah melebihi kapasitas BIGINT.');
      return;
    }
    if (customerId) {
      const customer = await masters.partners.findById(customerId);
      if (!customer) {
        reject(404, 'CUSTOMER_NOT_FOUND', 'Pelanggan tidak ditemukan.');
        return;
      }
      if (!customer.isActive) {
        reject(422, 'CUSTOMER_NOT_ACTIVE', 'Pelanggan tidak aktif.');
        return;
      }
      if (!customer.hasActiveRole('CUSTOMER')) {
        reject(
          422,
          'CUSTOMER_MISSING_ROLE',
          'Mitra ini tidak memiliki peran Pelanggan yang aktif.',
        );
        return;
      }
    }
    const product = await masters.products.findById(productId);
    if (!product) {
      reject(404, 'PRODUCT_NOT_FOUND', 'Produk tidak ditemukan.');
      return;
    }
    if (!product.isActive) {
      reject(422, 'PRODUCT_NOT_ACTIVE', 'Produk tidak aktif.');
      return;
    }
    const warehouse = await masters.warehouses.findById(warehouseId);
    if (!warehouse) {
      reject(404, 'WAREHOUSE_NOT_FOUND', 'Gudang tidak ditemukan.');
      return;
    }
    if (!warehouse.isActive) {
      reject(422, 'WAREHOUSE_NOT_ACTIVE', 'Gudang tidak aktif.');
      return;
    }
    try {
      const result = await orm.em.fork().transactional(async (em) => {
        const year = Number(shipmentDate.slice(0, 4)),
          now = new Date();
        await em.execute(
          `INSERT INTO infrastructure_document_sequences
          (document_type, year_no, last_number, version, updated_at) VALUES ('SHIPMENT', ?, 1, 1, ?) AS new_row
          ON DUPLICATE KEY UPDATE last_number = infrastructure_document_sequences.last_number + 1,
          version = infrastructure_document_sequences.version + 1, updated_at = new_row.updated_at`,
          [year, now],
        );
        const counters = await em.execute<{ last_number: string }[]>(
          `SELECT CAST(last_number AS CHAR) AS last_number
          FROM infrastructure_document_sequences WHERE document_type = 'SHIPMENT' AND year_no = ?`,
          [year],
        );
        const id = randomUUID();
        const inventory = await dispatchForShipment(em, {
          shipmentId: id,
          warehouseId,
          productId,
          quantity,
          movementDate: shipmentDate,
        });
        await correctLoadingInventoryCosts(em, inventory.affectedShipments);
        const shipment = Shipment.create({
          id,
          documentNumber: `SH-${year}-${counters[0]!.last_number.padStart(6, '0')}`,
          shipmentDate,
          warehouseId,
          productId,
          customerId: customerId || null,
          loadingQuantity: quantity,
          loadingInventoryCost: BigInt(inventory.frozenInventoryCost),
        });
        await em.execute(
          `INSERT INTO sales_shipments (id, document_number, shipment_date, warehouse_id, product_id,
          customer_id, loading_quantity_grams, loading_inventory_cost_rupiah, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            shipment.documentNumber,
            shipmentDate,
            warehouseId,
            productId,
            shipment.customerId,
            quantity.toString(),
            shipment.loadingInventoryCost.toString(),
            shipment.status,
            shipment.createdAt,
            shipment.createdAt,
          ],
        );
        const rows = await em.execute<Record<string, unknown>[]>(selectShipment + ' WHERE id = ?', [
          id,
        ]);
        return { shipment: toView(rows[0]!), notice: inventory.negativeStockNotice };
      });
      const warnings = result.notice
        ? [
            {
              code: 'NEGATIVE_STOCK',
              message: `Periksa stok pada ${result.notice.movementDate}. Saldo setelah muat: ${result.notice.resultingBalanceGrams} gram. Periksa rincian peringatan stok.`,
              details: result.notice,
            },
          ]
        : [];
      res.status(201).json({ data: result.shipment, meta: { warnings } });
    } catch (error) {
      if (error instanceof ShipmentRuleError) {
        reject(422, error.code, error.message);
        return;
      }
      throw error;
    }
  });
  app.get('/api/v1/sales/shipments', async (req, res) => {
    const reject = (code: string, message: string) => {
      res.status(400).json({ error: { code, message, details: {} } });
    };
    const keys = [
      'status',
      'customerId',
      'productId',
      'warehouseId',
      'dateFrom',
      'dateTo',
      'limit',
      'cursor',
    ] as const;
    const query: Partial<Record<(typeof keys)[number], string>> = {};
    for (const key of keys) {
      const value = req.query[key];
      if (value !== undefined && typeof value !== 'string') {
        reject('MALFORMED_REQUEST', 'Parameter pada alamat harus berupa satu nilai teks.');
        return;
      }
      if (value !== undefined) query[key] = value;
    }
    if (query.status !== undefined && !['IN_TRANSIT', 'COMPLETED'].includes(query.status)) {
      reject(
        'SHIPMENT_QUERY_INVALID_STATUS',
        "Status harus salah satu dari 'IN_TRANSIT', 'COMPLETED'.",
      );
      return;
    }
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const key of ['customerId', 'productId', 'warehouseId'] as const) {
      if (query[key] !== undefined && !uuid.test(query[key]!)) {
        reject('SHIPMENT_QUERY_INVALID_REFERENCE_ID', `${key} harus berupa id yang valid.`);
        return;
      }
    }
    for (const key of ['dateFrom', 'dateTo'] as const) {
      const value = query[key];
      if (
        value !== undefined &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
          !Number.isFinite(Date.parse(value + 'T00:00:00Z')) ||
          new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value)
      ) {
        reject(
          'SHIPMENT_QUERY_INVALID_DATE',
          `${key} harus berupa tanggal yang valid (TTTT-BB-HH).`,
        );
        return;
      }
    }
    if (query.dateFrom && query.dateTo && query.dateFrom > query.dateTo) {
      reject(
        'SHIPMENT_QUERY_INVALID_DATE_RANGE',
        'Tanggal awal tidak boleh setelah tanggal akhir.',
      );
      return;
    }
    const limit = query.limit === undefined ? 50 : Number(query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      reject(
        'SHIPMENT_QUERY_INVALID_LIMIT',
        'Batas data per halaman harus bilangan bulat antara 1 dan 200.',
      );
      return;
    }
    const filtersFingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          status: query.status ?? null,
          customerId: query.customerId ?? null,
          productId: query.productId ?? null,
          warehouseId: query.warehouseId ?? null,
          dateFrom: query.dateFrom ?? null,
          dateTo: query.dateTo ?? null,
        }),
      )
      .digest('hex')
      .slice(0, 16);
    let after: { shipmentDate: string; id: string } | undefined;
    if (query.cursor !== undefined) {
      try {
        const cursor = JSON.parse(Buffer.from(query.cursor, 'base64url').toString('utf8'));
        if (
          !cursor ||
          typeof cursor.shipmentDate !== 'string' ||
          typeof cursor.id !== 'string' ||
          cursor.filtersFingerprint !== filtersFingerprint ||
          !uuid.test(cursor.id) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(cursor.shipmentDate)
        )
          throw Error();
        after = cursor;
      } catch {
        reject(
          'SHIPMENT_QUERY_INVALID_CURSOR',
          'Penanda halaman tidak valid, atau dibuat untuk filter yang berbeda.',
        );
        return;
      }
    }
    const conditions: string[] = [];
    const values: string[] = [];
    for (const [key, column] of [
      ['status', 'status'],
      ['customerId', 'customer_id'],
      ['productId', 'product_id'],
      ['warehouseId', 'warehouse_id'],
    ] as const) {
      if (query[key] !== undefined) {
        conditions.push(`${column} = ?`);
        values.push(query[key]!);
      }
    }
    if (query.dateFrom) {
      conditions.push('shipment_date >= ?');
      values.push(query.dateFrom);
    }
    if (query.dateTo) {
      conditions.push('shipment_date <= ?');
      values.push(query.dateTo);
    }
    if (after) {
      conditions.push('(shipment_date, id) < (?, ?)');
      values.push(after.shipmentDate, after.id);
    }
    const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
    const rows = await orm.em
      .fork()
      .execute<Record<string, unknown>[]>(
        selectShipment + where + ' ORDER BY shipment_date DESC, id DESC LIMIT ?',
        [...values, limit + 1],
      );
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    const nextCursor =
      hasMore && last
        ? Buffer.from(
            JSON.stringify({
              shipmentDate: last.shipmentDate,
              id: last.id,
              filtersFingerprint,
            }),
            'utf8',
          ).toString('base64url')
        : null;
    res.status(200).json({ data: page.map(toView), meta: { nextCursor, hasMore, limit } });
  });

  app.get('/api/v1/sales/shipments/:id', async (req, res) => {
    const rows = await orm.em
      .fork()
      .execute<Record<string, unknown>[]>(selectShipment + ' WHERE id = ?', [req.params.id]);
    if (!rows[0]) {
      res
        .status(404)
        .json({
          error: {
            code: 'SHIPMENT_NOT_FOUND',
            message: 'Pengiriman tidak ditemukan.',
            details: {},
          },
        });
      return;
    }
    res.json({ data: toView(rows[0]), meta: {} });
  });
}
