import { createHash, randomUUID } from 'node:crypto';
import type { MikroORM } from '@mikro-orm/mysql';
import type { Express } from 'express';
import type { AppRepositories } from '../../app.js';
import { PurchaseReceipt, PurchaseReceiptRuleError } from './domain/purchase-receipt/purchase-receipt.js';
interface ReceiptRow {
  id: string;
  document_number: string;
  receipt_date: string;
  supplier_id: string;
  product_id: string;
  warehouse_id: string;
  quantity_grams: string;
  unit_price_microrupiah_per_kg: string;
  total_amount_rupiah: string;
  notes: string | null;
  status: string;
  version: string;
  created_at: string;
  accepted_at: string;
  updated_at: string;
}
// CAST menjaga BIGINT tetap berupa teks pada batas HTTP, bukan number JavaScript.
const receiptSelect = `SELECT id, document_number, DATE_FORMAT(receipt_date, '%Y-%m-%d') AS receipt_date,
  supplier_id, product_id, warehouse_id, CAST(quantity_grams AS CHAR) AS quantity_grams,
  CAST(unit_price_microrupiah_per_kg AS CHAR) AS unit_price_microrupiah_per_kg,
  CAST(total_amount_rupiah AS CHAR) AS total_amount_rupiah, notes, status,
  CAST(version AS CHAR) AS version,
  DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s.%fZ') AS created_at,
  DATE_FORMAT(accepted_at, '%Y-%m-%dT%H:%i:%s.%fZ') AS accepted_at,
  DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%s.%fZ') AS updated_at
  FROM procurement_purchase_receipts`;
function toJson(row: ReceiptRow) {
  const createdAt = new Date(row.created_at).toISOString();
  return {
    id: row.id, documentNumber: row.document_number, receiptDate: row.receipt_date,
    supplierId: row.supplier_id, productId: row.product_id, warehouseId: row.warehouse_id,
    quantityGrams: row.quantity_grams, unitPriceMicroRupiahPerKg: row.unit_price_microrupiah_per_kg,
    totalAmountRupiah: row.total_amount_rupiah, status: row.status,
    requestLoanDeduction: false, loanDeductionNote: null, notes: row.notes, version: Number(row.version),
    createdBy: null, acceptedBy: null, cancelledBy: null,
    createdAt, acceptedAt: new Date(row.accepted_at).toISOString(), cancelledAt: null,
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}
export function registerPurchaseReceiptRoutes(app: Express, orm: MikroORM, masters: AppRepositories): void {
  app.post('/api/v1/procurement/purchase-receipts', async (req, res) => {
    const body = req.body ?? {};
    const { receiptDate, supplierId, productId, warehouseId, quantityGrams, unitPriceMicroRupiahPerKg, notes } = body;
    const reject = (status: number, code: string, message: string) => {
      res.status(status).json({ error: { code, message, details: {} } });
    };
    if ([receiptDate, supplierId, productId, warehouseId, quantityGrams, unitPriceMicroRupiahPerKg]
      .some(value => typeof value !== 'string') || (notes !== undefined && notes !== null && typeof notes !== 'string')) {
      reject(400, 'MALFORMED_REQUEST', 'Tanggal, pemasok, produk, gudang, jumlah dan harga harus berupa teks; catatan boleh null.');
      return;
    }
    // Belum ada modul pinjaman: jangan diam-diam mengabaikan permintaan potongan.
    if ((body.requestLoanDeduction !== undefined && body.requestLoanDeduction !== false)
      || body.loanDeduction != null || body.loanDeductionNote != null) {
      reject(400, 'MALFORMED_REQUEST', 'Tahap ini baru menerima pembelian tanpa potongan pinjaman.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(receiptDate)
      || !Number.isFinite(Date.parse(receiptDate + 'T00:00:00Z'))
      || new Date(receiptDate + 'T00:00:00Z').toISOString().slice(0, 10) !== receiptDate
      || Number(receiptDate.slice(0, 4)) < 1000) {
      reject(422, 'PURCHASE_RECEIPT_INVALID_RECEIPT_DATE_FORMAT', 'Tanggal penerimaan harus berupa tanggal yang valid (TTTT-BB-HH).');
      return;
    }
    if (!/^-?\d+$/.test(quantityGrams)) {
      reject(422, 'PURCHASE_RECEIPT_INVALID_QUANTITY_FORMAT', 'Jumlah (gram) harus berupa angka bulat.');
      return;
    }
    if (!/^-?\d+$/.test(unitPriceMicroRupiahPerKg)) {
      reject(422, 'PURCHASE_RECEIPT_INVALID_UNIT_PRICE_FORMAT', 'Harga satuan harus berupa angka bulat tidak negatif.');
      return;
    }
    const quantity = BigInt(quantityGrams);
    const price = BigInt(unitPriceMicroRupiahPerKg);
    const supplier = await masters.partners.findById(supplierId);
    if (!supplier) { reject(404, 'SUPPLIER_NOT_FOUND', 'Pemasok tidak ditemukan.'); return; }
    if (!supplier.isActive) { reject(422, 'SUPPLIER_NOT_ACTIVE', 'Pemasok tidak aktif.'); return; }
    if (!supplier.hasActiveRole('SUPPLIER')) {
      reject(422, 'SUPPLIER_MISSING_ROLE', 'Mitra ini tidak memiliki peran Pemasok yang aktif.'); return;
    }
    const product = await masters.products.findById(productId);
    if (!product) { reject(404, 'PRODUCT_NOT_FOUND', 'Produk tidak ditemukan.'); return; }
    if (!product.isActive) { reject(422, 'PRODUCT_NOT_ACTIVE', 'Produk tidak aktif.'); return; }
    const warehouse = await masters.warehouses.findById(warehouseId);
    if (!warehouse) { reject(404, 'WAREHOUSE_NOT_FOUND', 'Gudang tidak ditemukan.'); return; }
    if (!warehouse.isActive) { reject(422, 'WAREHOUSE_NOT_ACTIVE', 'Gudang tidak aktif.'); return; }
    const now = new Date();
    const year = Number(receiptDate.slice(0, 4));
    try {
      const created = await orm.em.fork().transactional(async em => {
        await em.execute(`INSERT INTO infrastructure_document_sequences
          (document_type, year_no, last_number, version, updated_at)
          VALUES ('PURCHASE_RECEIPT', ?, 1, 1, ?) AS new_row
          ON DUPLICATE KEY UPDATE last_number = infrastructure_document_sequences.last_number + 1,
          version = infrastructure_document_sequences.version + 1, updated_at = new_row.updated_at`, [year, now]);
        const counters = await em.execute<{ last_number: string }[]>(
          `SELECT CAST(last_number AS CHAR) AS last_number FROM infrastructure_document_sequences
           WHERE document_type = 'PURCHASE_RECEIPT' AND year_no = ?`, [year]);
        const documentNumber = `PR-${year}-${counters[0]!.last_number.padStart(6, '0')}`;
        const receipt = PurchaseReceipt.create({ documentNumber, receiptDate, supplierId, productId,
          warehouseId, quantity, unitPrice: price, notes });
        // Kapasitas kolom adalah batas penyimpanan, diperiksa setelah keputusan domain.
        const maxBigint = 9_223_372_036_854_775_807n;
        if (receipt.quantity > maxBigint || receipt.unitPrice > maxBigint || receipt.totalAmount > maxBigint) {
          throw new PurchaseReceiptRuleError('MALFORMED_REQUEST', 'Jumlah, harga atau total melebihi kapasitas BIGINT database.');
        }
        const id = receipt.id;
        await em.execute(`INSERT INTO procurement_purchase_receipts
          (id, document_number, receipt_date, supplier_id, product_id, warehouse_id,
           quantity_grams, unit_price_microrupiah_per_kg, total_amount_rupiah, status,
           notes, created_at, accepted_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, receipt.documentNumber, receipt.receiptDate, receipt.supplierId, receipt.productId, receipt.warehouseId,
            receipt.quantity.toString(), receipt.unitPrice.toString(), receipt.totalAmount.toString(), receipt.status,
            receipt.notes, receipt.createdAt, receipt.acceptedAt, receipt.createdAt]);
        await em.execute(`INSERT INTO procurement_purchase_price_history
          (id, product_id, supplier_id, source_purchase_receipt_id, effective_date,
           unit_price_microrupiah_per_kg, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [randomUUID(), receipt.productId, receipt.supplierId, id, receipt.receiptDate, receipt.unitPrice.toString(), receipt.createdAt]);
        const rows = await em.execute<ReceiptRow[]>(receiptSelect + ' WHERE id = ?', [id]);
        return toJson(rows[0]!);
      });
      res.status(201).json({ data: { ...created, loanDeduction: null }, meta: {} });
    } catch (error) {
      if (error instanceof PurchaseReceiptRuleError) {
        reject(422, error.code, error.message);
        return;
      }
      throw error;
    }
  });
  app.get('/api/v1/procurement/purchase-receipts', async (req, res) => {
    const reject = (code: string, message: string) => {
      res.status(400).json({ error: { code, message, details: {} } });
    };
    const keys = [
      'status',
      'supplierId',
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
    if (query.status !== undefined && !['ACCEPTED', 'CANCELLED'].includes(query.status)) {
      reject(
        'PURCHASE_RECEIPT_QUERY_INVALID_STATUS',
        "Status harus salah satu dari 'ACCEPTED', 'CANCELLED'.",
      );
      return;
    }
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const key of ['supplierId', 'productId', 'warehouseId'] as const) {
      if (query[key] !== undefined && !uuid.test(query[key]!)) {
        reject('PURCHASE_RECEIPT_QUERY_INVALID_REFERENCE_ID', `${key} harus berupa id yang valid.`);
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
          'PURCHASE_RECEIPT_QUERY_INVALID_DATE',
          `${key} harus berupa tanggal yang valid (TTTT-BB-HH).`,
        );
        return;
      }
    }
    if (query.dateFrom && query.dateTo && query.dateFrom > query.dateTo) {
      reject(
        'PURCHASE_RECEIPT_QUERY_INVALID_DATE_RANGE',
        'Tanggal awal tidak boleh setelah tanggal akhir.',
      );
      return;
    }
    const limit = query.limit === undefined ? 50 : Number(query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      reject(
        'PURCHASE_RECEIPT_QUERY_INVALID_LIMIT',
        'Batas data per halaman harus bilangan bulat antara 1 dan 200.',
      );
      return;
    }
    const filtersFingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          status: query.status ?? null,
          supplierId: query.supplierId ?? null,
          productId: query.productId ?? null,
          warehouseId: query.warehouseId ?? null,
          dateFrom: query.dateFrom ?? null,
          dateTo: query.dateTo ?? null,
        }),
      )
      .digest('hex')
      .slice(0, 16);
    let after: { receiptDate: string; id: string } | undefined;
    if (query.cursor !== undefined) {
      try {
        const cursor = JSON.parse(Buffer.from(query.cursor, 'base64url').toString('utf8'));
        if (
          !cursor ||
          typeof cursor.receiptDate !== 'string' ||
          typeof cursor.id !== 'string' ||
          cursor.filtersFingerprint !== filtersFingerprint ||
          !uuid.test(cursor.id) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(cursor.receiptDate)
        )
          throw Error();
        after = cursor;
      } catch {
        reject(
          'PURCHASE_RECEIPT_QUERY_INVALID_CURSOR',
          'Penanda halaman tidak valid, atau dibuat untuk filter yang berbeda.',
        );
        return;
      }
    }
    const conditions: string[] = [];
    const values: string[] = [];
    for (const [key, column] of [
      ['status', 'status'],
      ['supplierId', 'supplier_id'],
      ['productId', 'product_id'],
      ['warehouseId', 'warehouse_id'],
    ] as const) {
      if (query[key] !== undefined) {
        conditions.push(`${column} = ?`);
        values.push(query[key]!);
      }
    }
    if (query.dateFrom) {
      conditions.push('receipt_date >= ?');
      values.push(query.dateFrom);
    }
    if (query.dateTo) {
      conditions.push('receipt_date <= ?');
      values.push(query.dateTo);
    }
    if (after) {
      conditions.push('(receipt_date, id) < (?, ?)');
      values.push(after.receiptDate, after.id);
    }
    const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
    const rows = await orm.em
      .fork()
      .execute<ReceiptRow[]>(
        receiptSelect + where + ' ORDER BY receipt_date DESC, id DESC LIMIT ?',
        [...values, limit + 1],
      );
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    const nextCursor =
      hasMore && last
        ? Buffer.from(
            JSON.stringify({
              receiptDate: last.receipt_date,
              id: last.id,
              filtersFingerprint,
            }),
            'utf8',
          ).toString('base64url')
        : null;
    res.status(200).json({ data: page.map(toJson), meta: { nextCursor, hasMore, limit } });
  });

  app.get('/api/v1/procurement/purchase-receipts/:id', async (req, res) => {
    const rows = await orm.em.fork().execute<ReceiptRow[]>(receiptSelect + ' WHERE id = ?', [req.params.id]);
    if (!rows[0]) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Penerimaan pembelian tidak ditemukan.', details: {} } });
      return;
    }
    res.status(200).json({ data: toJson(rows[0]), meta: {} });
  });
}
