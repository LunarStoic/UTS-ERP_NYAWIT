import type { MikroORM } from '@mikro-orm/mysql';

import type { PartnerRoleCode } from '../../domain/partner/partner-role-code.js';
import { Partner, type PartnerRoleAssignment } from '../../domain/partner/partner.js';
import { PartnerEntitySchema, PartnerRoleEntitySchema } from './partner.entity-schema.js';

interface PartnerRecordLike {
    id: string;
    code: string;
    name: string;
    phone: string | null | undefined;
    address: string | null | undefined;
    isActive: boolean;
    version: number;
    createdAt: Date;
    updatedAt: Date;
}

interface PartnerRoleRecordLike {
    roleCode: string;
    isActive: boolean;
    createdAt: Date;
}

/** Mengubah satu baris mitra beserta baris-baris perannya menjadi objek `Partner`. */
function toDomain(record: PartnerRecordLike, roleRecords: PartnerRoleRecordLike[]): Partner {
    const roles: PartnerRoleAssignment[] = roleRecords.map((role) => ({
        roleCode: role.roleCode as PartnerRoleCode,
        isActive: role.isActive,
        createdAt: role.createdAt,
    }));

    return Partner.reconstitute(record.id, record.version, {
        code: record.code,
        name: record.name,
        phone: record.phone ?? null,
        address: record.address ?? null,
        isActive: record.isActive,
        roles,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
    });
}

/** Satu-satunya tempat yang tahu cara menyimpan dan membaca mitra (dan perannya) dari MySQL. */
export class PartnerRepository {
    constructor(private readonly orm: MikroORM) { }

    /**
    * Menyimpan baris mitra lebih dulu, baru baris perannya. Kolom `partner_id` pada tabel peran hanyalah
    * kolom biasa (bukan relasi di ORM), sehingga ORM tidak tahu urutannya; kita `flush` di antara keduanya
    * supaya mitra pasti tersimpan sebelum peran yang merujuknya.
    */
    async add(partner: Partner): Promise<void> {
        const em = this.orm.em.fork();
        await em.transactional(async (em) => {
            em.persist(
                em.create(PartnerEntitySchema, {
                    id: partner.id,
                    code: partner.code,
                    name: partner.name,
                    phone: partner.phone,
                    address: partner.address,
                    isActive: partner.isActive,
                    version: partner.version,
                    createdAt: partner.createdAt,
                    updatedAt: partner.updatedAt,
                }),
            );
            await em.flush();

            for (const role of partner.roles) {
                em.persist(
                    em.create(PartnerRoleEntitySchema, {
                        partnerId: partner.id,
                        roleCode: role.roleCode,
                        isActive: role.isActive,
                        createdAt: role.createdAt,
                    }),
                );
            }
            await em.flush();
        });
    }

    /** Menyimpan perubahan mitra dan perannya, lalu mengembalikan mitra dengan versi yang tersimpan. */
    async save(partner: Partner): Promise<Partner> {
        const em = this.orm.em.fork();
        const record = await em.findOneOrFail(PartnerEntitySchema, { id: partner.id });
        record.name = partner.name;
        record.phone = partner.phone;
        record.address = partner.address;
        record.isActive = partner.isActive;
        record.updatedAt = partner.updatedAt;
        for (const role of partner.roles) {
            const roleRecord = await em.findOne(PartnerRoleEntitySchema, { partnerId: partner.id, roleCode: role.roleCode });
            if (roleRecord) {
                roleRecord.isActive = role.isActive;
            } else {
                em.persist(
                    em.create(PartnerRoleEntitySchema, {
                        partnerId: partner.id,
                        roleCode: role.roleCode,
                        isActive: role.isActive,
                        createdAt: role.createdAt,
                    }),
                );
            }
        }
        await em.flush();
        const roleRecords = await em.find(PartnerRoleEntitySchema, { partnerId: partner.id }, { orderBy: { roleCode: 'asc' } });
        return toDomain(record, roleRecords);
    }

    async findById(id: string): Promise<Partner | null> {
        const em = this.orm.em.fork();
        const record = await em.findOne(PartnerEntitySchema, { id });
        if (!record) return null;
        const roleRecords = await em.find(PartnerRoleEntitySchema, { partnerId: id }, { orderBy: { roleCode: 'asc' } });
        return toDomain(record, roleRecords);
    }

    async findByCode(code: string): Promise<Partner | null> {
        const em = this.orm.em.fork();
        const record = await em.findOne(PartnerEntitySchema, { code });
        if (!record) return null;
        const roleRecords = await em.find(PartnerRoleEntitySchema, { partnerId: record.id }, { orderBy: { roleCode: 'asc' } });
        return toDomain(record, roleRecords);
    }

    async findAll(): Promise<Partner[]> {
        const em = this.orm.em.fork();
        const records = await em.find(PartnerEntitySchema, {}, { orderBy: { code: 'asc' } });
        const partners: Partner[] = [];
        for (const record of records) {
            const roleRecords = await em.find(PartnerRoleEntitySchema, { partnerId: record.id }, { orderBy: { roleCode: 'asc' } });
            partners.push(toDomain(record, roleRecords));
        }
        return partners;
    }
}
