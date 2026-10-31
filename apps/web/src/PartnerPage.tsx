import { useEffect, useState, type FormEvent } from "react";

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

interface ErrorBody {
  error?: { message?: string };
}

const roleCodes = ["SUPPLIER", "CUSTOMER", "BORROWER"] as const;
const roleLabel: Record<string, string> = {
  SUPPLIER: "Pemasok",
  CUSTOMER: "Pelanggan",
  BORROWER: "Anggota",
  LENDER: "Pemberi Pinjaman",
  OTHER: "Lainnya",
};

function activeRoleLabels(partner: Partner): string {
  const labels = partner.roles
    .filter((role) => role.isActive)
    .map((role) => roleLabel[role.roleCode] ?? role.roleCode);
  return labels.length > 0 ? labels.join(", ") : "-";
}

export default function PartnerPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const editingPartner = partners.find((partner) => partner.id === editingId);
  
  async function loadPartners() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/v1/partners");
      if (!response.ok) {
        throw new Error(`Status ${response.status}`);
      }
      const body = (await response.json()) as { data: Partner[] };
      setPartners(body.data);
    } catch {
      setLoadError(
        "Daftar mitra tidak dapat dimuat. Periksa apakah server berjalan.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadPartners();
  }, []);

  function resetForm() {
    setEditingId(null);
    setCode("");
    setName("");
    setPhone("");
    setAddress("");
    setSelectedRoles([]);
    setFormError(null);
  }

  function startEditing(partner: Partner) {
    setEditingId(partner.id);
    setCode(partner.code);
    setName(partner.name);
    setPhone(partner.phone ?? "");
    setAddress(partner.address ?? "");
    setFormError(null);
  }

  function isRoleChecked(roleCode: string): boolean {
    if (editingPartner) {
      return editingPartner.roles.some(
        (role) => role.roleCode === roleCode && role.isActive,
      );
    }
    return selectedRoles.includes(roleCode);
  }

  async function handleRoleChange(roleCode: string, checked: boolean) {
    if (!editingPartner) {
      setSelectedRoles((current) =>
        checked
          ? [...current, roleCode]
          : current.filter((role) => role !== roleCode),
      );
      return;
    }
    setActionError(null);
    try {
      const response = await fetch(
        `/api/v1/partners/${editingPartner.id}/roles/${roleCode}`,
        {
          method: checked ? "POST" : "DELETE",
        },
      );
      if (!response.ok) {
        const body = (await response
          .json()
          .catch(() => null)) as ErrorBody | null;
        setActionError(
          body?.error?.message ??
            "Peran mitra gagal diubah. Silakan coba lagi.",
        );
        return;
      }
      await loadPartners();
    } catch {
      setActionError(
        "Peran mitra gagal diubah. Periksa apakah server berjalan.",
      );
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setIsSaving(true);
    try {
      const phoneValue = phone.trim() === "" ? null : phone;
      const addressValue = address.trim() === "" ? null : address;
      const response =
        editingId === null
          ? await fetch("/api/v1/partners", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                code,
                name,
                phone: phoneValue,
                address: addressValue,
                roles: selectedRoles,
              }),
            })
          : await fetch(`/api/v1/partners/${editingId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name,
                phone: phoneValue,
                address: addressValue,
              }),
            });
      if (!response.ok) {
        const body = (await response
          .json()
          .catch(() => null)) as ErrorBody | null;
        setFormError(
          body?.error?.message ?? "Mitra gagal disimpan. Silakan coba lagi.",
        );
        return;
      }
      resetForm();
      await loadPartners();
    } catch {
      setFormError("Mitra gagal disimpan. Periksa apakah server berjalan.");
    } finally {
      setIsSaving(false);
    }
  }

  async function setActive(partner: Partner, active: boolean) {
    setActionError(null);
    try {
      const response = await fetch(
        `/api/v1/partners/${partner.id}/${active ? "activate" : "deactivate"}`,
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
            "Status mitra gagal diubah. Silakan coba lagi.",
        );
        return;
      }
      await loadPartners();
    } catch {
      setActionError(
        "Status mitra gagal diubah. Periksa apakah server berjalan.",
      );
    }
  }
  
  return (
    <section className="min-w-0">
      <h1 className="text-2xl font-semibold">Mitra</h1>
      <form
        onSubmit={handleSubmit}
        className="mt-6 grid gap-3 rounded border border-gray-300 p-4"
      >
        <h2 className="font-medium">
          {editingId === null ? "Tambah mitra" : "Ubah mitra"}
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
          Telepon
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
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
        <fieldset className="grid gap-1 text-sm">
          <legend>
            {editingId === null ? "Peran" : "Peran (langsung tersimpan)"}
          </legend>
          <div className="flex flex-wrap gap-4">
            {roleCodes.map((roleCode) => (
              <label key={roleCode} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={isRoleChecked(roleCode)}
                  onChange={(event) =>
                    void handleRoleChange(roleCode, event.target.checked)
                  }
                />
                {roleLabel[roleCode]}
              </label>
            ))}
          </div>
        </fieldset>
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
        <h2 className="font-medium">Daftar mitra</h2>
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
        {!isLoading && !loadError && partners.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">Belum ada mitra.</p>
        ) : null}
        {partners.length > 0 ? (
          <div className="erp-table-scroll">
          <table className="mt-2 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="py-1">Kode</th>
                <th>Nama</th>
                <th>Telepon</th>
                <th>Peran</th>
                <th>Status</th>
                <th>Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((partner) => (
                <tr key={partner.id} className="border-b border-gray-200">
                  <td className="py-1">{partner.code}</td>
                  <td>{partner.name}</td>
                  <td>{partner.phone ?? "-"}</td>
                  <td>{activeRoleLabels(partner)}</td>
                  <td>{partner.isActive ? "Aktif" : "Nonaktif"}</td>
                  <td className="space-x-2">
                    <button
                      type="button"
                      onClick={() => startEditing(partner)}
                      aria-label={`Ubah ${partner.name}`}
                      className="text-green-800 underline"
                    >
                      Ubah
                    </button>
                    <button
                      type="button"
                      onClick={() => void setActive(partner, !partner.isActive)}
                      aria-label={`${partner.isActive ? "Nonaktifkan" : "Aktifkan"} ${partner.name}`}
                      className="text-green-800 underline"
                    >
                      {partner.isActive ? "Nonaktifkan" : "Aktifkan"}
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
