import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
type Reference = { id: string; code: string; name: string };
type Row = Record<string, string>;
type Summary = {
  warehouseId: string;
  productCount: number;
  quantityGrams: string;
  inventoryValueRupiah: string;
};
const types: Record<string, string> = {
  RECEIPT: 'Penerimaan',
  ISSUE: 'Pengeluaran',
  ADJUSTMENT_IN: 'Penyesuaian Masuk',
  ADJUSTMENT_OUT: 'Penyesuaian Keluar',
  REJECT_RETURN: 'Retur Reject',
  CONVERSION_IN: 'Konversi Masuk',
  CONVERSION_OUT: 'Konversi Keluar',
};
// Pemformat tampilan lokal: jangan mengubah BIGINT menjadi number JavaScript.
function decimal(value: string, places: number) {
  const amount = BigInt(value),
    absolute = amount < 0n ? -amount : amount;
  const scale = 10n ** BigInt(places);
  const fraction = (absolute % scale).toString().padStart(places, '0').replace(/0+$/, '');
  return (
    (amount < 0n ? '-' : '') +
    (absolute / scale).toLocaleString('id-ID') +
    (fraction ? ',' + fraction : '')
  );
}
const kilograms = (value: string) => decimal(value, 3) + ' kg';
const rupiah = (value: string) => 'Rp' + BigInt(value).toLocaleString('id-ID');
const rate = (value: string) => 'Rp' + decimal(value, 6);
export default function InventoryPage({ movements = false }: { movements?: boolean }) {
  const location = useLocation();
  // Ganti filter berarti mulai daftar baru, bukan menambahkan halaman filter lama.
  return <InventoryList key={location.pathname + location.search} movements={movements} />;
}
function InventoryList({ movements }: { movements: boolean }) {
  const [filters, setFilters] = useSearchParams();
  const filterKey = filters.toString();
  const [warehouses, setWarehouses] = useState<Reference[]>([]);
  const [products, setProducts] = useState<Reference[]>([]);
  const [summary, setSummary] = useState<Summary[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const invalidDates = !!(
    filters.get('dateFrom') &&
    filters.get('dateTo') &&
    filters.get('dateFrom')! > filters.get('dateTo')!
  );
  useEffect(() => {
    const controller = new AbortController();
    if (invalidDates) {
      setLoading(false);
      return () => controller.abort();
    }
    setLoading(true);
    setError('');
    void (async () => {
      try {
        const params = new URLSearchParams(filterKey);
        params.delete('cursor');
        if (cursor) params.set('cursor', cursor);
        const urls = [
          '/api/v1/warehouses',
          '/api/v1/products',
          '/api/v1/inventory/' + (movements ? 'movements' : 'balances') + '?' + params,
        ];
        if (!movements) urls.push('/api/v1/inventory/balances/by-warehouse');
        const bodies = await Promise.all(
          urls.map(async (url) => {
            const response = await fetch(url, { signal: controller.signal });
            const body = await response.json();
            if (!response.ok) throw Error(body.error?.message ?? 'Gagal memuat persediaan.');
            return body;
          }),
        );
        if (controller.signal.aborted) return;
        setWarehouses(bodies[0].data);
        setProducts(bodies[1].data);
        setRows((previous) => (cursor ? [...previous, ...bodies[2].data] : bodies[2].data));
        setNextCursor(bodies[2].meta.nextCursor);
        if (!movements) setSummary(bodies[3].data);
      } catch (failure) {
        if (!controller.signal.aborted)
          setError(failure instanceof Error ? failure.message : 'Gagal memuat persediaan.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [filterKey, cursor, movements, retry, invalidDates]);
  const label = (references: Reference[], id: string) => {
    const ref = references.find((item) => item.id === id);
    return ref ? ref.code + ' — ' + ref.name : id;
  };
  function changeFilter(key: string, value: string) {
    const next = new URLSearchParams(filters);
    next.delete('cursor');
    if (value) next.set(key, value);
    else next.delete(key);
    setFilters(next, { replace: true });
  }
  const warehouseIds = [
    ...new Set([...warehouses.map((row) => row.id), ...summary.map((row) => row.warehouseId)]),
  ];
  warehouseIds.sort((a, b) => label(warehouses, a).localeCompare(label(warehouses, b)));
  return (
    <section className="inventory-page">
      <header className="inventory-header">
        <div>
          <h1>{movements ? 'Pergerakan Stok' : 'Saldo Stok'}</h1>
          <p>
            {movements
              ? 'Buku besar pergerakan persediaan — hanya-baca.'
              : 'Saldo persediaan saat ini per gudang dan produk.'}
          </p>
        </div>
        <Link
          className="inventory-button"
          to={movements ? '/inventory/balances' : '/inventory/movements'}
        >
          {movements ? 'Lihat Saldo Stok' : 'Lihat Pergerakan Stok'}
        </Link>
      </header>
      {error && (
        <div role="alert" className="inventory-error">
          {error}{' '}
          <button className="inventory-button" onClick={() => setRetry(retry + 1)}>
            Coba Lagi
          </button>
        </div>
      )}
      {!movements && !error && !loading && (
        <section aria-label="Saldo per gudang">
          <h2>Saldo per Gudang</h2>
          <div
            className="inventory-table-scroll"
            role="region"
            aria-label="Tabel saldo per gudang"
            tabIndex={0}
          >
            <table className="inventory-table">
              <caption className="sr-only">Saldo stok per gudang</caption>
              <thead>
                <tr>
                  <th>Gudang</th>
                  <th>Jumlah Produk</th>
                  <th>Kuantitas</th>
                  <th>Nilai Persediaan</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {warehouseIds.map((id) => {
                  const row = summary.find((item) => item.warehouseId === id);
                  return (
                    <tr key={id}>
                      <td>{label(warehouses, id)}</td>
                      <td className="inventory-number">{row?.productCount ?? 0}</td>
                      <td className="inventory-number">{kilograms(row?.quantityGrams ?? '0')}</td>
                      <td className="inventory-number">
                        {rupiah(row?.inventoryValueRupiah ?? '0')}
                      </td>
                      <td>
                        <button
                          className="inventory-button"
                          onClick={() => changeFilter('warehouseId', id)}
                        >
                          Lihat Produk
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {warehouseIds.length === 0 && <p className="inventory-empty">Belum ada gudang</p>}
        </section>
      )}
      {!movements && <h2>Saldo per Produk</h2>}
      <div className="inventory-filters">
        <select
          aria-label="Gudang"
          value={filters.get('warehouseId') ?? ''}
          onChange={(e) => changeFilter('warehouseId', e.target.value)}
        >
          <option value="">Semua gudang</option>
          {warehouses.map((row) => (
            <option key={row.id} value={row.id}>
              {row.code} — {row.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Produk"
          value={filters.get('productId') ?? ''}
          onChange={(e) => changeFilter('productId', e.target.value)}
        >
          <option value="">Semua produk</option>
          {products.map((row) => (
            <option key={row.id} value={row.id}>
              {row.code} — {row.name}
            </option>
          ))}
        </select>
        {movements && (
          <>
            <select
              aria-label="Jenis pergerakan"
              value={filters.get('movementType') ?? ''}
              onChange={(e) => changeFilter('movementType', e.target.value)}
            >
              <option value="">Semua jenis</option>
              {Object.entries(types).map(([key, text]) => (
                <option key={key} value={key}>
                  {text}
                </option>
              ))}
            </select>
            <label>
              Dari tanggal
              <input
                type="date"
                aria-invalid={invalidDates}
                value={filters.get('dateFrom') ?? ''}
                onChange={(e) => changeFilter('dateFrom', e.target.value)}
              />
            </label>
            <label>
              Sampai tanggal
              <input
                type="date"
                aria-invalid={invalidDates}
                value={filters.get('dateTo') ?? ''}
                onChange={(e) => changeFilter('dateTo', e.target.value)}
              />
            </label>
          </>
        )}
      </div>
      {filters.size > 0 && (
        <div className="inventory-chips">
          {[...filters].map(([key, value]) => (
            <button key={key} onClick={() => changeFilter(key, '')}>
              Hapus{' '}
              {key === 'warehouseId'
                ? 'Gudang: ' + label(warehouses, value)
                : key === 'productId'
                  ? 'Produk: ' + label(products, value)
                  : key === 'movementType'
                    ? 'Jenis: ' + (types[value] ?? value)
                    : key === 'dateFrom'
                      ? 'Dari: ' + value
                      : key === 'dateTo'
                        ? 'Sampai: ' + value
                        : key === 'sourceId'
                          ? 'Dokumen sumber: ' + value
                          : key + ': ' + value}{' '}
              ×
            </button>
          ))}
          <button onClick={() => setFilters({})}>Hapus Semua Filter</button>
        </div>
      )}
      {invalidDates && (
        <p role="alert" className="inventory-error">
          Tanggal Dari tidak boleh setelah tanggal Sampai.
        </p>
      )}
      {loading && <p role="status">Memuat persediaan…</p>}
      {!invalidDates && !error && rows.length > 0 && (
        <div
          className="inventory-table-scroll"
          role="region"
          aria-label={movements ? 'Tabel pergerakan stok' : 'Tabel saldo per produk'}
          tabIndex={0}
        >
          {movements ? (
            <table className="inventory-table">
              <caption className="sr-only">Pergerakan stok</caption>
              <thead>
                <tr>
                  {[
                    'Tanggal',
                    'Jenis',
                    'Produk',
                    'Gudang',
                    'Sumber',
                    'Masuk (kg)',
                    'Keluar (kg)',
                    'Nilai Masuk',
                    'Nilai Keluar',
                    'Saldo (kg)',
                    'Saldo Nilai',
                    'Rerata (Rp/kg)',
                    'Dicatat',
                  ].map((text) => (
                    <th key={text}>{text}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.movementId}>
                    <td>{row.movementDate}</td>
                    <td>{types[row.movementType] ?? row.movementType}</td>
                    <td>{label(products, row.productId)}</td>
                    <td>{label(warehouses, row.warehouseId)}</td>
                    <td>
                      {row.sourceType === 'PurchaseReceipt' ? (
                        <Link to={'/procurement/purchase-receipts/' + row.sourceId}>
                          Penerimaan Pembelian
                        </Link>
                      ) : (
                        row.sourceType
                      )}
                    </td>
                    <td className="inventory-number">{kilograms(row.quantityInGrams)}</td>
                    <td className="inventory-number">{kilograms(row.quantityOutGrams)}</td>
                    <td className="inventory-number">{rupiah(row.valueInRupiah)}</td>
                    <td className="inventory-number">{rupiah(row.valueOutRupiah)}</td>
                    <td className="inventory-number">{kilograms(row.balanceQuantityGrams)}</td>
                    <td className="inventory-number">{rupiah(row.balanceValueRupiah)}</td>
                    <td className="inventory-number">{rate(row.averageCostMicroRupiahPerKg)}</td>
                    <td>{new Date(row.createdAt).toLocaleString('id-ID')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="inventory-table">
              <caption className="sr-only">Saldo stok per produk dan gudang</caption>
              <thead>
                <tr>
                  {[
                    'Produk',
                    'Gudang',
                    'Kuantitas',
                    'Nilai Persediaan',
                    'Rerata Biaya (Rp/kg)',
                    'Diperbarui',
                    'Aksi',
                  ].map((text) => (
                    <th key={text}>{text}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.inventoryPoolId}>
                    <td>{label(products, row.productId)}</td>
                    <td>{label(warehouses, row.warehouseId)}</td>
                    <td className="inventory-number">{kilograms(row.quantityGrams)}</td>
                    <td className="inventory-number">{rupiah(row.inventoryValueRupiah)}</td>
                    <td className="inventory-number">{rate(row.averageCostMicroRupiahPerKg)}</td>
                    <td>{new Date(row.updatedAt).toLocaleString('id-ID')}</td>
                    <td>
                      <Link
                        to={
                          '/inventory/movements?' +
                          new URLSearchParams({
                            warehouseId: row.warehouseId,
                            productId: row.productId,
                          })
                        }
                      >
                        Lihat Kartu Stok
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {!loading && !error && !invalidDates && rows.length === 0 && (
        <p className="inventory-empty">
          {filters.size
            ? 'Tidak ada data yang cocok'
            : movements
              ? 'Belum ada pergerakan stok'
              : 'Belum ada saldo stok'}
        </p>
      )}
      {nextCursor && !error && (
        <button
          className="inventory-button"
          disabled={loading}
          onClick={() => setCursor(nextCursor)}
        >
          Muat Lebih Banyak
        </button>
      )}
    </section>
  );
}
