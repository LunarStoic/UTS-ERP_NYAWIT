import { defineEntity } from '@mikro-orm/mysql';
/** Bentuk khusus penyimpanan untuk tabel `warehouse_warehouses`. `.version()` cocok dengan kolom `version` pada tabel. */
export const WarehouseEntitySchema = defineEntity({
    name: 'WarehouseRecord',
    tableName: 'warehouse_warehouses',
    properties: (p) => ({
    id: p.uuid().primary(),
    code: p.string().length(40).unique(),
    name: p.string().length(120),
    address: p.text().nullable(),
    isActive: p.boolean().fieldName('is_active'),
    version: p.bigint('number').version(),
    createdAt: p.datetime().columnType('datetime(6)').fieldName('created_at'),
    updatedAt: p.datetime().columnType('datetime(6)').fieldName('updated_at'),
    }),
});
