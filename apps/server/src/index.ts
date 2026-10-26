import { randomUUID } from 'node:crypto';
import express from 'express';
import mysql, { type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    throw new Error('DATABASE_URL belum diisi. Salin .env.example menjadi .env.');
}

const port = Number(process.env.PORT ?? 4000);
const pool = mysql.createPool({ uri: databaseUrl, timezone: 'Z' });

const app = express();
app.use(express.json());



interface WarehouseRow extends RowDataPacket {
    id: string;
    code: string;
    name: string;
    address: string | null;
    is_active: number;
    version: number;
    created_at: Date;
    updated_at: Date;
}

function toWarehouse(row: WarehouseRow) {
    return {
        id: row.id,
        code: row.code,
        name: row.name,
        address: row.address,
        isActive: row.is_active === 1,
        version: Number(row.version),
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
    };
}

function errorBody(code: string, message: string) {
    return { error: { code, message, details: {} } };
}



app.post('/api/v1/warehouses', async (req, res) => {
    const { code, name, address } = req.body as { code?: unknown; name?: unknown; address?: unknown };
    if (typeof code !== 'string' || typeof name !== 'string') {
        res.status(400).json(errorBody('MALFORMED_REQUEST', 'Kode dan nama wajib diisi.'));
        return;
    }
    if (code.trim().length === 0) {
        res.status(422).json(errorBody('WAREHOUSE_INVALID_CODE', 'Kode gudang tidak boleh kosong.'));
        return;
    }
    if (name.trim().length === 0) {
        res.status(422).json(errorBody('WAREHOUSE_INVALID_NAME', 'Nama gudang tidak boleh kosong.'));
        return;
    }

    const id = randomUUID();
    const now = new Date();
    try {
        await pool.execute<ResultSetHeader>(
            `INSERT INTO warehouse_warehouses (id, code, name, address, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [id, code, name, typeof address === 'string' ? address : null, now, now],
        );
    } catch (error) {
        if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
            res.status(409).json(errorBody('DUPLICATE_WAREHOUSE_CODE', 'Gudang dengan kode ini sudah ada.'));
            return;
        }
        throw error;
    }

    const [rows] = await pool.execute<WarehouseRow[]>('SELECT * FROM warehouse_warehouses WHERE id = ?', [id]);
    res.status(201).json({ data: toWarehouse(rows[0]!), meta: {} });
});


app.get('/api/v1/warehouses', async (_req, res) => {
    const [rows] = await pool.execute<WarehouseRow[]>('SELECT * FROM warehouse_warehouses ORDER BY code');
    res.status(200).json({ data: rows.map(toWarehouse), meta: {} });
});


app.get('/api/v1/warehouses/:id', async (req, res) => {
    const [rows] = await pool.execute<WarehouseRow[]>('SELECT * FROM warehouse_warehouses WHERE id = ?', [req.params.id,]);
    const row = rows[0];
    if (!row) {
        res.status(404).json(errorBody('NOT_FOUND', 'Gudang tidak ditemukan.'));
        return;
    }
    res.status(200).json({ data: toWarehouse(row), meta: {} });
});


app.listen(port, () => {
    console.log(`server listening on port ${port}`);
});