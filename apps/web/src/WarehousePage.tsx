import { Plus, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';

interface Warehouse {
  id: string;
  code: string;
  name: string;
  address: string | null;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export default function WarehousePage() {
  const [rows, setRows] = useState<Warehouse[]>([]);
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
      const response = await fetch('/api/v1/warehouses');
      if (!response.ok) throw Error();
      const body = (await response.json()) as { data: Warehouse[] };
      setRows(body.data);
    } catch {
      setError('Gagal memuat daftar gudang.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  return (
    <section className="warehouse-page">
      <header className="warehouse-header">
        <div>
          <h1>Gudang</h1>
          <p>Daftar gudang operasional.</p>
        </div>
        <Link className="warehouse-button warehouse-primary" to="/master-data/warehouses/new">
          <Plus size={16} aria-hidden="true" />
          Tambah Gudang
        </Link>
      </header>
      {message && (
        <p role="status" className="warehouse-notice">
          {message}
        </p>
      )}
      <div className="warehouse-filters">
        <input
          aria-label="Cari gudang"
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
        <div className="warehouse-chips">
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
        <div role="alert" className="warehouse-card">
          <p>{error}</p>
          <button className="warehouse-button" onClick={() => void load()}>
            Coba lagi
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="warehouse-card warehouse-empty">
          {search || status ? 'Tidak ada gudang yang cocok' : 'Belum ada gudang'}
        </div>
      ) : (
        <div className="warehouse-table-scroll">
          <table className="warehouse-table">
            <caption className="sr-only">Daftar gudang</caption>
            <thead>
              <tr>
                <th>Kode</th>
                <th>Nama</th>
                <th>Alamat</th>
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
                  <td>{row.address ?? '—'}</td>
                  <td>
                    <span className={`warehouse-badge${row.isActive ? ' warehouse-active' : ''}`}>
                      {row.isActive ? 'Aktif' : 'Tidak aktif'}
                    </span>
                  </td>
                  <td>
                    <Link aria-label={`Lihat ${row.name}`} to={`/master-data/warehouses/${row.id}`}>
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

export function WarehouseCreatePage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [codeError, setCodeError] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setCodeError('');
    if (!code.trim()) {
      setCodeError('Kode gudang wajib diisi.');
      return;
    }
    if (!name.trim()) {
      setError('Nama gudang wajib diisi.');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/v1/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim(),
          name: name.trim(),
          ...(address.trim() ? { address: address.trim() } : {}),
        }),
      });
      if (response.status === 409) {
        setCodeError('Kode gudang sudah digunakan.');
        return;
      }
      if (!response.ok) {
        const body = (await response.json()) as { error?: { message?: string } };
        setError(body.error?.message ?? 'Gudang gagal disimpan.');
        return;
      }
      navigate('/master-data/warehouses', { state: { message: 'Gudang berhasil dibuat.' } });
    } catch {
      setError('Gudang gagal disimpan. Periksa apakah server berjalan.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="warehouse-page">
      <Link className="warehouse-back" to="/master-data/warehouses">
        Gudang
      </Link>
      <header className="warehouse-header">
        <h1>Tambah Gudang</h1>
      </header>
      <form className="warehouse-card warehouse-form" onSubmit={submit}>
        <div className="warehouse-form-field">
          <label htmlFor="warehouse-code">
            Kode <span aria-hidden="true">*</span>
          </label>
          <input
            id="warehouse-code"
            aria-label="Kode"
            required
            value={code}
            aria-invalid={!!codeError}
            aria-describedby={codeError ? 'warehouse-code-error' : undefined}
            onChange={(event) => setCode(event.target.value)}
          />
          {codeError && (
            <span id="warehouse-code-error" role="alert" className="warehouse-error">
              {codeError}
            </span>
          )}
        </div>
        <div className="warehouse-form-field">
          <label htmlFor="warehouse-name">
            Nama <span aria-hidden="true">*</span>
          </label>
          <input
            id="warehouse-name"
            aria-label="Nama"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="warehouse-form-field">
          <label htmlFor="warehouse-address">Alamat</label>
          <input
            id="warehouse-address"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            aria-describedby="warehouse-address-help"
          />
          <small id="warehouse-address-help">Opsional.</small>
        </div>
        {error && (
          <p role="alert" className="warehouse-error warehouse-span">
            {error}
          </p>
        )}
        <div className="warehouse-span">
          <button className="warehouse-button warehouse-primary" disabled={saving}>
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </form>
    </section>
  );
}

export function WarehouseDetailPage() {
  const { id } = useParams();
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    setWarehouse(null);
    setError('');
    void (async () => {
      try {
        const response = await fetch(`/api/v1/warehouses/${id}`);
        if (!response.ok) {
          setError(response.status === 404 ? 'Gudang tidak ditemukan.' : 'Gagal memuat gudang.');
          return;
        }
        const body = (await response.json()) as { data: Warehouse };
        setWarehouse(body.data);
      } catch {
        setError('Gagal memuat gudang.');
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
    if (!warehouse) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(
        `/api/v1/warehouses/${warehouse.id}/${warehouse.isActive ? 'deactivate' : 'activate'}`,
        { method: 'POST' },
      );
      if (!response.ok) {
        setError('Status gudang gagal diubah.');
        return;
      }
      const body = (await response.json()) as { data: Warehouse };
      setWarehouse(body.data);
      setMessage(body.data.isActive ? 'Gudang diaktifkan.' : 'Gudang dinonaktifkan.');
      dialog.current?.close();
    } catch {
      setError('Status gudang gagal diubah. Periksa apakah server berjalan.');
    } finally {
      setSaving(false);
    }
  }
  if (!warehouse)
    return (
      <section className="warehouse-page">
        <Link className="warehouse-back" to="/master-data/warehouses">
          Gudang
        </Link>
        {error ? <p role="alert">{error}</p> : <p>Memuat…</p>}
      </section>
    );
  const action = warehouse.isActive ? 'Nonaktifkan' : 'Aktifkan';
  return (
    <section className="warehouse-page">
      <Link className="warehouse-back" to="/master-data/warehouses">
        {warehouse.code}
      </Link>
      <header className="warehouse-header">
        <h1>{warehouse.name}</h1>
        <div className="warehouse-actions">
          <Link
            className="warehouse-button warehouse-primary"
            to={`/master-data/warehouses/${warehouse.id}/edit`}
          >
            Ubah Gudang
          </Link>
          <button
            className="warehouse-button"
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
        <p role="status" className="warehouse-notice">
          {message}
        </p>
      )}
      {error && !dialogOpen && (
        <p role="alert" className="warehouse-error">
          {error}
        </p>
      )}
      <dl className="warehouse-card warehouse-fields">
        <div>
          <dt>Kode</dt>
          <dd>{warehouse.code}</dd>
        </div>
        <div>
          <dt>Nama</dt>
          <dd>{warehouse.name}</dd>
        </div>
        <div className="warehouse-span">
          <dt>Alamat</dt>
          <dd>{warehouse.address ?? '—'}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <span className={`warehouse-badge${warehouse.isActive ? ' warehouse-active' : ''}`}>
              {warehouse.isActive ? 'Aktif' : 'Tidak aktif'}
            </span>
          </dd>
        </div>
        <div>
          <dt>Terakhir diperbarui</dt>
          <dd>{new Date(warehouse.updatedAt).toLocaleString('id-ID')}</dd>
        </div>
        <div className="warehouse-span">
          <dt>ID Sistem</dt>
          <dd className="warehouse-id">{warehouse.id}</dd>
        </div>
      </dl>
      <dialog
        ref={dialog}
        className="warehouse-dialog"
        aria-labelledby="warehouse-confirm-title"
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
          <h2 id="warehouse-confirm-title">{action} gudang ini?</h2>
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
          <p role="alert" className="warehouse-error">
            {error}
          </p>
        )}
        <footer>
          <button
            disabled={saving}
            className="warehouse-button"
            onClick={() => dialog.current?.close()}
          >
            Batal
          </button>
          <button
            disabled={saving}
            className="warehouse-button warehouse-primary"
            onClick={() => void changeStatus()}
          >
            {saving ? 'Menyimpan…' : action}
          </button>
        </footer>
      </dialog>
    </section>
  );
}

export function WarehouseEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setWarehouse(null);
    setError('');
    void (async () => {
      try {
        const response = await fetch(`/api/v1/warehouses/${id}`);
        if (!response.ok) {
          setError(response.status === 404 ? 'Gudang tidak ditemukan.' : 'Gagal memuat gudang.');
          return;
        }
        const body = (await response.json()) as { data: Warehouse };
        setWarehouse(body.data);
        setName(body.data.name);
        setAddress(body.data.address ?? '');
      } catch {
        setError('Gagal memuat gudang.');
      }
    })();
  }, [id]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!warehouse) return;
    if (!name.trim()) {
      setError('Nama gudang wajib diisi.');
      return;
    }
    const patch: { name?: string; address?: string | null } = {};
    if (name.trim() !== warehouse.name) patch.name = name.trim();
    const nextAddress = address.trim() || null;
    if (nextAddress !== warehouse.address) patch.address = nextAddress;
    if (Object.keys(patch).length === 0) {
      navigate('/master-data/warehouses');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/v1/warehouses/${warehouse.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: { message?: string } };
        setError(body.error?.message ?? 'Gudang gagal disimpan.');
        return;
      }
      navigate('/master-data/warehouses', { state: { message: 'Gudang berhasil diperbarui.' } });
    } catch {
      setError('Gudang gagal disimpan. Periksa apakah server berjalan.');
    } finally {
      setSaving(false);
    }
  }
  if (!warehouse)
    return (
      <section className="warehouse-page">
        <Link className="warehouse-back" to="/master-data/warehouses">
          Gudang
        </Link>
        {error ? <p role="alert">{error}</p> : <p>Memuat…</p>}
      </section>
    );
  return (
    <section className="warehouse-page">
      <Link className="warehouse-back" to="/master-data/warehouses">
        {warehouse.name}
      </Link>
      <header className="warehouse-header">
        <h1>Ubah Gudang — {warehouse.code}</h1>
      </header>
      <form className="warehouse-card warehouse-form" onSubmit={submit}>
        <div className="warehouse-form-field">
          <label htmlFor="warehouse-name">
            Nama <span aria-hidden="true">*</span>
          </label>
          <input
            id="warehouse-name"
            aria-label="Nama"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="warehouse-form-field">
          <label htmlFor="warehouse-address">Alamat</label>
          <input
            id="warehouse-address"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            aria-describedby="warehouse-address-help"
          />
          <small id="warehouse-address-help">Kosongkan untuk menghapus.</small>
        </div>
        {error && (
          <p role="alert" className="warehouse-error warehouse-span">
            {error}
          </p>
        )}
        <div className="warehouse-span">
          <button className="warehouse-button warehouse-primary" disabled={saving}>
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </form>
    </section>
  );
}
