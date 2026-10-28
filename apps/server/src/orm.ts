import { MikroORM } from '@mikro-orm/mysql';

import { WarehouseEntitySchema } from './modules/warehouse/infrastructure/persistence/warehouse.entity-schema.js';

/** Membuka sambungan MikroORM ke database pada alamat yang diberikan. */
export function createOrm(databaseUrl: string): Promise<MikroORM> {
    return MikroORM.init({
        clientUrl: databaseUrl,
        entities: [WarehouseEntitySchema],
        forceUtcTimezone: true,
    });
}