import DeliveryPreview from './DeliveryPreview.js';
import { Plus } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
interface Reference {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  roles?: { roleCode: string; isActive: boolean }[];
}
interface Shipment {
  id: string;
  documentNumber: string;
  shipmentDate: string;
  warehouseId: string;
  productId: string;
  customerId: string | null;
  loadingQuantityGrams: string;
  loadingInventoryCostRupiah: string;
  status: 'IN_TRANSIT' | 'COMPLETED';
}
interface PageMeta {
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
}
function kilograms(value: string) {
  const grams = BigInt(value);
  const fraction = (grams % 1000n).toString().padStart(3, '0').replace(/0+$/, '');
  return (grams / 1000n).toLocaleString('id-ID') + (fraction ? ',' + fraction : '') + ' kg';
}
function statusLabel(status: Shipment['status']) {
  return status === 'IN_TRANSIT' ? 'Dalam Perjalanan' : 'Selesai';
}

export default function ShipmentPage() {
  const [filters, setFilters] = useSearchParams();
  const filterKey = filters.toString();
  const [history, setHistory] = useState<{ key: string; cursors: string[] }>({
    key: '',
    cursors: [],
  });
  const cursors = history.key === filterKey ? history.cursors : [];
  const cursor = cursors.at(-1);
  const [rows, setRows] = useState<Shipment[]>([]);
  const [meta, setMeta] = useState<PageMeta>({ nextCursor: null, hasMore: false, limit: 50 });
  const [products, setProducts] = useState<Reference[]>([]);
  const [warehouses, setWarehouses] = useState<Reference[]>([]);
  const [partners, setPartners] = useState<Reference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const location = useLocation();
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const query = new URLSearchParams(filterKey);
    if (cursor) query.set('cursor', cursor);
    void (async () => {
      try {
        const responses = await Promise.all([
          fetch('/api/v1/sales/shipments?' + query, { signal: controller.signal }),
          ...['products', 'warehouses', 'partners'].map((route) =>
            fetch('/api/v1/' + route, { signal: controller.signal }),
          ),
        ]);
        const bodies = await Promise.all(responses.map((response) => response.json()));
        const failed = responses.findIndex((response) => !response.ok);
        if (failed >= 0) throw Error(bodies[failed]?.error?.message ?? 'Gagal memuat pengiriman.');
        if (controller.signal.aborted) return;
        setRows(bodies[0].data);
        setMeta(bodies[0].meta);
        setProducts(bodies[1].data);
        setWarehouses(bodies[2].data);
        setPartners(bodies[3].data);
      } catch (failure) {
        if (!controller.signal.aborted)
          setError(failure instanceof Error ? failure.message : 'Gagal memuat pengiriman.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [filterKey, cursor, retry]);
  function changeFilter(key: string, value: string) {
    const next = new URLSearchParams(filters);
    if (value) next.set(key, value);
    else next.delete(key);
    setFilters(next, { replace: true });
  }
  return (
    <section className="receipt-page shipment-page">
      <header className="receipt-header">
        <div>
          <h1>Pengiriman</h1>
          <p>Daftar pengiriman penjualan ke pelanggan.</p>
        </div>
        <Link className="receipt-button receipt-primary" to="/sales/shipments/new">
          <Plus size={16} aria-hidden="true" />
          Tambah Pengiriman
        </Link>
      </header>
      {(location.state as { message?: string } | null)?.message && (
        <p role="status" className="receipt-notice">
          Pengiriman berhasil dibuat.
        </p>
      )}
      <div className="receipt-filters">
        <select
          aria-label="Status"
          value={filters.get('status') ?? ''}
          onChange={(e) => changeFilter('status', e.target.value)}
        >
          <option value="">Semua status</option>
          <option value="IN_TRANSIT">Dalam Perjalanan</option>
          <option value="COMPLETED">Selesai</option>
        </select>
        {[
          { key: 'customerId', label: 'Pelanggan', rows: partners },
          { key: 'productId', label: 'Produk', rows: products },
          { key: 'warehouseId', label: 'Gudang', rows: warehouses },
        ].map((group) => (
          <select
            key={group.key}
            aria-label={group.label}
            value={filters.get(group.key) ?? ''}
            onChange={(e) => changeFilter(group.key, e.target.value)}
          >
            <option value="">Semua {group.label.toLowerCase()}</option>
            {group.rows.map((row) => (
              <option key={row.id} value={row.id}>
                {row.code} — {row.name}
              </option>
            ))}
          </select>
        ))}
        <label>
          Dari
          <input
            aria-label="Tanggal dari"
            type="date"
            value={filters.get('dateFrom') ?? ''}
            onChange={(e) => changeFilter('dateFrom', e.target.value)}
          />
        </label>
        <label>
          Sampai
          <input
            aria-label="Tanggal sampai"
            type="date"
            value={filters.get('dateTo') ?? ''}
            onChange={(e) => changeFilter('dateTo', e.target.value)}
          />
        </label>
        {filterKey && (
          <button className="receipt-button" onClick={() => setFilters({})}>
            Hapus filter
          </button>
        )}
      </div>
      {loading && <p role="status">Memuat pengiriman…</p>}
      {error && (
        <div role="alert" className="receipt-error">
          {error}{' '}
          <button className="receipt-button" onClick={() => setRetry(retry + 1)}>
            Coba lagi
          </button>
        </div>
      )}
      {!loading &&
        !error &&
        (rows.length === 0 ? (
          <div className="receipt-card receipt-empty">Belum ada pengiriman untuk pilihan ini.</div>
        ) : (
          <div
            className="receipt-table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Daftar pengiriman"
          >
            <table className="receipt-table">
              <thead>
                <tr>
                  {[
                    'No. Dokumen',
                    'Tanggal',
                    'Pelanggan',
                    'Produk',
                    'Gudang',
                    'Jumlah Muat',
                    'Status',
                    'Aksi',
                  ].map((label) => (
                    <th key={label}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.documentNumber}</td>
                    <td>{row.shipmentDate.split('-').reverse().join('/')}</td>
                    <td>
                      {row.customerId
                        ? (partners.find((item) => item.id === row.customerId)?.name ??
                          row.customerId)
                        : '—'}
                    </td>
                    <td>
                      {products.find((item) => item.id === row.productId)?.name ?? row.productId}
                    </td>
                    <td>
                      {warehouses.find((item) => item.id === row.warehouseId)?.name ??
                        row.warehouseId}
                    </td>
                    <td className="receipt-number">{kilograms(row.loadingQuantityGrams)}</td>
                    <td>
                      <span
                        className={
                          'receipt-badge ' +
                          (row.status === 'IN_TRANSIT' ? 'shipment-transit' : 'receipt-accepted')
                        }
                      >
                        {statusLabel(row.status)}
                      </span>
                    </td>
                    <td>
                      <Link
                        aria-label={'Detail ' + row.documentNumber}
                        to={'/sales/shipments/' + row.id}
                      >
                        Detail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      <div className="receipt-pagination">
        <span>{!loading && !error ? rows.length + ' data pada halaman ini' : ''}</span>
        <div>
          <button
            className="receipt-button"
            disabled={loading || !!error || cursors.length === 0}
            onClick={() => setHistory({ key: filterKey, cursors: cursors.slice(0, -1) })}
          >
            Sebelumnya
          </button>
          <button
            className="receipt-button"
            disabled={loading || !!error || !meta.hasMore}
            onClick={() => {
              if (meta.nextCursor)
                setHistory({ key: filterKey, cursors: [...cursors, meta.nextCursor] });
            }}
          >
            Berikutnya
          </button>
        </div>
      </div>
    </section>
  );
}

export function ShipmentCreatePage() {
  const navigate = useNavigate();
  const [partners, setPartners] = useState<Reference[]>([]);
  const [products, setProducts] = useState<Reference[]>([]);
  const [warehouses, setWarehouses] = useState<Reference[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [pending, setPending] = useState(false);
  const saving = useRef(false);
  const [shipmentDate, setShipmentDate] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [productId, setProductId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [quantityKg, setQuantityKg] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    void (async () => {
      try {
        const responses = await Promise.all(
          ['partners', 'products', 'warehouses'].map((route) =>
            fetch('/api/v1/' + route, { signal: controller.signal }),
          ),
        );
        if (responses.some((response) => !response.ok)) throw Error('Gagal memuat pilihan master.');
        const bodies = await Promise.all(responses.map((response) => response.json()));
        if (controller.signal.aborted) return;
        setPartners(
          bodies[0].data.filter(
            (row: Reference) =>
              row.isActive &&
              row.roles?.some((role) => role.roleCode === 'CUSTOMER' && role.isActive),
          ),
        );
        setProducts(bodies[1].data.filter((row: Reference) => row.isActive));
        setWarehouses(bodies[2].data.filter((row: Reference) => row.isActive));
      } catch (failure) {
        if (!controller.signal.aborted)
          setLoadError(failure instanceof Error ? failure.message : 'Gagal memuat pilihan.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [retry]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current) return;
    setError('');
    if (!/^[0-9]+$/.test(quantityKg) || BigInt(quantityKg) <= 0n) {
      setError('Jumlah muat harus kg bulat lebih dari nol.');
      return;
    }
    saving.current = true;
    setPending(true);
    try {
      const response = await fetch('/api/v1/sales/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipmentDate,
          customerId: customerId || null,
          productId,
          warehouseId,
          loadingQuantityGrams: (BigInt(quantityKg) * 1000n).toString(),
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(
          (body.error?.code ?? 'ERROR') + ': ' + (body.error?.message ?? 'Pengiriman ditolak.'),
        );
        return;
      }
      const warnings = body.meta?.warnings ?? [];
      if (warnings.length)
        navigate('/sales/shipments/' + body.data.id, { state: { stockWarnings: warnings } });
      else navigate('/sales/shipments', { state: { message: 'Pengiriman berhasil dibuat.' } });
    } catch {
      setError('Tidak dapat memastikan hasil penyimpanan. Periksa daftar sebelum mengirim ulang.');
    } finally {
      saving.current = false;
      setPending(false);
    }
  }
  return (
    <section className="receipt-page shipment-page">
      <Link className="receipt-back" to="/sales/shipments">
        Pengiriman
      </Link>
      <header className="receipt-header">
        <h1>Tambah Pengiriman</h1>
      </header>
      {loading && <p role="status">Memuat pilihan master…</p>}
      {loadError && (
        <div role="alert" className="receipt-error">
          {loadError}{' '}
          <button className="receipt-button" onClick={() => setRetry(retry + 1)}>
            Coba lagi
          </button>
        </div>
      )}
      <div className="receipt-card">
        {error && (
          <p role="alert" className="receipt-error">
            {error}
          </p>
        )}
        <form onSubmit={(event) => void submit(event)}>
          <fieldset className="receipt-form" disabled={loading || !!loadError || pending}>
            <label>
              Tanggal Pengiriman *
              <input
                type="date"
                required
                value={shipmentDate}
                onChange={(e) => setShipmentDate(e.target.value)}
              />
            </label>
            <label>
              Pelanggan (opsional)
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Tanpa pelanggan</option>
                {partners.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.code} — {row.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Produk *
              <select required value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">Pilih produk</option>
                {products.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.code} — {row.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Gudang *
              <select required value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                <option value="">Pilih gudang</option>
                {warehouses.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.code} — {row.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Jumlah Muat (kg) *
              <input
                required
                inputMode="numeric"
                pattern="[0-9]+"
                value={quantityKg}
                onChange={(e) => setQuantityKg(e.target.value)}
              />
              <small>Masukkan berat dalam kg bulat.</small>
            </label>
            <div className="receipt-form-actions">
              <button className="receipt-button receipt-primary" type="submit">
                {pending ? 'Menyimpan…' : 'Simpan Pengiriman'}
              </button>{' '}
              <Link className="receipt-button" to="/sales/shipments">
                Batal
              </Link>
            </div>
          </fieldset>
        </form>
      </div>
    </section>
  );
}

export function ShipmentDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [references, setReferences] = useState<Reference[][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void (async () => {
      try {
        const responses = await Promise.all([
          fetch('/api/v1/sales/shipments/' + id, { signal: controller.signal }),
          ...['partners', 'products', 'warehouses'].map((route) =>
            fetch('/api/v1/' + route, { signal: controller.signal }),
          ),
        ]);
        const bodies = await Promise.all(responses.map((response) => response.json()));
        const failed = responses.findIndex((response) => !response.ok);
        if (failed >= 0) throw Error(bodies[failed]?.error?.message ?? 'Gagal memuat detail.');
        if (controller.signal.aborted) return;
        setShipment(bodies[0].data);
        setReferences(bodies.slice(1).map((body) => body.data));
      } catch (failure) {
        if (!controller.signal.aborted)
          setError(failure instanceof Error ? failure.message : 'Gagal memuat detail.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [id, retry]);
  const warnings =
    (location.state as { stockWarnings?: { code: string; message: string }[] } | null)
      ?.stockWarnings ?? [];
  return (
    <section className="receipt-page shipment-page">
      <Link className="receipt-back" to="/sales/shipments">
        Pengiriman
      </Link>
      <header className="receipt-header">
        <h1>Pengiriman{shipment ? ' — ' + shipment.documentNumber : ''}</h1>
      </header>
      {warnings.map((warning, index) => (
        <div key={index} role="alert" className="shipment-warning">
          <strong>Pengiriman tersimpan. Periksa stok.</strong>
          <p>{warning.message}</p>
        </div>
      ))}
      {loading && <p role="status">Memuat detail…</p>}
      {error && (
        <div role="alert" className="receipt-error">
          {error}{' '}
          <button className="receipt-button" onClick={() => setRetry(retry + 1)}>
            Coba lagi
          </button>
        </div>
      )}
      {!loading && !error && shipment && (
        <>
          <div className="receipt-card">
            <dl className="receipt-fields">
              <div>
                <dt>No. Dokumen</dt>
                <dd>{shipment.documentNumber}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <span
                    className={
                      'receipt-badge ' +
                      (shipment.status === 'IN_TRANSIT' ? 'shipment-transit' : 'receipt-accepted')
                    }
                  >
                    {statusLabel(shipment.status)}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Tanggal Pengiriman</dt>
                <dd>{shipment.shipmentDate.split('-').reverse().join('/')}</dd>
              </div>
              <div>
                <dt>Pelanggan</dt>
                <dd>
                  {shipment.customerId
                    ? (references[0]?.find((row) => row.id === shipment.customerId)?.name ??
                      shipment.customerId)
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>Produk</dt>
                <dd>
                  {references[1]?.find((row) => row.id === shipment.productId)?.name ??
                    shipment.productId}
                </dd>
              </div>
              <div>
                <dt>Gudang</dt>
                <dd>
                  {references[2]?.find((row) => row.id === shipment.warehouseId)?.name ??
                    shipment.warehouseId}
                </dd>
              </div>
              <div>
                <dt>Jumlah Muat</dt>
                <dd>{kilograms(shipment.loadingQuantityGrams)}</dd>
              </div>
              <div>
                <dt>Biaya Persediaan Saat Muat</dt>
                <dd>Rp{BigInt(shipment.loadingInventoryCostRupiah).toLocaleString('id-ID')}</dd>
              </div>
            </dl>
          </div>
          <Link
            className="receipt-back"
            to={'/inventory/movements?sourceType=Shipment&sourceId=' + shipment.id}
          >
            Lihat pergerakan stok pengiriman
          </Link>
          {shipment.status === 'IN_TRANSIT' && <DeliveryPreview shipmentId={shipment.id} />}
        </>
      )}
    </section>
  );
}