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
interface PurchaseReceipt {
  id: string;
  documentNumber: string;
  receiptDate: string;
  supplierId: string;
  productId: string;
  warehouseId: string;
  quantityGrams: string;
  unitPriceMicroRupiahPerKg: string;
  totalAmountRupiah: string;
  status: string;
  notes: string | null;
  version: number;
  createdAt: string;
  acceptedAt: string;
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
function rupiah(value: string) {
  return 'Rp' + BigInt(value).toLocaleString('id-ID');
}
function pricePerKg(value: string) {
  const price = BigInt(value);
  const fraction = (price % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '');
  return rupiah((price / 1_000_000n).toString()) + (fraction ? ',' + fraction : '') + '/kg';
}

export default function PurchaseReceiptListPage() {
  const [filters, setFilters] = useSearchParams();
  const filterKey = filters.toString();
  const [history, setHistory] = useState<{ filterKey: string; cursors: string[] }>({
    filterKey: '',
    cursors: [],
  });
  const cursors = history.filterKey === filterKey ? history.cursors : [];
  const cursor = cursors.at(-1);
  const [rows, setRows] = useState<PurchaseReceipt[]>([]);
  const [meta, setMeta] = useState<PageMeta>({ nextCursor: null, hasMore: false, limit: 50 });
  const [products, setProducts] = useState<Reference[]>([]);
  const [warehouses, setWarehouses] = useState<Reference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const filterLabels: Record<string, string> = {
    status: 'Status',
    productId: 'Produk',
    warehouseId: 'Gudang',
    dateFrom: 'Dari',
    dateTo: 'Sampai',
    limit: 'Batas halaman',
  };
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const query = new URLSearchParams(filterKey);
    if (cursor) query.set('cursor', cursor);
    void (async () => {
      try {
        const responses = await Promise.all([
          fetch('/api/v1/procurement/purchase-receipts?' + query, { signal: controller.signal }),
          fetch('/api/v1/products', { signal: controller.signal }),
          fetch('/api/v1/warehouses', { signal: controller.signal }),
        ]);
        const bodies = await Promise.all(responses.map((response) => response.json()));
        if (responses.some((response) => !response.ok))
          throw Error(bodies[0]?.error?.message ?? 'Gagal memuat referensi.');
        if (controller.signal.aborted) return;
        setRows(bodies[0].data);
        setMeta(bodies[0].meta);
        setProducts(bodies[1].data);
        setWarehouses(bodies[2].data);
      } catch (failure) {
        if (!controller.signal.aborted)
          setError(failure instanceof Error ? failure.message : 'Gagal memuat penerimaan.');
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
    <section className="receipt-page">
      <header className="receipt-header">
        <div>
          <h1>Penerimaan Pembelian</h1>
          <p>Daftar penerimaan pembelian dari pemasok.</p>
        </div>
        <Link className="receipt-button receipt-primary" to="/procurement/purchase-receipts/new">
          <Plus size={16} aria-hidden="true" />
          Tambah Penerimaan
        </Link>
      </header>
      <div className="receipt-filters">
        <select
          aria-label="Status"
          value={filters.get('status') ?? ''}
          onChange={(event) => changeFilter('status', event.target.value)}
        >
          <option value="">Semua status</option>
          <option value="ACCEPTED">Diterima</option>
          <option value="CANCELLED">Dibatalkan</option>
        </select>
        <select
          aria-label="Produk"
          value={filters.get('productId') ?? ''}
          onChange={(event) => changeFilter('productId', event.target.value)}
        >
          <option value="">Semua produk</option>
          {products.map((row) => (
            <option key={row.id} value={row.id}>
              {row.code} — {row.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Gudang"
          value={filters.get('warehouseId') ?? ''}
          onChange={(event) => changeFilter('warehouseId', event.target.value)}
        >
          <option value="">Semua gudang</option>
          {warehouses.map((row) => (
            <option key={row.id} value={row.id}>
              {row.code} — {row.name}
            </option>
          ))}
        </select>
        <label>
          Dari
          <input
            aria-label="Tanggal dari"
            type="date"
            value={filters.get('dateFrom') ?? ''}
            onChange={(event) => changeFilter('dateFrom', event.target.value)}
          />
        </label>
        <label>
          Sampai
          <input
            aria-label="Tanggal sampai"
            type="date"
            value={filters.get('dateTo') ?? ''}
            onChange={(event) => changeFilter('dateTo', event.target.value)}
          />
        </label>
      </div>
      {filterKey && (
        <div className="receipt-chips">
          {[...filters].map(([key, value]) => (
            <button key={key} type="button" onClick={() => changeFilter(key, '')}>
              {filterLabels[key] ?? 'Filter'}:{' '}
              {key === 'status'
                ? value === 'ACCEPTED'
                  ? 'Diterima'
                  : 'Dibatalkan'
                : key === 'productId'
                  ? (products.find((row) => row.id === value)?.name ?? 'Produk tidak ditemukan')
                  : key === 'warehouseId'
                    ? (warehouses.find((row) => row.id === value)?.name ?? 'Gudang tidak ditemukan')
                    : value}{' '}
              ×
            </button>
          ))}
          <button type="button" onClick={() => setFilters({})}>
            Hapus semua filter
          </button>
        </div>
      )}
      {loading && <p role="status">Memuat penerimaan…</p>}
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
          <div className="receipt-card receipt-empty">
            {filterKey ? 'Tidak ada penerimaan yang cocok.' : 'Belum ada penerimaan pembelian.'}
          </div>
        ) : (
          <div
            className="receipt-table-scroll"
            tabIndex={0}
            aria-label="Tabel penerimaan, dapat digeser"
          >
            <table className="receipt-table">
              <caption className="sr-only">Daftar penerimaan pembelian</caption>
              <thead>
                <tr>
                  {[
                    'No. Dokumen',
                    'Tanggal',
                    'Produk',
                    'Gudang',
                    'Kuantitas',
                    'Total',
                    'Status',
                    'Tindakan',
                  ].map((label) => (
                    <th scope="col" key={label}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.documentNumber}</td>
                    <td>{row.receiptDate.split('-').reverse().join('/')}</td>
                    <td>
                      {products.find((ref) => ref.id === row.productId)?.name ?? row.productId}
                    </td>
                    <td>
                      {warehouses.find((ref) => ref.id === row.warehouseId)?.name ??
                        row.warehouseId}
                    </td>
                    <td className="receipt-number">{kilograms(row.quantityGrams)}</td>
                    <td className="receipt-number">{rupiah(row.totalAmountRupiah)}</td>
                    <td>
                      <span
                        className={
                          'receipt-badge' + (row.status === 'ACCEPTED' ? ' receipt-accepted' : '')
                        }
                      >
                        {row.status === 'ACCEPTED' ? 'Diterima' : 'Dibatalkan'}
                      </span>
                    </td>
                    <td>
                      <Link
                        aria-label={'Lihat ' + row.documentNumber}
                        to={'/procurement/purchase-receipts/' + row.id}
                      >
                        Lihat
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
            disabled={loading || Boolean(error) || cursors.length === 0}
            onClick={() => setHistory({ filterKey, cursors: cursors.slice(0, -1) })}
          >
            Sebelumnya
          </button>
          <button
            className="receipt-button"
            disabled={loading || Boolean(error) || !meta.hasMore}
            onClick={() => {
              if (meta.nextCursor)
                setHistory({ filterKey, cursors: [...cursors, meta.nextCursor] });
            }}
          >
            Berikutnya
          </button>
        </div>
      </div>
    </section>
  );
}

export function PurchaseReceiptCreatePage() {
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
  const [receiptDate, setReceiptDate] = useState('');
  const [supplierChoice, setSupplierChoice] = useState('');
  const [productChoice, setProductChoice] = useState('');
  const [warehouseChoice, setWarehouseChoice] = useState('');
  const [quantityKg, setQuantityKg] = useState('');
  const [unitPriceRupiahPerKg, setUnitPriceRupiahPerKg] = useState('');
  const [notes, setNotes] = useState('');
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
        if (responses.some((response) => !response.ok)) throw Error('Gagal memuat data master.');
        const bodies = await Promise.all(responses.map((response) => response.json()));
        if (controller.signal.aborted) return;
        setPartners(
          bodies[0].data.filter(
            (row: Reference) =>
              row.isActive &&
              row.roles?.some((role) => role.roleCode === 'SUPPLIER' && role.isActive),
          ),
        );
        setProducts(bodies[1].data.filter((row: Reference) => row.isActive));
        setWarehouses(bodies[2].data.filter((row: Reference) => row.isActive));
      } catch (failure) {
        if (!controller.signal.aborted)
          setLoadError(failure instanceof Error ? failure.message : 'Gagal memuat data master.');
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
    const supplier = partners.find((row) => row.code + ' — ' + row.name === supplierChoice);
    const product = products.find((row) => row.code + ' — ' + row.name === productChoice);
    const warehouse = warehouses.find((row) => row.code + ' — ' + row.name === warehouseChoice);
    if (!supplier || !product || !warehouse) {
      setError('Pilih pemasok, produk dan gudang dari pilihan yang tersedia.');
      return;
    }
    if (
      !/^[0-9]+$/.test(quantityKg) ||
      BigInt(quantityKg) === 0n ||
      !/^[0-9]+$/.test(unitPriceRupiahPerKg)
    ) {
      setError('Kuantitas harus kg bulat lebih dari nol; harga harus rupiah bulat tidak negatif.');
      return;
    }
    saving.current = true;
    setPending(true);
    try {
      const response = await fetch('/api/v1/procurement/purchase-receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiptDate,
          supplierId: supplier.id,
          productId: product.id,
          warehouseId: warehouse.id,
          quantityGrams: quantityKg + '000',
          unitPriceMicroRupiahPerKg: unitPriceRupiahPerKg + '000000',
          notes: notes === '' ? null : notes,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(
          (body.error?.code ?? 'ERROR') + ': ' + (body.error?.message ?? 'Penerimaan ditolak.'),
        );
        return;
      }
      navigate('/procurement/purchase-receipts/' + body.data.id, {
        state: { message: 'Penerimaan pembelian berhasil dibuat.' },
      });
    } catch {
      setError('Tidak dapat memastikan hasil penyimpanan. Periksa daftar sebelum mengirim ulang.');
    } finally {
      saving.current = false;
      setPending(false);
    }
  }
  return (
    <section className="receipt-page">
      <Link className="receipt-back" to="/procurement/purchase-receipts">
        Penerimaan Pembelian
      </Link>
      <header className="receipt-header">
        <h1>Tambah Penerimaan Pembelian</h1>
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
        {!loading && !loadError && (!partners.length || !products.length || !warehouses.length) && (
          <p role="alert">Siapkan pemasok, produk dan gudang aktif sebelum membuat penerimaan.</p>
        )}
        <form onSubmit={(event) => void submit(event)}>
          <fieldset disabled={loading || Boolean(loadError) || pending} className="receipt-form">
            <label>
              <span>
                Tanggal Penerimaan <span aria-hidden="true">*</span>
              </span>
              <input
                type="date"
                required
                value={receiptDate}
                onChange={(event) => setReceiptDate(event.target.value)}
              />
            </label>
            <label>
              <span>
                Pemasok <span aria-hidden="true">*</span>
              </span>
              <input
                required
                list="receipt-suppliers"
                value={supplierChoice}
                onChange={(event) => setSupplierChoice(event.target.value)}
                placeholder="Cari kode atau nama pemasok"
              />
              <datalist id="receipt-suppliers">
                {partners.map((row) => (
                  <option key={row.id} value={row.code + ' — ' + row.name} />
                ))}
              </datalist>
            </label>
            <label>
              <span>
                Produk <span aria-hidden="true">*</span>
              </span>
              <input
                required
                list="receipt-products"
                value={productChoice}
                onChange={(event) => setProductChoice(event.target.value)}
                placeholder="Cari kode atau nama produk"
              />
              <datalist id="receipt-products">
                {products.map((row) => (
                  <option key={row.id} value={row.code + ' — ' + row.name} />
                ))}
              </datalist>
            </label>
            <label>
              <span>
                Gudang <span aria-hidden="true">*</span>
              </span>
              <input
                required
                list="receipt-warehouses"
                value={warehouseChoice}
                onChange={(event) => setWarehouseChoice(event.target.value)}
                placeholder="Cari kode atau nama gudang"
              />
              <datalist id="receipt-warehouses">
                {warehouses.map((row) => (
                  <option key={row.id} value={row.code + ' — ' + row.name} />
                ))}
              </datalist>
            </label>
            <label>
              <span>
                Kuantitas (kg) <span aria-hidden="true">*</span>
              </span>
              <input
                required
                inputMode="numeric"
                pattern="[0-9]+"
                value={quantityKg}
                onChange={(event) => setQuantityKg(event.target.value)}
              />
              <small>Masukkan berat dalam kg bulat.</small>
            </label>
            <label>
              <span>
                Harga per Kg (Rupiah) <span aria-hidden="true">*</span>
              </span>
              <input
                required
                inputMode="numeric"
                pattern="[0-9]+"
                value={unitPriceRupiahPerKg}
                onChange={(event) => setUnitPriceRupiahPerKg(event.target.value)}
              />
              <small>Masukkan rupiah per kg, bukan mikro rupiah.</small>
            </label>
            <label>
              Catatan
              <textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
            <div className="receipt-form-actions">
              <button
                className="receipt-button receipt-primary"
                disabled={!partners.length || !products.length || !warehouses.length}
                type="submit"
              >
                {pending ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </fieldset>
        </form>
      </div>
    </section>
  );
}

export function PurchaseReceiptDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const [receipt, setReceipt] = useState<PurchaseReceipt | null>(null);
  const [partners, setPartners] = useState<Reference[]>([]);
  const [products, setProducts] = useState<Reference[]>([]);
  const [warehouses, setWarehouses] = useState<Reference[]>([]);
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
          fetch('/api/v1/procurement/purchase-receipts/' + id, { signal: controller.signal }),
          ...['partners', 'products', 'warehouses'].map((route) =>
            fetch('/api/v1/' + route, { signal: controller.signal }),
          ),
        ]);
        const bodies = await Promise.all(responses.map((response) => response.json()));
        if (responses.some((response) => !response.ok))
          throw Error(bodies[0]?.error?.message ?? 'Gagal memuat referensi.');
        if (controller.signal.aborted) return;
        setReceipt(bodies[0].data);
        setPartners(bodies[1].data);
        setProducts(bodies[2].data);
        setWarehouses(bodies[3].data);
      } catch (failure) {
        if (!controller.signal.aborted)
          setError(failure instanceof Error ? failure.message : 'Gagal memuat penerimaan.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [id, retry]);
  const message = (location.state as { message?: string } | null)?.message;
  return (
    <section className="receipt-page">
      <Link className="receipt-back" to="/procurement/purchase-receipts">
        Penerimaan Pembelian
      </Link>
      <header className="receipt-header">
        <h1>Penerimaan Pembelian{receipt ? ' — ' + receipt.documentNumber : ''}</h1>
      </header>
      {message && (
        <p role="status" className="receipt-notice">
          {message}
        </p>
      )}
      {loading && <p role="status">Memuat detail…</p>}
      {error && (
        <div role="alert" className="receipt-error">
          {error}{' '}
          <button className="receipt-button" onClick={() => setRetry(retry + 1)}>
            Coba lagi
          </button>
        </div>
      )}
      {!loading && !error && receipt && (
        <div className="receipt-card">
          <dl className="receipt-fields">
            <div>
              <dt>No. Dokumen</dt>
              <dd>{receipt.documentNumber}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <span className="receipt-badge receipt-accepted">
                  {receipt.status === 'ACCEPTED' ? 'Diterima' : 'Dibatalkan'}
                </span>
              </dd>
            </div>
            <div>
              <dt>Tanggal Penerimaan</dt>
              <dd>{receipt.receiptDate.split('-').reverse().join('/')}</dd>
            </div>
            <div>
              <dt>Pemasok</dt>
              <dd>
                {partners.find((row) => row.id === receipt.supplierId)?.name ?? receipt.supplierId}
              </dd>
            </div>
            <div>
              <dt>Produk</dt>
              <dd>
                {products.find((row) => row.id === receipt.productId)?.name ?? receipt.productId}
              </dd>
            </div>
            <div>
              <dt>Gudang</dt>
              <dd>
                {warehouses.find((row) => row.id === receipt.warehouseId)?.name ??
                  receipt.warehouseId}
              </dd>
            </div>
            <div>
              <dt>Kuantitas</dt>
              <dd>{kilograms(receipt.quantityGrams)}</dd>
            </div>
            <div>
              <dt>Harga per Kg (Rupiah)</dt>
              <dd>{pricePerKg(receipt.unitPriceMicroRupiahPerKg)}</dd>
            </div>
            <div>
              <dt>Total Nilai</dt>
              <dd>{rupiah(receipt.totalAmountRupiah)}</dd>
            </div>
            <div className="receipt-span">
              <dt>Catatan</dt>
              <dd>{receipt.notes ?? '—'}</dd>
            </div>
            <div>
              <dt>Versi</dt>
              <dd>{receipt.version}</dd>
            </div>
            <div>
              <dt>Dibuat</dt>
              <dd>{new Date(receipt.createdAt).toLocaleString('id-ID')}</dd>
            </div>
            <div>
              <dt>Diterima Pada</dt>
              <dd>{new Date(receipt.acceptedAt).toLocaleString('id-ID')}</dd>
            </div>
          </dl>
        </div>
      )}
    </section>
  );
}
