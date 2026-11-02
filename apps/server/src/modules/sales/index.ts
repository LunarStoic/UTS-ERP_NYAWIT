import type { EntityManager } from '@mikro-orm/mysql';
// Kontrak publik Sales: konteks lain mengirim hasil perhitungan, bukan menulis tabel Sales.
export async function correctLoadingInventoryCosts(
  em: EntityManager,
  affected: readonly { shipmentId: string; newLoadingInventoryCostRupiah: string }[],
) {
  for (const change of affected) {
    const rows = await em.execute<{ id: string; status: string }[]>(
      'SELECT id, status FROM sales_shipments WHERE id = ? FOR UPDATE',
      [change.shipmentId],
    );
    if (!rows[0]) throw Error('Shipment yang perlu diperbarui tidak ditemukan.');
    // Bab ini belum memiliki settlement/jurnal yang perlu direkonsiliasi.
    if (rows[0].status !== 'IN_TRANSIT')
      throw Error('Perhitungan biaya Shipment selesai belum didukung pada tahap ini.');
    await em.execute(
      `UPDATE sales_shipments SET loading_inventory_cost_rupiah = ?,
      version = version + 1, updated_at = ? WHERE id = ?`,
      [change.newLoadingInventoryCostRupiah, new Date(), change.shipmentId],
    );
  }
}
