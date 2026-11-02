import { Plus, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';

interface Product {
  id: string;
  code: string;
  name: string;
  unitCode: string;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export default function ProductListPage() {
  const [rows, setRows] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useSearchParams();
  const location = useLocation();
  const message = (location.state as { message?: string } | null)?.message;
  const search = filters.get('search') ?? '';
  const status = filters.get('status') ?? '';
  const filtered = rows.filter((row) => {
    const text = search.trim().toLowerCase();
    return (
      (row.code.toLowerCase().includes(text) || row.name.toLowerCase().includes(text)) &&
      (status !== 'active' || row.isActive) &&
      (status !== 'inactive' || !row.isActive)
    );
  });

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/v1/products');
      if (!response.ok) throw Error();
      const body = (await response.json()) as { data: Product[] };
      setRows(body.data);
    } catch {
      setError('Gagal memuat daftar produk.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  return (
    <section className="product-page">
      <header className="product-header">
        <div>
          <h1>Produk</h1>
          <p>Daftar produk yang dikelola di ERP.</p>
        </div>
        <Link className="product-button product-primary" to="/master-data/products/new">
          <Plus size={16} aria-hidden="true" />
          Tambah Produk
        </Link>
      </header>
      {message && (
        <p role="status" className="product-notice">
          {message}
        </p>
      )}
      <div className="product-filters">
        <input
          aria-label="Cari produk"
          placeholder="Cari…"
          value={search}
          onChange={(event) => {
            const next = new URLSearchParams(filters);
            if (event.target.value) next.set('search', event.target.value);
            else next.delete('search');
            setFilters(next, { replace: true });
          }}
        />
        <select
          aria-label="Status"
          value={status}
          onChange={(event) => {
            const next = new URLSearchParams(filters);
            if (event.target.value) next.set('status', event.target.value);
            else next.delete('status');
            setFilters(next, { replace: true });
          }}
        >
          <option value="">Semua status</option>
          <option value="active">Aktif</option>
          <option value="inactive">Tidak aktif</option>
        </select>
      </div>
      {(search || status) && (
        <div className="product-chips">
          {search && (
            <button
              onClick={() => {
                const next = new URLSearchParams(filters);
                next.delete('search');
                setFilters(next, { replace: true });
              }}
            >
              Cari: {search} ×
            </button>
          )}
          {status && (
            <button
              onClick={() => {
                const next = new URLSearchParams(filters);
                next.delete('status');
                setFilters(next, { replace: true });
              }}
            >
              Status: {status === 'active' ? 'Aktif' : 'Tidak aktif'} ×
            </button>
          )}
          <button onClick={() => setFilters({}, { replace: true })}>Hapus semua filter</button>
        </div>
      )}
      {loading ? (
        <p>Memuat…</p>
      ) : error ? (
        <div role="alert" className="product-card">
          <p>{error}</p>
          <button className="product-button" onClick={() => void load()}>
            Coba lagi
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="product-card product-empty">
          {search || status ? 'Tidak ada produk yang cocok' : 'Belum ada produk'}
        </div>
      ) : (
        <div className="product-table-scroll">
          <table className="product-table">
            <caption className="sr-only">Daftar produk</caption>
            <thead>
              <tr>
                <th>Kode</th>
                <th>Nama</th>
                <th>Satuan</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Tindakan</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td>{row.code}</td>
                  <td>{row.name}</td>
                  <td>{row.unitCode}</td>
                  <td>
                    <span className={`product-badge${row.isActive ? ' product-active' : ''}`}>
                      {row.isActive ? 'Aktif' : 'Tidak aktif'}
                    </span>
                  </td>
                  <td>
                    <Link aria-label={`Lihat ${row.name}`} to={`/master-data/products/${row.id}`}>
                      Lihat
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function ProductCreatePage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [unitCode, setUnitCode] = useState('');
  const [error, setError] = useState('');
  const [codeError, setCodeError] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setCodeError('');
    if (!code.trim()) {
      setCodeError('Kode produk wajib diisi.');
      return;
    }
    if (!name.trim()) {
      setError('Nama produk wajib diisi.');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/v1/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim(),
          name: name.trim(),
          ...(unitCode.trim() ? { unitCode: unitCode.trim() } : {}),
        }),
      });
      if (response.status === 409) {
        setCodeError('Kode produk sudah digunakan.');
        return;
      }
      if (!response.ok) {
        const body = (await response.json()) as { error?: { message?: string } };
        setError(body.error?.message ?? 'Produk gagal disimpan.');
        return;
      }
      navigate('/master-data/products', { state: { message: 'Produk berhasil dibuat.' } });
    } catch {
      setError('Produk gagal disimpan. Periksa apakah server berjalan.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="product-page">
      <Link className="product-back" to="/master-data/products">
        Produk
      </Link>
      <header className="product-header">
        <h1>Tambah Produk</h1>
      </header>
      <form className="product-card product-form" onSubmit={submit}>
        <div className="product-form-field">
          <label htmlFor="product-code">
            Kode <span aria-hidden="true">*</span>
          </label>
          <input
            id="product-code"
            aria-label="Kode"
            required
            value={code}
            aria-invalid={!!codeError}
            aria-describedby={codeError ? 'product-code-error' : undefined}
            onChange={(event) => setCode(event.target.value)}
          />
          {codeError && (
            <span id="product-code-error" role="alert" className="product-error">
              {codeError}
            </span>
          )}
        </div>
        <div className="product-form-field">
          <label htmlFor="product-name">
            Nama <span aria-hidden="true">*</span>
          </label>
          <input
            id="product-name"
            aria-label="Nama"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="product-form-field">
          <label htmlFor="product-unit">Kode Satuan</label>
          <input
            id="product-unit"
            value={unitCode}
            onChange={(event) => setUnitCode(event.target.value)}
            aria-describedby="product-unit-help"
          />
          <small id="product-unit-help">Opsional.</small>
        </div>
        {error && (
          <p role="alert" className="product-error product-span">
            {error}
          </p>
        )}
        <div className="product-span">
          <button className="product-button product-primary" disabled={saving}>
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </form>
    </section>
  );
}

export function ProductDetailPage() {
  const { id } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    setProduct(null);
    setError('');
    void (async () => {
      try {
        const response = await fetch(`/api/v1/products/${id}`);
        if (!response.ok) {
          setError(response.status === 404 ? 'Produk tidak ditemukan.' : 'Gagal memuat produk.');
          return;
        }
        const body = (await response.json()) as { data: Product };
        setProduct(body.data);
      } catch {
        setError('Gagal memuat produk.');
      }
    })();
  }, [id]);
  useEffect(() => {
    if (!dialogOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [dialogOpen]);
  async function changeStatus() {
    if (!product) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(
        `/api/v1/products/${product.id}/${product.isActive ? 'deactivate' : 'activate'}`,
        { method: 'POST' },
      );
      if (!response.ok) {
        setError('Status produk gagal diubah.');
        return;
      }
      const body = (await response.json()) as { data: Product };
      setProduct(body.data);
      setMessage(body.data.isActive ? 'Produk diaktifkan.' : 'Produk dinonaktifkan.');
      dialog.current?.close();
    } catch {
      setError('Status produk gagal diubah. Periksa apakah server berjalan.');
    } finally {
      setSaving(false);
    }
  }
  if (!product)
    return (
      <section className="product-page">
        <Link className="product-back" to="/master-data/products">
          Produk
        </Link>
        {error ? <p role="alert">{error}</p> : <p>Memuat…</p>}
      </section>
    );
  const action = product.isActive ? 'Nonaktifkan' : 'Aktifkan';
  return (
    <section className="product-page">
      <Link className="product-back" to="/master-data/products">
        {product.code}
      </Link>
      <header className="product-header">
        <h1>{product.name}</h1>
        <div className="product-actions">
          <Link
            className="product-button product-primary"
            to={`/master-data/products/${product.id}/edit`}
          >
            Ubah Produk
          </Link>
          <button
            className="product-button"
            onClick={() => {
              setError('');
              dialog.current?.showModal();
              setDialogOpen(true);
            }}
          >
            {action}
          </button>
        </div>
      </header>
      {message && (
        <p role="status" className="product-notice">
          {message}
        </p>
      )}
      {error && !dialogOpen && (
        <p role="alert" className="product-error">
          {error}
        </p>
      )}
      <dl className="product-card product-fields">
        <div>
          <dt>Kode</dt>
          <dd>{product.code}</dd>
        </div>
        <div>
          <dt>Nama</dt>
          <dd>{product.name}</dd>
        </div>
        <div>
          <dt>Satuan</dt>
          <dd>{product.unitCode}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <span className={`product-badge${product.isActive ? ' product-active' : ''}`}>
              {product.isActive ? 'Aktif' : 'Tidak aktif'}
            </span>
          </dd>
        </div>
        <div>
          <dt>Terakhir diperbarui</dt>
          <dd>{new Date(product.updatedAt).toLocaleString('id-ID')}</dd>
        </div>
        <div className="product-span">
          <dt>ID Sistem</dt>
          <dd className="product-id">{product.id}</dd>
        </div>
      </dl>
      <dialog
        ref={dialog}
        className="product-dialog"
        aria-labelledby="product-confirm-title"
        onCancel={(event) => {
          if (saving) event.preventDefault();
        }}
        onClose={() => setDialogOpen(false)}
        onKeyDown={(event) => {
          if (event.key !== 'Tab') return;
          const controls =
            event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled)');
          const first = controls[0],
            last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        onClick={(event) => {
          if (saving || event.target !== event.currentTarget) return;
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX >= rect.right ||
            event.clientY < rect.top ||
            event.clientY >= rect.bottom
          )
            dialog.current?.close();
        }}
      >
        <header>
          <h2 id="product-confirm-title">{action} produk ini?</h2>
          <button
            disabled={saving}
            className="erp-icon-button"
            aria-label="Tutup konfirmasi"
            onClick={() => dialog.current?.close()}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        {error && (
          <p role="alert" className="product-error">
            {error}
          </p>
        )}
        <footer>
          <button
            disabled={saving}
            className="product-button"
            onClick={() => dialog.current?.close()}
          >
            Batal
          </button>
          <button
            disabled={saving}
            className="product-button product-primary"
            onClick={() => void changeStatus()}
          >
            {saving ? 'Menyimpan…' : action}
          </button>
        </footer>
      </dialog>
    </section>
  );
}

export function ProductEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [name, setName] = useState('');
  const [unitCode, setUnitCode] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setProduct(null);
    setError('');
    void (async () => {
      try {
        const response = await fetch(`/api/v1/products/${id}`);
        if (!response.ok) {
          setError(response.status === 404 ? 'Produk tidak ditemukan.' : 'Gagal memuat produk.');
          return;
        }
        const body = (await response.json()) as { data: Product };
        setProduct(body.data);
        setName(body.data.name);
        setUnitCode(body.data.unitCode);
      } catch {
        setError('Gagal memuat produk.');
      }
    })();
  }, [id]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!product) return;
    if (!name.trim()) {
      setError('Nama produk wajib diisi.');
      return;
    }
    if (!unitCode.trim()) {
      setError('Kode satuan produk tidak boleh kosong.');
      return;
    }
    const patch: { name?: string; unitCode?: string } = {};
    if (name.trim() !== product.name) patch.name = name.trim();
    const nextUnitCode = unitCode.trim();
    if (nextUnitCode !== product.unitCode) patch.unitCode = nextUnitCode;
    if (Object.keys(patch).length === 0) {
      navigate('/master-data/products');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/v1/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: { message?: string } };
        setError(body.error?.message ?? 'Produk gagal disimpan.');
        return;
      }
      navigate('/master-data/products', { state: { message: 'Perubahan disimpan.' } });
    } catch {
      setError('Produk gagal disimpan. Periksa apakah server berjalan.');
    } finally {
      setSaving(false);
    }
  }
  if (!product)
    return (
      <section className="product-page">
        <Link className="product-back" to="/master-data/products">
          Produk
        </Link>
        {error ? <p role="alert">{error}</p> : <p>Memuat…</p>}
      </section>
    );
  return (
    <section className="product-page">
      <Link className="product-back" to="/master-data/products">
        {product.name}
      </Link>
      <header className="product-header">
        <h1>Ubah Produk — {product.code}</h1>
      </header>
      <form className="product-card product-form" onSubmit={submit}>
        <div className="product-form-field">
          <label htmlFor="product-name">
            Nama <span aria-hidden="true">*</span>
          </label>
          <input
            id="product-name"
            aria-label="Nama"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="product-form-field">
          <label htmlFor="product-unit">Kode Satuan</label>
          <input
            id="product-unit"
            value={unitCode}
            onChange={(event) => setUnitCode(event.target.value)}
            aria-describedby="product-unit-help"
          />
          <small id="product-unit-help">Satuan yang sudah tersimpan tidak boleh kosong.</small>
        </div>
        {error && (
          <p role="alert" className="product-error product-span">
            {error}
          </p>
        )}
        <div className="product-span">
          <button className="product-button product-primary" disabled={saving}>
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </form>
    </section>
  );
}
