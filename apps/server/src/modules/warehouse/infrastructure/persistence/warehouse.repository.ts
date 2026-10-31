import type { MikroORM } from '@mikro-orm/mysql';

import { Warehouse } from '../../domain/warehouse/warehouse.js';
import { WarehouseEntitySchema } from './warehouse.entity-schema.js';

interface WarehouseRecordLike {
    id: string;
    code: string;
    name: string;
    address: string | null | undefined;
    isActive: boolean;
    version: number;
    createdAt: Date;
    updatedAt: Date;
}

/** Mengubah satu baris tabel menjadi objek `Warehouse`. */
function toDomain(record: WarehouseRecordLike): Warehouse {
    return Warehouse.reconstitute(record.id, record.version, {
        code: record.code,
        name: record.name,
        address: record.address ?? null,
        isActive: record.isActive,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
    });
}

/** Satu-satunya tempat yang tahu cara menyimpan dan membaca gudang dari MySQL. */
export class WarehouseRepository {
    constructor(private readonly orm: MikroORM) {}

    /** Menyimpan gudang baru. */
    async add(warehouse: Warehouse): Promise<void> {
        const em = this.orm.em.fork();
        em.persist(
            em.create(WarehouseEntitySchema, {
                id: warehouse.id,
                code: warehouse.code,
                name: warehouse.name,
                address: warehouse.address,
                isActive: warehouse.isActive,
                version: warehouse.version,
                createdAt: warehouse.createdAt,
                updatedAt: warehouse.updatedAt,
            }),
        );
        await em.flush();
    }

    /** Menyimpan perubahan gudang yang sudah ada dan mengembalikan gudang dengan versi yang tersimpan. */
    async save(warehouse: Warehouse): Promise<Warehouse> {
        const em = this.orm.em.fork();
        const record = await em.findOneOrFail(WarehouseEntitySchema, { id: warehouse.id });
        record.name = warehouse.name;
        record.address = warehouse.address;
        record.isActive = warehouse.isActive;
        record.updatedAt = warehouse.updatedAt;
        await em.flush();
        return toDomain(record);
    }

    async findById(id: string): Promise<Warehouse | null> {
        const record = await this.orm.em.fork().findOne(WarehouseEntitySchema, { id });
        return record ? toDomain(record) : null;
    }

    async findByCode(code: string): Promise<Warehouse | null> {
        const record = await this.orm.em.fork().findOne(WarehouseEntitySchema, { code });
        return record ? toDomain(record) : null;
    }

    async findAll(): Promise<Warehouse[]> {
        const records = await this.orm.em.fork().find(WarehouseEntitySchema, {}, { orderBy: { code: 'asc' } });
        return records.map(toDomain);
    }
}

