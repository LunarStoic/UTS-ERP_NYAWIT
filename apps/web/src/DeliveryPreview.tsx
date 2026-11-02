import { useEffect, useRef, useState, type FormEvent } from 'react';
interface Preview {
  breakdown: Record<string, string> | null;
  issue: { code: string; message: string } | null;
}
export default function DeliveryPreview({ shipmentId, shipmentVersion, onCompleted }: {
  shipmentId: string;
  shipmentVersion: number;
  onCompleted: () => void;
}) {
  const [settlementDate, setSettlementDate] = useState(() => {
    const now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0')
      + '-' + String(now.getDate()).padStart(2, '0');
  });
  const [saving, setSaving] = useState(false);
  const [reloadRequired, setReloadRequired] = useState(false);
  const [ticket, setTicket] = useState('');
  const [sorting, setSorting] = useState('');
  const [price, setPrice] = useState('');
  const [result, setResult] = useState<{ key: string; value: Preview } | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const request = useRef<AbortController | null>(null);
  const inputKey = JSON.stringify([shipmentId, ticket, sorting, price]);
  const preview = result?.key === inputKey ? result.value : null;
  useEffect(() => () => request.current?.abort(), []);
  async function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError('');
    setResult(null);
    if (![ticket, sorting || '0', price].every((value) => /^[0-9]+$/.test(value))) {
      setError('Berat dan harga harus bilangan bulat tidak negatif.');
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    try {
      const response = await fetch(
        '/api/v1/sales/shipments/' + shipmentId + '/complete-delivery/preview',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            ticketQuantityGrams: (BigInt(ticket) * 1000n).toString(),
            sortingDeductionGrams: (BigInt(sorting || '0') * 1000n).toString(),
            rejectQuantityGrams: '0',
            sellingPriceMicroRupiahPerKg: (BigInt(price) * 1_000_000n).toString(),
          }),
        },
      );
      const body = await response.json();
      if (!response.ok) throw Error(body.error?.message ?? 'Pratinjau gagal dimuat.');
      if (!controller.signal.aborted) setResult({ key: inputKey, value: body.data });
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(failure instanceof Error ? failure.message : 'Tidak dapat membaca pratinjau.');
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  }
  const b = preview?.breakdown;
  async function complete() {
    if (saving || pending || reloadRequired || !b || preview?.issue) return;
    if (!settlementDate) { setError('Tanggal Tiket (Bongkar) wajib diisi.'); return; }
    setError('');
    setSaving(true);
    try {
      const response = await fetch('/api/v1/sales/shipments/' + shipmentId + '/complete-delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'If-Match': String(shipmentVersion) },
        body: JSON.stringify({
          ticketQuantityGrams: (BigInt(ticket) * 1000n).toString(),
          sortingDeductionGrams: (BigInt(sorting || '0') * 1000n).toString(),
          rejectQuantityGrams: '0',
          sellingPriceMicroRupiahPerKg: (BigInt(price) * 1_000_000n).toString(),
          settlementDate,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error?.message ?? 'Hasil bongkar gagal disimpan.');
        if (['VERSION_CONFLICT', 'SHIPMENT_INVALID_STATE_TRANSITION'].includes(body.error?.code))
          setReloadRequired(true);
        return;
      }
      onCompleted();
    } catch {
      setError('Hasil penyimpanan belum dapat dipastikan. Muat ulang detail sebelum mencoba kembali.');
      setReloadRequired(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="receipt-card delivery-preview" aria-label="Tiket/Bongkar">
      <h2>Tiket/Bongkar</h2>
      <p>
        Periksa rincian tiket, lalu selesaikan pengiriman untuk menyimpan hasil bongkar.
        Pratinjau saja belum mengubah dokumen.
      </p>
      <form onSubmit={(event) => void calculate(event)}>
        <fieldset className="receipt-form" disabled={pending || saving}>
          <label>
            Tanggal Tiket (Bongkar)
            <input required type="date" value={settlementDate} onChange={(e) => setSettlementDate(e.target.value)} />
          </label>
          <label>
            Jumlah Bongkar / Tiket (kg)
            <input
              required
              inputMode="numeric"
              pattern="[0-9]+"
              value={ticket}
              onChange={(e) => {
                setTicket(e.target.value);
                setError('');
              }}
            />
          </label>
          <label>
            Potongan Sortasi (kg)
            <input
              inputMode="numeric"
              pattern="[0-9]+"
              value={sorting}
              onChange={(e) => {
                setSorting(e.target.value);
                setError('');
              }}
            />
            <small>Opsional. Potongan pembayaran, bukan barang yang kembali.</small>
          </label>
          <label>
            Harga Jual per Kg (Rupiah)
            <input
              required
              inputMode="numeric"
              pattern="[0-9]+"
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
                setError('');
              }}
            />
          </label>
          <div className="receipt-form-actions">
            <button className="receipt-button receipt-primary" type="submit">
              {pending ? 'Menghitung…' : 'Hitung Pratinjau'}
            </button>{' '}
            <button className="receipt-button receipt-primary" type="button"
              disabled={!b || Boolean(preview?.issue) || reloadRequired}
              onClick={() => void complete()}>
              {saving ? 'Menyimpan…' : 'Selesaikan Pengiriman'}
            </button>
          </div>
        </fieldset>
      </form>
      {error && (
        <p role="alert" className="receipt-error">
          {error}
        </p>
      )}
      {reloadRequired && <a className="receipt-back" href={'/sales/shipments/' + shipmentId}>Muat Ulang Detail</a>}
      {preview?.issue && (
        <p role="alert" className="shipment-warning">
          {preview.issue.message}
        </p>
      )}
      {b && (
        <section aria-label="Rincian perhitungan">
          <h3>Rincian Perhitungan</h3>
          <dl className="receipt-fields">
            {(
              [
                ['Jumlah dimuat', 'loadingQuantityGrams'],
                ['Jumlah bongkar / tiket', 'ticketQuantityGrams'],
                ['Susut perjalanan', 'shrinkageQuantityGrams'],
                ['Jumlah diterima pelanggan', 'acceptedQuantityGrams'],
                ['Potongan sortasi', 'sortingDeductionGrams'],
                ['Jumlah bersih', 'netQuantityGrams'],
              ] as const
            ).map(([label, key]) => {
              const grams = BigInt(b[key]!);
              const remainder = (grams % 1000n).toString().padStart(3, '0').replace(/0+$/, '');
              return (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>
                    {(grams / 1000n).toLocaleString('id-ID')}
                    {remainder ? ',' + remainder : ''} kg
                  </dd>
                </div>
              );
            })}
            {(
              [
                ['Nilai kotor', 'grossRevenueRupiah'],
                ['Nilai potongan sortasi', 'discountRupiah'],
                ['Total Bersih', 'netRevenueRupiah'],
              ] as const
            ).map(([label, key]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>Rp{BigInt(b[key]!).toLocaleString('id-ID')}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </section>
  );
}
