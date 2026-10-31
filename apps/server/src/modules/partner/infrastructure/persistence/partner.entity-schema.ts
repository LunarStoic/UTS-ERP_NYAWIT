import { defineEntity } from '@mikro-orm/mysql';

/** Bentuk khusus penyimpanan untuk tabel `partner_partners`. `.version()` cocok dengan kolom `version` pada tabel. */
export const PartnerEntitySchema = defineEntity({
    name: 'PartnerRecord',
    tableName: 'partner_partners',
    properties: (p) => ({
        id: p.uuid().primary(),
        code: p.string().length(40).unique(),
        name: p.string().length(160),
        phone: p.string().length(50).nullable(),
        address: p.text().nullable(),
        isActive: p.boolean().fieldName('is_active'),
        version: p.bigint('number').version(),
        createdAt: p.datetime().columnType('datetime(6)').fieldName('created_at'),
        updatedAt: p.datetime().columnType('datetime(6)').fieldName('updated_at'),
    }),
});


/**
* Bentuk khusus penyimpanan untuk tabel `partner_partner_roles`. Kunci utamanya gabungan
* `(partner_id, role_code)` dan tidak punya kolom `version`: peran selalu dimuat dan disimpan bersama
* mitranya. `partner_id` hanyalah kolom biasa, bukan relasi di ORM.
*/
export const PartnerRoleEntitySchema = defineEntity({
    name: 'PartnerRoleRecord',
    tableName: 'partner_partner_roles',
    properties: (p) => ({
        partnerId: p.uuid().primary().fieldName('partner_id'),
        roleCode: p.string().length(30).primary().fieldName('role_code'),
        isActive: p.boolean().fieldName('is_active'),
        createdAt: p.datetime().columnType('datetime(6)').fieldName('created_at'),
    }),
});
