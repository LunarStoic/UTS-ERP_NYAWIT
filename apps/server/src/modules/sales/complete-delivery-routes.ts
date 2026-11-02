import type { Express } from 'express';
import type { MikroORM } from '@mikro-orm/mysql';
import { Shipment, ShipmentRuleError } from './domain/shipment/shipment.js';
import { DeliverySettlementCalculator } from './domain/shipment/delivery-settlement-calculator.js';
import { SalesSettlement, SalesSettlementRuleError } from './domain/sales-settlement/sales-settlement.js';
import { ShipmentCostAllocationPolicy } from '../inventory/index.js';
export function registerCompleteDeliveryRoutes(app: Express, orm: MikroORM) {
  app.post('/api/v1/sales/shipments/:id/complete-delivery', async (req, res) => {
    const reject = (status: number, code: string, message: string) => res.status(status).json({ error: { code, message, details: {} } });
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(req.params.id))) { reject(400, 'MALFORMED_REQUEST', 'Id tidak valid.'); return; }
    const version = req.get('If-Match') === undefined ? NaN : Number(req.get('If-Match'));
    if (!Number.isInteger(version)) { reject(400, 'IF_MATCH_REQUIRED', 'Versi pada If-Match wajib diisi.'); return; }
    const { ticketQuantityGrams, sortingDeductionGrams = '0', rejectQuantityGrams = '0',
      sellingPriceMicroRupiahPerKg, settlementDate, receivingReferenceNumber = null, notes = null } = req.body ?? {};
    const numbers = [ticketQuantityGrams, sortingDeductionGrams, rejectQuantityGrams, sellingPriceMicroRupiahPerKg];
    if (numbers.some(x => typeof x !== 'string' || !/^\d+$/.test(x) || BigInt(x) > 9223372036854775807n) ||
      typeof settlementDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(settlementDate) ||
      !Number.isFinite(Date.parse(settlementDate + 'T00:00:00Z')) ||
      new Date(settlementDate + 'T00:00:00Z').toISOString().slice(0, 10) !== settlementDate ||
      Number(settlementDate.slice(0, 4)) < 1000 ||
      (receivingReferenceNumber !== null && (typeof receivingReferenceNumber !== 'string' || receivingReferenceNumber.length > 60)) ||
      (notes !== null && typeof notes !== 'string')) {
      reject(400, 'MALFORMED_REQUEST', 'Jumlah, harga, tanggal atau referensi bongkar tidak valid.'); return;
    }
    try {
      const data = await orm.em.fork().transactional(async em => {
        const rows = await em.execute<Record<string, any>[]>(`SELECT *, DATE_FORMAT(shipment_date,'%Y-%m-%d') date_text,
          CAST(loading_quantity_grams AS CHAR) quantity_text, CAST(loading_inventory_cost_rupiah AS CHAR) cost_text,
          DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s.%fZ') created_text
          FROM sales_shipments WHERE id=? FOR UPDATE`, [req.params.id]);
        const row = rows[0];
        if (!row) throw new ShipmentRuleError('NOT_FOUND', 'Pengiriman tidak ditemukan.');
        if (Number(row.version) !== version) throw new ShipmentRuleError('VERSION_CONFLICT', 'Versi pengiriman sudah berubah.');
        if (row.status !== 'IN_TRANSIT') throw new ShipmentRuleError('SHIPMENT_INVALID_STATE_TRANSITION', 'Pengiriman tidak lagi IN_TRANSIT.');
        if (BigInt(rejectQuantityGrams) > 0n) throw new ShipmentRuleError('REJECT_TARGET_NOT_CONFIGURED', 'Produk Reject belum dikonfigurasi.');
        const calculation = DeliverySettlementCalculator.calculate({ loadingGrams: BigInt(row.quantity_text),
          ticketGrams: BigInt(ticketQuantityGrams), sortingDeductionGrams: BigInt(sortingDeductionGrams),
          rejectGrams: BigInt(rejectQuantityGrams), sellingPriceMicroRupiahPerKg: BigInt(sellingPriceMicroRupiahPerKg) });
        if (calculation.kind === 'invalid') throw new ShipmentRuleError(calculation.code, calculation.message);
        const b = calculation.breakdown;
        if ([b.grossRevenueRupiah, b.discountRupiah, b.netRevenueRupiah].some(x => x > 9223372036854775807n))
          throw new SalesSettlementRuleError('SALES_SETTLEMENT_INVALID_AMOUNT', 'Nilai penjualan melebihi kapasitas penyimpanan.');
        const shipment = Shipment.reconstitute({ id: row.id, documentNumber: row.document_number,
          shipmentDate: row.date_text, warehouseId: row.warehouse_id, productId: row.product_id,
          customerId: row.customer_id, loadingQuantity: BigInt(row.quantity_text), loadingInventoryCost: BigInt(row.cost_text),
          status: row.status, version: Number(row.version), createdAt: new Date(row.created_text) });
        shipment.completeDelivery(b);
        const settlement = SalesSettlement.create({ shipmentId: shipment.id, settlementDate, receivingReferenceNumber, amounts: b });
        const cost = ShipmentCostAllocationPolicy.allocate({ loadingQuantity: shipment.loadingQuantity,
          acceptedQuantity: b.acceptedGrams, rejectQuantity: b.rejectGrams, shrinkageQuantity: b.shrinkageGrams,
          frozenLoadingInventoryCost: shipment.loadingInventoryCost });
        await em.execute(`INSERT INTO sales_sales_settlements
          (id,shipment_id,receiving_reference_number,settlement_date,accepted_quantity_grams,reject_quantity_grams,
          shrinkage_quantity_grams,selling_price_microrupiah_per_kg,gross_revenue_rupiah,discount_rupiah,net_revenue_rupiah,
          cogs_rupiah,reject_inventory_value_rupiah,shrinkage_loss_rupiah,status,created_at,settled_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [settlement.id,shipment.id,receivingReferenceNumber,settlementDate,b.acceptedGrams.toString(),b.rejectGrams.toString(),
            b.shrinkageGrams.toString(),b.sellingPriceMicroRupiahPerKg.toString(),b.grossRevenueRupiah.toString(),
            b.discountRupiah.toString(),b.netRevenueRupiah.toString(),cost.cogs.toString(),cost.rejectAllocatedValue.toString(),cost.shrinkageLoss.toString(),settlement.status,
            settlement.createdAt,settlement.createdAt,settlement.createdAt]);
        await em.execute(`UPDATE sales_shipments SET status=?,version=version+1,completed_at=?,updated_at=? WHERE id=?`,
          [shipment.status,settlement.createdAt,settlement.createdAt,shipment.id]);
        return { shipment: { id: shipment.id, documentNumber: shipment.documentNumber, shipmentDate: shipment.shipmentDate,
          warehouseId: shipment.warehouseId, productId: shipment.productId, customerId: shipment.customerId,
          loadingQuantityGrams: shipment.loadingQuantity.toString(), loadingInventoryCostRupiah: shipment.loadingInventoryCost.toString(),
          status: shipment.status, version: version+1, createdBy: row.created_by, completedBy: null,
          createdAt: shipment.createdAt.toISOString(), completedAt: settlement.createdAt.toISOString(), updatedAt: settlement.createdAt.toISOString() },
          salesSettlement: { id: settlement.id, shipmentId: shipment.id, receivingReferenceNumber,
            settlementDate, acceptedQuantityGrams: b.acceptedGrams.toString(), rejectQuantityGrams: b.rejectGrams.toString(),
            shrinkageQuantityGrams: b.shrinkageGrams.toString(), sellingPriceMicroRupiahPerKg: b.sellingPriceMicroRupiahPerKg.toString(),
            grossRevenueRupiah: b.grossRevenueRupiah.toString(), discountRupiah: b.discountRupiah.toString(),
            netRevenueRupiah: b.netRevenueRupiah.toString(), status: settlement.status, version: 1,
            recordedBy: null, settledBy: null, createdAt: settlement.createdAt.toISOString(),
            settledAt: settlement.createdAt.toISOString(), updatedAt: settlement.createdAt.toISOString() } };
      });
      res.status(200).json({ data, meta: {} });
    } catch (error) {
      if (error instanceof ShipmentRuleError || error instanceof SalesSettlementRuleError) {
        const status = error.code === 'NOT_FOUND' ? 404 : ['VERSION_CONFLICT','SHIPMENT_INVALID_STATE_TRANSITION'].includes(error.code) ? 409 : 422;
        reject(status, error.code, error.message); return;
      }
      throw error;
    }
  });
}
