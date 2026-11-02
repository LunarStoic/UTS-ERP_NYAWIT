import { randomUUID } from 'node:crypto';
export class PurchaseReceiptRuleError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}
export interface PurchaseReceiptProps {
  documentNumber: string;
  receiptDate: string;
  supplierId: string;
  productId: string;
  warehouseId: string;
  quantity: bigint;
  unitPrice: bigint;
  totalAmount: bigint;
  status: 'ACCEPTED';
  notes: string | null;
  createdAt: Date;
  acceptedAt: Date;
}
// Satu dokumen penerimaan dan aturan miliknya; tidak mengetahui HTTP maupun SQL.
export class PurchaseReceipt {
  private constructor(readonly id: string, readonly version: number, private readonly props: PurchaseReceiptProps) {}
  static create(params: {
    documentNumber: string; receiptDate: string; supplierId: string; productId: string;
    warehouseId: string; quantity: bigint; unitPrice: bigint; notes?: string | null;
  }): PurchaseReceipt {
    if (params.documentNumber.trim().length === 0) {
      throw new PurchaseReceiptRuleError('PURCHASE_RECEIPT_INVALID_DOCUMENT_NUMBER', 'Nomor penerimaan tidak boleh kosong.');
    }
    if (params.quantity <= 0n) {
      throw new PurchaseReceiptRuleError('PURCHASE_RECEIPT_INVALID_QUANTITY', 'Jumlah penerimaan pembelian harus lebih besar dari nol.');
    }
    if (params.unitPrice < 0n) {
      throw new PurchaseReceiptRuleError('PURCHASE_RECEIPT_INVALID_UNIT_PRICE_FORMAT', 'Harga satuan harus berupa angka bulat tidak negatif.');
    }
    const now = new Date();
    const totalAmount = (params.quantity * params.unitPrice + 500_000_000n) / 1_000_000_000n;
    return new PurchaseReceipt(randomUUID(), 1, {
      ...params, totalAmount, status: 'ACCEPTED', notes: params.notes ?? null,
      createdAt: now, acceptedAt: now,
    });
  }

  get documentNumber() { return this.props.documentNumber; }
  get receiptDate() { return this.props.receiptDate; }
  get supplierId() { return this.props.supplierId; }
  get productId() { return this.props.productId; }
  get warehouseId() { return this.props.warehouseId; }
  get quantity() { return this.props.quantity; }
  get unitPrice() { return this.props.unitPrice; }
  get totalAmount() { return this.props.totalAmount; }
  get status() { return this.props.status; }
  get notes() { return this.props.notes; }
  get createdAt() { return this.props.createdAt; }
  get acceptedAt() { return this.props.acceptedAt; }
}
