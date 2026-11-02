import { createApp } from './app.js';
import { createOrm } from './orm.js';

import { PartnerRepository } from './modules/partner/infrastructure/persistence/partner.repository.js';
import { WarehouseRepository } from './modules/warehouse/infrastructure/persistence/warehouse.repository.js';
import { ProductRepository } from './modules/product/infrastructure/persistence/product.repository.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    throw new Error('DATABASE_URL belum diisi. Salin .env.example menjadi .env.');
}

const port = Number(process.env.PORT ?? 4000);

const orm = await createOrm(databaseUrl);
const app = createApp({
    warehouses: new WarehouseRepository(orm),
    products: new ProductRepository(orm),
    partners: new PartnerRepository(orm), 
}, orm);

app.listen(port, () => {
    console.log(`server listening on port ${port}`);
});