import { randomUUID } from 'node:crypto';

/** Pelanggaran aturan bisnis produk. `code` dikirim ke klien sebagai kode galat. */
export class ProductRuleError extends Error {
    constructor(
        readonly code: string,
        message: string,
    ) {
        super(message);
    }
}

const DEFAULT_UNIT_CODE = 'KG';

export interface ProductProps {
    code: string;
    name: string;
    unitCode: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}


export class Product {
    private constructor(
        readonly id: string,
        readonly version: number,
        private props: ProductProps,
    ) {}

    /** Membuat produk baru. Produk baru selalu aktif dan berversi 1; satuan bawaannya KG. */
    static create(params: { code: string; name: string; unitCode?: string | undefined }): Product {
        if (params.code.trim().length === 0) {
            throw new ProductRuleError('PRODUCT_INVALID_CODE', 'Kode produk tidak boleh kosong.');
        }
        if (params.name.trim().length === 0) {
            throw new ProductRuleError('PRODUCT_INVALID_NAME', 'Nama produk tidak boleh kosong.');
        }
        const unitCode = params.unitCode ?? DEFAULT_UNIT_CODE;
        if (unitCode.trim().length === 0) {
            throw new ProductRuleError('PRODUCT_INVALID_UNIT_CODE', 'Kode satuan produk tidak boleh kosong.');
        }
        const now = new Date();
        return new Product(randomUUID(), 1, {
            code: params.code,
            name: params.name,
            unitCode,
            isActive: true,
            createdAt: now,
            updatedAt: now,
        });
    }

    /** Membentuk kembali produk dari data yang sudah tersimpan. Aturan tidak diperiksa lagi. */
    static reconstitute(id: string, version: number, props: ProductProps): Product {
        return new Product(id, version, props);
    }

    get code(): string {
        return this.props.code;
    }

    get name(): string {
        return this.props.name;
    }

    get unitCode(): string {
        return this.props.unitCode;
    }

    get isActive(): boolean {
        return this.props.isActive;
    }

    get createdAt(): Date {
        return this.props.createdAt;
    }

    get updatedAt(): Date {
        return this.props.updatedAt;
    }

    /** Kode adalah identitas bisnis dan tidak berubah setelah produk dibuat. */
    update(params: { name?: string | undefined; unitCode?: string | undefined }): void {
        if (params.name !== undefined) {
            if (params.name.trim().length === 0) {
                throw new ProductRuleError('PRODUCT_INVALID_NAME', 'Nama produk tidak boleh kosong.');
            }
            this.props.name = params.name;
        }
        if (params.unitCode !== undefined) {
            if (params.unitCode.trim().length === 0) {
                throw new ProductRuleError('PRODUCT_INVALID_UNIT_CODE', 'Kode satuan produk tidak boleh kosong.');
            }
            this.props.unitCode = params.unitCode;
        }
        this.props.updatedAt = new Date();
    }

    activate(): void {
        if (this.props.isActive) return;
        this.props.isActive = true;
        this.props.updatedAt = new Date();
    }

    deactivate(): void {
        if (!this.props.isActive) return;
        this.props.isActive = false;
        this.props.updatedAt = new Date();
    }
}