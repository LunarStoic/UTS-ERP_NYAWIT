import type { MikroORM } from '@mikro-orm/mysql';

import { Product } from '../../domain/product/product.js';
import { ProductEntitySchema } from './product.entity-schema.js';

interface ProductRecordLike {
    id: string;
    code: string;
    name: string;
    unitCode: string;
    isActive: boolean;
    version: number;
    createdAt: Date;
    updatedAt: Date;
}


/** Mengubah satu baris tabel menjadi objek `Product`. */
function toDomain(record: ProductRecordLike): Product {
    return Product.reconstitute(record.id, record.version, {
        code: record.code,
        name: record.name,
        unitCode: record.unitCode,
        isActive: record.isActive,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
    });
}

/** Satu-satunya tempat yang tahu cara menyimpan dan membaca produk dari MySQL. */
export class ProductRepository {
    constructor(private readonly orm: MikroORM) { }

    /** Menyimpan produk baru. */
    async add(product: Product): Promise<void> {
        const em = this.orm.em.fork();
        em.persist(
            em.create(ProductEntitySchema, {
                id: product.id,
                code: product.code,
                name: product.name,
                unitCode: product.unitCode,
                isActive: product.isActive,
                version: product.version,
                createdAt: product.createdAt,
                updatedAt: product.updatedAt,
            }),
        );
        await em.flush();
    }

    /** Menyimpan perubahan produk yang sudah ada dan mengembalikan produk dengan versi yang tersimpan. */
    async save(product: Product): Promise<Product> {
        const em = this.orm.em.fork();
        const record = await em.findOneOrFail(ProductEntitySchema, { id: product.id });
        record.name = product.name;
        record.unitCode = product.unitCode;
        record.isActive = product.isActive;
        record.updatedAt = product.updatedAt;
        await em.flush();
        return toDomain(record);
    }

    async findById(id: string): Promise<Product | null> {
        const record = await this.orm.em.fork().findOne(ProductEntitySchema, { id });
        return record ? toDomain(record) : null;
    }

    async findByCode(code: string): Promise<Product | null> {
        const record = await this.orm.em.fork().findOne(ProductEntitySchema, { code });
        return record ? toDomain(record) : null;
    }
    
    async findAll(): Promise<Product[]> {
        const records = await this.orm.em.fork().find(ProductEntitySchema, {}, { orderBy: { code: 'asc' } });
        return records.map(toDomain);
    }
}