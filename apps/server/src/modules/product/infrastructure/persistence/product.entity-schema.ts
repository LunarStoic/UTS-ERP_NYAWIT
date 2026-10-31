import { defineEntity } from '@mikro-orm/mysql';

/** Bentuk khusus penyimpanan untuk tabel `product_products`. `.version()` cocok dengan kolom `version` pada tabel. */
export const ProductEntitySchema = defineEntity({
    name: 'ProductRecord',
    tableName: 'product_products',
    properties: (p) => ({
        id: p.uuid().primary(),
        code: p.string().length(40).unique(),
        name: p.string().length(120),
        unitCode: p.string().length(20).fieldName('unit_code'),
        isActive: p.boolean().fieldName('is_active'),
        version: p.bigint('number').version(),
        createdAt: p.datetime().columnType('datetime(6)').fieldName('created_at'),
        updatedAt: p.datetime().columnType('datetime(6)').fieldName('updated_at'),
    }),
});
