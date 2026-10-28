import { createApp } from './app.js';
import { createOrm } from './orm.js';
import { WarehouseRepository } from './modules/warehouse/infrastructure/persistence/WarehouseRepository.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    throw new Error('DATABASE_URL belum diisi. Salin .env.example menjadi .env.');
}

const port = Number(process.env.PORT ?? 4000);

const orm = await createOrm(databaseUrl);
const app = createApp(new WarehouseRepository(orm));

app.listen(port, () => {
    console.log(`server listening on port ${port}`);
});