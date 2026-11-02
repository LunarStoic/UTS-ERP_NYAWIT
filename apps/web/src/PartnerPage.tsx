import { Plus, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';

const roleCodes = ['SUPPLIER', 'CUSTOMER', 'BORROWER'] as const;
const roleLabel: Record<string, string> = { SUPPLIER: 'Pemasok', CUSTOMER: 'Pelanggan', BORROWER: 'Anggota' };

interface PartnerRole {
  roleCode: string;
  isActive: boolean;
  createdAt: string;
}

interface Partner {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  roles: PartnerRole[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export default function PartnerListPage() {
  const [rows, setRows] = useState<Partner[]>([]);
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
      const response = await fetch('/api/v1/partners');
      if (!response.ok) throw Error();
      const body = (await response.json()) as { data: Partner[] };
      setRows(body.data);
    } catch {
      setError('Gagal memuat daftar mitra.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  return (
    <section className="partner-page">
      <header className="partner-header">
        <div>
          <h1>Mitra</h1>
          <p>Daftar mitra (pelanggan/pemasok/anggota) yang dikelola di ERP.</p>
        </div>
        <Link className="partner-button partner-primary" to="/master-data/partners/new">
          <Plus size={16} aria-hidden="true" />
          Tambah Mitra
        </Link>
      </header>
      {message && (
        <p role="status" className="partner-notice">
          {message}
        </p>
      )}
      <div className="partner-filters">
        <input
          aria-label="Cari mitra"
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
        <div className="partner-chips">
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
        <div role="alert" className="partner-card">
          <p>{error}</p>
          <button className="partner-button" onClick={() => void load()}>
            Coba lagi
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="partner-card partner-empty">
          {search || status ? 'Tidak ada mitra yang cocok' : 'Belum ada mitra'}
        </div>
      ) : (
        <div className="partner-table-scroll">
          <table className="partner-table">
            <caption className="sr-only">Daftar mitra</caption>
            <thead>
              <tr>
                <th>Kode</th>
                <th>Nama</th>
                <th>Telepon</th>
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
                  <td>{row.phone ?? '—'}</td>
                  <td>
                    <span className={`partner-badge${row.isActive ? ' partner-active' : ''}`}>
                      {row.isActive ? 'Aktif' : 'Tidak aktif'}
                    </span>
                  </td>
                  <td>
                    <Link aria-label={`Lihat ${row.name}`} to={`/master-data/partners/${row.id}`}>
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

export function PartnerCreatePage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [codeError, setCodeError] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setCodeError('');
    if (!code.trim()) {
      setCodeError('Kode mitra wajib diisi.');
      return;
    }
    if (!name.trim()) {
      setError('Nama mitra wajib diisi.');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/v1/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim(),
          name: name.trim(),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
          ...(address.trim() ? { address: address.trim() } : {}),
          roles: selectedRoles,
        }),
      });
      if (response.status === 409) {
        setCodeError('Kode mitra sudah digunakan.');
        return;
      }
      if (!response.ok) {
        const body = (await response.json()) as { error?: { message?: string } };
        setError(body.error?.message ?? 'Mitra gagal disimpan.');
        return;
      }
      navigate('/master-data/partners', { state: { message: 'Mitra berhasil dibuat.' } });
    } catch {
      setError('Mitra gagal disimpan. Periksa apakah server berjalan.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="partner-page">
      <Link className="partner-back" to="/master-data/partners">
        Mitra
      </Link>
      <header className="partner-header">
        <h1>Tambah Mitra</h1>
      </header>
      <form className="partner-card partner-form" onSubmit={submit}>
        <div className="partner-form-field">
          <label htmlFor="partner-code">
            Kode <span aria-hidden="true">*</span>
          </label>
          <input
            id="partner-code"
            maxLength={64}
            disabled={saving}
            aria-label="Kode"
            required
            value={code}
            aria-invalid={!!codeError}
            aria-describedby={codeError ? 'partner-code-error' : undefined}
            onChange={(event) => setCode(event.target.value)}
          />
          {codeError && (
            <span id="partner-code-error" role="alert" className="partner-error">
              {codeError}
            </span>
          )}
        </div>
        <div className="partner-form-field">
          <label htmlFor="partner-name">
            Nama <span aria-hidden="true">*</span>
          </label>
          <input
            id="partner-name"
            maxLength={200}
            disabled={saving}
            aria-label="Nama"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="partner-form-field">
          <label htmlFor="partner-phone">Telepon</label>
          <input
            id="partner-phone"
            autoComplete="tel"
            maxLength={32}
            disabled={saving}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            aria-describedby="partner-phone-help"
          />
          <small id="partner-phone-help">Opsional.</small>
        </div>
        <div className="partner-form-field">
          <label htmlFor="partner-address">Alamat</label>
          <input
            id="partner-address"
            maxLength={500}
            disabled={saving}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            aria-describedby="partner-address-help"
          />
          <small id="partner-address-help">Opsional.</small>
        </div>
        <fieldset className="partner-span partner-role-fields" disabled={saving}>
          <legend>Peran</legend>
          <p>Pilih satu atau lebih peran mitra ini.</p>
          <div className="partner-role-options">
            {roleCodes.map((role) => (
              <label key={role}>
                <input
                  type="checkbox"
                  checked={selectedRoles.includes(role)}
                  onChange={(event) =>
                    setSelectedRoles((current) =>
                      event.target.checked
                        ? [...current, role]
                        : current.filter((value) => value !== role),
                    )
                  }
                />
                {roleLabel[role]}
              </label>
            ))}
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="partner-error partner-span">
            {error}
          </p>
        )}
        <div className="partner-span">
          <button className="partner-button partner-primary" disabled={saving}>
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </form>
    </section>
  );
}

export function PartnerDetailPage() {
  const { id } = useParams();
  const [partner, setPartner] = useState<Partner | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    setPartner(null);
    setError('');
    void (async () => {
      try {
        const response = await fetch(`/api/v1/partners/${id}`);
        if (!response.ok) {
          setError(response.status === 404 ? 'Mitra tidak ditemukan.' : 'Gagal memuat mitra.');
          return;
        }
        const body = (await response.json()) as { data: Partner };
        setPartner(body.data);
      } catch {
        setError('Gagal memuat mitra.');
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
    if (!partner) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(
        `/api/v1/partners/${partner.id}/${partner.isActive ? 'deactivate' : 'activate'}`,
        { method: 'POST' },
      );
      if (!response.ok) {
        setError('Status mitra gagal diubah.');
        return;
      }
      const body = (await response.json()) as { data: Partner };
      setPartner(body.data);
      setMessage(body.data.isActive ? 'Mitra diaktifkan.' : 'Mitra dinonaktifkan.');
      dialog.current?.close();
    } catch {
      setError('Status mitra gagal diubah. Periksa apakah server berjalan.');
    } finally {
      setSaving(false);
    }
  }
  if (!partner)
    return (
      <section className="partner-page">
        <Link className="partner-back" to="/master-data/partners">
          Mitra
        </Link>
        {error ? <p role="alert">{error}</p> : <p>Memuat…</p>}
      </section>
    );
  const action = partner.isActive ? 'Nonaktifkan' : 'Aktifkan';
  return (
    <section className="partner-page">
      <Link className="partner-back" to="/master-data/partners">
        {partner.code}
      </Link>
      <header className="partner-header">
        <h1>{partner.name}</h1>
        <div className="partner-actions">
          <Link
            className="partner-button partner-primary"
            to={`/master-data/partners/${partner.id}/edit`}
          >
            Ubah Mitra
          </Link>
          <button
            className="partner-button"
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
        <p role="status" className="partner-notice">
          {message}
        </p>
      )}
      {error && !dialogOpen && (
        <p role="alert" className="partner-error">
          {error}
        </p>
      )}
      <dl className="partner-card partner-fields">
        <div>
          <dt>Kode</dt>
          <dd>{partner.code}</dd>
        </div>
        <div>
          <dt>Nama</dt>
          <dd>{partner.name}</dd>
        </div>
        <div>
          <dt>Telepon</dt>
          <dd>{partner.phone ?? '—'}</dd>
        </div>
        <div className="partner-span">
          <dt>Alamat</dt>
          <dd>{partner.address ?? '—'}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <span className={`partner-badge${partner.isActive ? ' partner-active' : ''}`}>
              {partner.isActive ? 'Aktif' : 'Tidak aktif'}
            </span>
          </dd>
        </div>
        <div>
          <dt>Peran</dt>
          <dd className="partner-role-options">
            {partner.roles.length === 0
              ? '—'
              : partner.roles.map((role) => (
                  <span
                    key={role.roleCode}
                    className={'partner-badge' + (role.isActive ? ' partner-role-active' : '')}
                    aria-label={
                      (roleLabel[role.roleCode] ?? role.roleCode) +
                      (role.isActive ? ' — Aktif' : ' — Tidak aktif')
                    }
                  >
                    {roleLabel[role.roleCode] ?? role.roleCode}
                  </span>
                ))}
          </dd>
        </div>
        <div>
          <dt>Terakhir diperbarui</dt>
          <dd>{new Date(partner.updatedAt).toLocaleString('id-ID')}</dd>
        </div>
        <div className="partner-span">
          <dt>ID Sistem</dt>
          <dd className="partner-id">{partner.id}</dd>
        </div>
      </dl>
      <dialog
        ref={dialog}
        className="partner-dialog"
        aria-labelledby="partner-confirm-title"
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
          <h2 id="partner-confirm-title">{action} mitra ini?</h2>
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
          <p role="alert" className="partner-error">
            {error}
          </p>
        )}
        <footer>
          <button
            disabled={saving}
            className="partner-button"
            onClick={() => dialog.current?.close()}
          >
            Batal
          </button>
          <button
            disabled={saving}
            className="partner-button partner-primary"
            onClick={() => void changeStatus()}
          >
            {saving ? 'Menyimpan…' : action}
          </button>
        </footer>
      </dialog>
    </section>
  );
}

export function PartnerEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [partner, setPartner] = useState<Partner | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setPartner(null);
    setError('');
    void (async () => {
      try {
        const response = await fetch(`/api/v1/partners/${id}`);
        if (!response.ok) {
          setError(response.status === 404 ? 'Mitra tidak ditemukan.' : 'Gagal memuat mitra.');
          return;
        }
        const body = (await response.json()) as { data: Partner };
        setPartner(body.data);
        setName(body.data.name);
        setPhone(body.data.phone ?? '');
        setAddress(body.data.address ?? '');
        setSelectedRoles(
          body.data.roles
            .filter((role) => role.isActive && roleCodes.some((code) => code === role.roleCode))
            .map((role) => role.roleCode),
        );
      } catch {
        setError('Gagal memuat mitra.');
      }
    })();
  }, [id]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!partner) return;
    if (!name.trim()) {
      setError('Nama mitra wajib diisi.');
      return;
    }
    const patch: { name?: string; phone?: string | null; address?: string | null } = {};
    if (name.trim() !== partner.name) patch.name = name.trim();
    const nextPhone = phone.trim() || null;
    if (nextPhone !== partner.phone) patch.phone = nextPhone;
    const nextAddress = address.trim() || null;
    if (nextAddress !== partner.address) patch.address = nextAddress;
    const initialRoles = partner.roles.filter((role) => role.isActive).map((role) => role.roleCode);
    const rolesToAdd = roleCodes.filter(
      (role) => selectedRoles.includes(role) && !initialRoles.includes(role),
    );
    const rolesToRemove = roleCodes.filter(
      (role) => !selectedRoles.includes(role) && initialRoles.includes(role),
    );
    if (Object.keys(patch).length === 0 && rolesToAdd.length === 0 && rolesToRemove.length === 0) {
      navigate('/master-data/partners');
      return;
    }
    setSaving(true);
    let confirmedWrites = 0;
    try {
      if (Object.keys(patch).length > 0) {
        const response = await fetch('/api/v1/partners/' + partner.id, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        if (!response.ok) {
          const body = (await response.json()) as { error?: { message?: string } };
          setError(body.error?.message ?? 'Mitra gagal disimpan.');
          return;
        }
        const body = (await response.json()) as { data: Partner };
        setPartner(body.data);
        confirmedWrites += 1;
      }
      // Setiap assignment peran memakai endpoint sendiri, setelah profil disimpan.
      for (const [roles, method] of [
        [rolesToAdd, 'POST'],
        [rolesToRemove, 'DELETE'],
      ] as const) {
        for (const role of roles) {
          const response = await fetch('/api/v1/partners/' + partner.id + '/roles/' + role, {
            method,
          });
          if (!response.ok) {
            const body = (await response.json()) as { error?: { message?: string } };
            setError(
              (confirmedWrites > 0 ? 'Sebagian perubahan sudah tersimpan. ' : '') +
                (body.error?.message ?? 'Peran gagal disimpan.'),
            );
            return;
          }
          const body = (await response.json()) as { data: Partner };
          setPartner(body.data);
          confirmedWrites += 1;
        }
      }
      navigate('/master-data/partners', { state: { message: 'Perubahan disimpan.' } });
    } catch {
      setError(
        (confirmedWrites > 0 ? 'Sebagian perubahan sudah tersimpan. ' : '') +
          'Penyimpanan terakhir belum dapat dipastikan. Periksa detail sebelum mencoba kembali.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (!partner)
    return (
      <section className="partner-page">
        <Link className="partner-back" to="/master-data/partners">
          Mitra
        </Link>
        {error ? <p role="alert">{error}</p> : <p>Memuat…</p>}
      </section>
    );
  return (
    <section className="partner-page">
      <Link className="partner-back" to="/master-data/partners">
        {partner.name}
      </Link>
      <header className="partner-header">
        <h1>Ubah Mitra — {partner.code}</h1>
      </header>
      <form className="partner-card partner-form" onSubmit={submit}>
        <div className="partner-form-field">
          <label htmlFor="partner-name">
            Nama <span aria-hidden="true">*</span>
          </label>
          <input
            id="partner-name"
            maxLength={200}
            disabled={saving}
            aria-label="Nama"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="partner-form-field">
          <label htmlFor="partner-phone">Telepon</label>
          <input
            id="partner-phone"
            autoComplete="tel"
            maxLength={32}
            disabled={saving}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            aria-describedby="partner-phone-help"
          />
          <small id="partner-phone-help">Kosongkan untuk menghapus.</small>
        </div>
        <div className="partner-form-field">
          <label htmlFor="partner-address">Alamat</label>
          <input
            id="partner-address"
            maxLength={500}
            disabled={saving}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            aria-describedby="partner-address-help"
          />
          <small id="partner-address-help">Kosongkan untuk menghapus.</small>
        </div>
        <fieldset className="partner-span partner-role-fields" disabled={saving}>
          <legend>Peran</legend>
          <p>Pilih satu atau lebih peran mitra ini.</p>
          <div className="partner-role-options">
            {roleCodes.map((role) => (
              <label key={role}>
                <input
                  type="checkbox"
                  checked={selectedRoles.includes(role)}
                  onChange={(event) =>
                    setSelectedRoles((current) =>
                      event.target.checked
                        ? [...current, role]
                        : current.filter((value) => value !== role),
                    )
                  }
                />
                {roleLabel[role]}
              </label>
            ))}
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="partner-error partner-span">
            {error}
          </p>
        )}
        <div className="partner-span">
          <button className="partner-button partner-primary" disabled={saving}>
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </form>
    </section>
  );
}
