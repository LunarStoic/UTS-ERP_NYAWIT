import { useEffect, useState, type FormEvent } from 'react';

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

export default function App() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadWarehouses() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await fetch('/api/v1/warehouses');
      if (!response.ok) {
        throw new Error(`Status ${response.status}`);
      }
      const body = (await response.json()) as { data: Warehouse[] };
      setWarehouses(body.data);
    } catch {
      setLoadError('Daftar gudang tidak dapat dimuat. Periksa apakah server berjalan.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadWarehouses();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setIsSaving(true);
    try {
      const response = await fetch('/api/v1/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name, address: address.trim() === '' ? null : address }),
});
if (!response.ok) {
const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
setFormError(body?.error?.message ?? 'Gudang gagal disimpan. Silakan coba lagi.');
return;
}
setCode('');
setName('');
setAddress('');
await loadWarehouses();
} catch {
setFormError('Gudang gagal disimpan. Periksa apakah server berjalan.');
} finally {
setIsSaving(false);
}
}
return (
<main className="mx-auto max-w-3xl p-6">
<h1 className="text-2xl font-semibold">Gudang</h1>
<form onSubmit={handleSubmit} className="mt-6 grid gap-3 rounded border border-gray-300 p-4">
<h2 className="font-medium">Tambah gudang</h2>
<label className="grid gap-1 text-sm">
Kode
<input
value={code}
onChange={(event) => setCode(event.target.value)}
className="rounded border border-gray-300 px-2 py-1"
/>
</label>
<label className="grid gap-1 text-sm">
Nama
<input
value={name}
onChange={(event) => setName(event.target.value)}
className="rounded border border-gray-300 px-2 py-1"
/>
</label>
<label className="grid gap-1 text-sm">
Alamat
<input
value={address}
onChange={(event) => setAddress(event.target.value)}
className="rounded border border-gray-300 px-2 py-1"
/>
</label>
{formError ? (
<p role="alert" className="text-sm text-red-700">
{formError}
</p>
) : null}
<button
type="submit"
disabled={isSaving}
className="justify-self-start rounded bg-green-700 px-3 py-1 text-white disabled:opacity-50"
>
{isSaving ? 'Menyimpan...' : 'Simpan'}
</button>
</form>
<section className="mt-8">
<h2 className="font-medium">Daftar gudang</h2>
{isLoading ? <p className="mt-2 text-sm text-gray-600">Memuat...</p> : null}
{loadError ? (
<p role="alert" className="mt-2 text-sm text-red-700">
{loadError}
</p>
) : null}
{!isLoading && !loadError && warehouses.length === 0 ? (
<p className="mt-2 text-sm text-gray-600">Belum ada gudang.</p>
) : null}
{warehouses.length > 0 ? (
<table className="mt-2 w-full text-left text-sm">
<thead>
<tr className="border-b border-gray-300">
<th className="py-1">Kode</th>
<th>Nama</th>
<th>Alamat</th>
<th>Status</th>
</tr>
</thead>
<tbody>
{warehouses.map((warehouse) => (
<tr key={warehouse.id} className="border-b border-gray-200">
<td className="py-1">{warehouse.code}</td>
<td>{warehouse.name}</td>
<td>{warehouse.address ?? '-'}</td>
<td>{warehouse.isActive ? 'Aktif' : 'Nonaktif'}</td>
</tr>
))}
</tbody>
</table>
) : null}
</section>
</main>
);
}