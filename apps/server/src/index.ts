import mysql from 'mysql2/promise';

import { createApp } from './app.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    throw new Error('DATABASE_URL belum diisi. Salin .env.example menjadi .env.');
}

const port = Number(process.env.PORT ?? 4000);
const pool = mysql.createPool({ uri: databaseUrl, timezone: 'Z' });

const app = createApp(pool);

app.listen(port, () => {
    console.log(`server listening on port ${port}`);
});