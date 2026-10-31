import { MikroORM } from '@mikro-orm/mysql';

import { PartnerEntitySchema, PartnerRoleEntitySchema } from './modules/partner/infrastructure/persistence/partner.entity-schema.js';
import { WarehouseEntitySchema } from './modules/warehouse/infrastructure/persistence/warehouse.entity-schema.js';
import { ProductEntitySchema } from './modules/product/infrastructure/persistence/product.entity-schema.js';

/** Membuka sambungan MikroORM ke database pada alamat yang diberikan. */
export function createOrm(databaseUrl: string): Promise<MikroORM> {
    return MikroORM.init({
        clientUrl: databaseUrl,
        entities: [WarehouseEntitySchema, ProductEntitySchema, PartnerEntitySchema, PartnerRoleEntitySchema],
        forceUtcTimezone: true,
    });
}