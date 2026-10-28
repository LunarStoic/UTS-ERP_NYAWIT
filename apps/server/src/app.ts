import { randomUUID } from 'node:crypto';

import express from 'express';
import {type Pool, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';

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

//cari gudnag berdasarkan id
async function findWarehouseById(pool: Pool, id: string): Promise<WarehouseRow | undefined> {
    const [rows] = await pool.execute<WarehouseRow[]>('SELECT * FROM warehouse_warehouses WHERE id = ?', [id])
    return rows[0];
}


export function createApp(pool: Pool) {
    const app = express();
    app.use(express.json());

    // buat gudang
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

        const created = await findWarehouseById(pool, id);
        res.status(201).json({ data: toWarehouse(created!), meta: {} });
    });


    // ambil semua gudang
    app.get('/api/v1/warehouses', async (_req, res) => {
        const [rows] = await pool.execute<WarehouseRow[]>('SELECT * FROM warehouse_warehouses ORDER BY code');
        res.status(200).json({ data: rows.map(toWarehouse), meta: {} });
    });


    // ambil 1 gudang dari id 
    app.get('/api/v1/warehouses/:id', async (req, res) => {
        const row = await findWarehouseById(pool, req.params.id);
        if (!row) {
            res.status(404).json(errorBody('NOT_FOUND', 'Gudang tidak ditemukan.'));
            return;
        }
        res.status(200).json({ data: toWarehouse(row), meta: {} });
    });

    // ubah gudang berdasarkan id 
    app.patch('/api/v1/warehouses/:id', async (req, res) => {
        const { name, address } = req.body as { name?: unknown; address?: unknown }
        if(name !== undefined && typeof name !== 'string') {
            res.status(400).json(errorBody('MALFORMED_REQUEST', 'Nama harus berupa teks bila diisi.'));
            return;
        }
        if(address !== undefined && address !== null && typeof address !== 'string') {
            res.status(400).json(errorBody('MALFORMED_REQUEST', 'Alamat harus berupa teks atau dikosongkan.'));
            return;
        }

        const row = await findWarehouseById(pool, req.params.id);
        if(!row) {
            res.status(422).json(errorBody('NOT_FOUND', 'Gudang tidak ditemukan'));
            return;
        }
        if(name !== undefined && name.trim().length === 0) {
            res.status(422).json(errorBody('WAREHOUSE_INVALID_NAME', 'Nama gudang tidak boleh kosong.'));
            return;
        }

        await pool.execute(
            'UPDATE warehouse_warehouses SET name = ?, address = ?, version = version + 1, updated_at = ? WHERE id = ?',
            [name ?? row.name, address === undefined ? row.address : address, new Date(), row.id]
        )
        const updated = await findWarehouseById(pool, row.id);
        res.status(200).json({ data:toWarehouse(updated!), meta: {} });
    });

    //aktifkan gudang 
    app.post('/api/v1/warehouses/:id/activate', async (req, res) => {
        const row = await findWarehouseById(pool, req.params.id);
        if(!row) {
            res.status(422).json(errorBody('NOT_FOUND', 'Gudang tidak ditemukan.'));
            return;
        }
        if(row.is_active !== 1) {
            await pool.execute(
                'UPDATE warehouse_warehouses SET is_active = TRUE, version = version + 1, updated_at = ? WHERE id = ?',
                [new Date(), row.id]
            );
        }
        const updated = await findWarehouseById(pool, row.id);
        res.status(200).json({ data: toWarehouse(updated!), meta: {} });
    })

    // nonaktifkan gudang
    app.post('/api/v1/warehouses/:id/deactivate', async (req, res) => {
        const row = await findWarehouseById(pool, req.params.id);
        if(!row) {
            res.status(422).json(errorBody('NOT_FOUND', 'Gudang tidak ditemukan.'));
            return;
        }
        if(row.is_active === 1) {
            await pool.execute(
                'UPDATE warehouse_warehouses SET is_active = FALSE, version = version + 1, updated_at = ? WHERE id = ?',
                [new Date(), row.id]
            );
        }
        const updated = await findWarehouseById(pool, row.id);
        res.status(200).json({ data: toWarehouse(updated!), meta: {} });        
    });

    return app;
}