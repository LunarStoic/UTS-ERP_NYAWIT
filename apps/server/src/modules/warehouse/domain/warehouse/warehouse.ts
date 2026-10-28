import { randomUUID } from 'node:crypto';

/** Pelanggaran aturan bisnis gudang. 'code' dikirim ke client sebagai kode error */
export class WarehouseRuleError extends Error {
    constructor(
        readonly code: string,
        message: string
    ) {
        super(message);
    }
}

export interface WarehouseProps {
    code: string;
    name: string;
    address: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}


/** Satu gudang aturan bisnisnya. Kelas ini tidak tahu apa pun tentang HTTP maqupun database. */
export class Warehouse {
    private constructor(
        readonly id: string,
        readonly version: number,
        private props: WarehouseProps,
    ) {}

    /** Mmebuat gudang baru. Gudang baru selalu aktif dan berversi 1. */
    static create(params: { code: string, name: string, address?: string | null | undefined }): Warehouse {
         if(params.code.trim().length === 0) {
            throw new WarehouseRuleError('WAREHOUSE_INVALID_CODE', 'Kode gudang tidak boleh kosong.');
         }
         if(params.name.trim().length === 0) {
            throw new WarehouseRuleError('WAREHOUSE_INVALID_NAME', 'Nama gudang tidak boleh kosong.');
         }
         const now = new Date();
         return new Warehouse(randomUUID(), 1, {
            code: params.code,
            name: params.name,
            address: params.address ?? null,
            isActive: true,
            createdAt: now,
            updatedAt: now
         })
    }

    /** Membentuk kembali gudang dari data yang sudah tersimpan. Aturan tidak diperiksa lagi. */
    static reconstitute(id: string, version: number, props: WarehouseProps): Warehouse {
        return new Warehouse(id, version, props);
    }

    get code(): string {
        return this.props.code;
    }

    get name(): string {
        return this.props.name;
    }

    get address(): string | null {
        return this.props.name;
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

    /** Kode adalah identitas bisnis dan tidak berubah setlah gudang dibuat. */
    update(params: { name?: string | undefined; address?: string | null | undefined }): void {
        if(params.name !== undefined) {
            if(params.name.trim().length === 0) {
                throw new WarehouseRuleError('WAREHOUSE_INVALID_NAME', 'Nama gudang tidak boleh kosong.');
            }
            this.props.name = params.name;
        }
        if(params.address !== undefined) {
            this.props.address = params.address;
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