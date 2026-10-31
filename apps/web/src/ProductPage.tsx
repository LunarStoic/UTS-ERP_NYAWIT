import { useEffect, useState, type FormEvent } from "react";

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

interface ErrorBody {
  error?: { message?: string };
}

export default function ProductPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [unitCode, setUnitCode] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  
  async function loadProducts() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/v1/products");
      if (!response.ok) {
        throw new Error(`Status ${response.status}`);
      }
      const body = (await response.json()) as { data: Product[] };
      setProducts(body.data);
    } catch {
      setLoadError(
        "Daftar produk tidak dapat dimuat. Periksa apakah server berjalan.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadProducts();
  }, []);

  function resetForm() {
    setEditingId(null);
    setCode("");
    setName("");
    setUnitCode("");
    setFormError(null);
  }

  function startEditing(product: Product) {
    setEditingId(product.id);
    setCode(product.code);
    setName(product.name);
    setUnitCode(product.unitCode);
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setIsSaving(true);
    try {
      const response =
        editingId === null
          ? await fetch("/api/v1/products", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                code,
                name,
                unitCode: unitCode.trim() === "" ? undefined : unitCode,
              }),
            })
          : await fetch(`/api/v1/products/${editingId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name, unitCode }),
            });
      if (!response.ok) {
        const body = (await response
          .json()
          .catch(() => null)) as ErrorBody | null;
        setFormError(
          body?.error?.message ?? "Produk gagal disimpan. Silakan coba lagi.",
        );
        return;
      }
      resetForm();
      await loadProducts();
    } catch {
      setFormError("Produk gagal disimpan. Periksa apakah server berjalan.");
    } finally {
      setIsSaving(false);
    }
  }

  async function setActive(product: Product, active: boolean) {
    setActionError(null);
    try {
      const response = await fetch(
        `/api/v1/products/${product.id}/${active ? "activate" : "deactivate"}`,
        {
          method: "POST",
        },
      );
      if (!response.ok) {
        const body = (await response
          .json()
          .catch(() => null)) as ErrorBody | null;
        setActionError(
          body?.error?.message ??
            "Status produk gagal diubah. Silakan coba lagi.",
        );
        return;
      }
      await loadProducts();
    } catch {
      setActionError(
        "Status produk gagal diubah. Periksa apakah server berjalan.",
      );
    }
  }
  
  return (
    <section className="min-w-0">
      <h1 className="text-2xl font-semibold">Produk</h1>
      <form
        onSubmit={handleSubmit}
        className="mt-6 grid gap-3 rounded border border-gray-300 p-4"
      >
        <h2 className="font-medium">
          {editingId === null ? "Tambah produk" : "Ubah produk"}
        </h2>
        <label className="grid gap-1 text-sm">
          Kode
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            readOnly={editingId !== null}
            className="rounded border border-gray-300 px-2 py-1 read-only:bg-gray-100"
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
          Satuan
          <input
            value={unitCode}
            onChange={(event) => setUnitCode(event.target.value)}
            placeholder="KG"
            className="rounded border border-gray-300 px-2 py-1"
          />
        </label>
        {formError ? (
          <p role="alert" className="text-sm text-red-700">
            {formError}
          </p>
        ) : null}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isSaving}
            className="rounded bg-green-700 px-3 py-1 text-white disabled:opacity-50"
          >
            {isSaving ? "Menyimpan..." : "Simpan"}
          </button>
          {editingId !== null ? (
            <button
              type="button"
              onClick={resetForm}
              className="rounded border border-gray-300 px-3 py-1"
            >
              Batal
            </button>
          ) : null}
        </div>
      </form>
      <section className="mt-8">
        <h2 className="font-medium">Daftar produk</h2>
        {isLoading ? (
          <p className="mt-2 text-sm text-gray-600">Memuat...</p>
        ) : null}
        {loadError ? (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {loadError}
          </p>
        ) : null}
        {actionError ? (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {actionError}
          </p>
        ) : null}
        {!isLoading && !loadError && products.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">Belum ada produk.</p>
        ) : null}
        {products.length > 0 ? (
          <div className="erp-table-scroll">
          <table className="mt-2 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="py-1">Kode</th>
                <th>Nama</th>
                <th>Satuan</th>
                <th>Status</th>
                <th>Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-gray-200">
                  <td className="py-1">{product.code}</td>
                  <td>{product.name}</td>
                  <td>{product.unitCode}</td>
                  <td>{product.isActive ? "Aktif" : "Nonaktif"}</td>
                  <td className="space-x-2">
                    <button
                      type="button"
                      onClick={() => startEditing(product)}
                      aria-label={`Ubah ${product.name}`}
                      className="text-green-800 underline"
                    >
                      Ubah
                    </button>
                    <button
                      type="button"
                      onClick={() => void setActive(product, !product.isActive)}
                      aria-label={`${product.isActive ? "Nonaktifkan" : "Aktifkan"} ${product.name}`}
                      className="text-green-800 underline"
                    >
                      {product.isActive ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        ) : null}
      </section>
    </section>
  );
}
