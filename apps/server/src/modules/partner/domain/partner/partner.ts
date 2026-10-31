import { randomUUID } from 'node:crypto';

import { isPartnerRoleCode, type PartnerRoleCode } from './partner-role-code.js';

/** Pelanggaran aturan bisnis mitra. `code` dikirim ke klien sebagai kode galat. */
export class PartnerRuleError extends Error {
    constructor(
        readonly code: string,
        message: string,
    ) {
        super(message);
    }
}

function invalidRoleCode(value: string): PartnerRuleError {
    return new PartnerRuleError(
        'PARTNER_INVALID_ROLE_CODE',
        `"${value}" bukan peran mitra yang valid (SUPPLIER, CUSTOMER, BORROWER, LENDER, OTHER).`,
    );
}

export interface PartnerRoleAssignment {
    roleCode: PartnerRoleCode;
    isActive: boolean;
    createdAt: Date;
}

export interface PartnerProps {
    code: string;
    name: string;
    phone: string | null;
    address: string | null;
    isActive: boolean;
    roles: PartnerRoleAssignment[];
    createdAt: Date;
    updatedAt: Date;
}


/**
* Satu mitra (pemasok, pelanggan, dan peminjam) beserta peran-perannya. Peran adalah bagian dari
* mitra itu sendiri, jadi selalu dimuat dan disimpan bersama mitranya. Kelas ini tidak tahu apa pun
* tentang HTTP maupun database.
*/
export class Partner {
    private constructor(
        readonly id: string,
        readonly version: number,
        private props: PartnerProps,
    ) { }

    /** Membuat mitra baru. Mitra baru selalu aktif dan berversi 1; peran yang kembar hanya dihitung sekali. */
    static create(params: {
        code: string;
        name: string;
        phone?: string | null | undefined;
        address?: string | null | undefined;
        roles?: readonly string[] | undefined;
    }): Partner {
        if (params.code.trim().length === 0) {
            throw new PartnerRuleError('PARTNER_INVALID_CODE', 'Kode mitra tidak boleh kosong.');
        }
        if (params.name.trim().length === 0) {
            throw new PartnerRuleError('PARTNER_INVALID_NAME', 'Nama mitra tidak boleh kosong.');
        }
        const now = new Date();
        const roles: PartnerRoleAssignment[] = [];
        for (const roleCode of params.roles ?? []) {
            if (!isPartnerRoleCode(roleCode)) {
                throw invalidRoleCode(roleCode);
            }
            if (roles.some((role) => role.roleCode === roleCode)) continue;
            roles.push({ roleCode, isActive: true, createdAt: now });
        }

        return new Partner(randomUUID(), 1, {
            code: params.code,
            name: params.name,
            phone: params.phone ?? null,
            address: params.address ?? null,
            isActive: true,
            roles,
            createdAt: now,
            updatedAt: now,
        });
    }

    /** Membentuk kembali mitra dari data yang sudah tersimpan. Aturan tidak diperiksa lagi. */
    static reconstitute(id: string, version: number, props: PartnerProps): Partner {
        return new Partner(id, version, props);
    }

    get code(): string {
        return this.props.code;
    }
    get name(): string {
        return this.props.name;
    }
    get phone(): string | null {
        return this.props.phone;
    }
    get address(): string | null {
        return this.props.address;
    }
    get isActive(): boolean {
        return this.props.isActive;
    }
    get roles(): readonly PartnerRoleAssignment[] {
        return this.props.roles;
    }
    get createdAt(): Date {
        return this.props.createdAt;
    }
    get updatedAt(): Date {
        return this.props.updatedAt;
    }

    hasActiveRole(roleCode: PartnerRoleCode): boolean {
        return this.props.roles.some((role) => role.roleCode === roleCode && role.isActive);
    }

    /** Kode adalah identitas bisnis dan tidak berubah setelah mitra dibuat. */
    update(params: {
        name?: string | undefined;
        phone?: string | null | undefined;
        address?: string | null | undefined;
    }): void {
        if (params.name !== undefined) {
            if (params.name.trim().length === 0) {
                throw new PartnerRuleError('PARTNER_INVALID_NAME', 'Nama mitra tidak boleh kosong.');
            }
            this.props.name = params.name;
        }
        if (params.phone !== undefined) {
            this.props.phone = params.phone;
        }
        if (params.address !== undefined) {
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
    /** Menambah peran, atau mengaktifkannya kembali bila sudah ada tetapi nonaktif. Tidak berbuat apa-apa bila sudah aktif. */
    addRole(roleCode: string): void {
        if (!isPartnerRoleCode(roleCode)) {
            throw invalidRoleCode(roleCode);
        }
        const existing = this.props.roles.find((role) => role.roleCode === roleCode);
        if (existing) {
            if (!existing.isActive) {
                existing.isActive = true;
                this.props.updatedAt = new Date();
            }
            return;
        }
        const now = new Date();
        this.props.roles.push({ roleCode, isActive: true, createdAt: now });
        this.props.updatedAt = now;
    }
    /** Menonaktifkan peran (barisnya tetap ada, hanya `isActive` yang berubah). Tidak berbuat apa-apa bila peran tidak ada atau sudah nonaktif. */
    deactivateRole(roleCode: string): void {
        if (!isPartnerRoleCode(roleCode)) {
            throw invalidRoleCode(roleCode);
        }
        const existing = this.props.roles.find((role) => role.roleCode === roleCode);
        if (!existing || !existing.isActive) return;
        existing.isActive = false;
        this.props.updatedAt = new Date();
    }
}
