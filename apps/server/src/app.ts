
import express from 'express';
import {type Pool, type RowDataPacket } from 'mysql2/promise';

import { Warehouse, WarehouseRuleError } from './modules/warehouse/domain/warehouse/warehouse.js'; 

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

/** Membentuk kembali objek domain dari satu baris tabel */
function toDomain(row: WarehouseRow): Warehouse {
    return Warehouse.reconstitute(row.id, Number(row.version), {
        code: row.code,
        name: row.name,
        address: row.address,
        isActive: row.is_active === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    });
}

function errorBody(code: string, message: string) {
    return { error: { code, message, details: {} } };
}

/** Mengubah pelanggaran aturan bisnis menjadi jawaban 422; error lain dilempar lagi */
function sendRuleError(res: express.Response, error: unknown): void {
    if(error instanceof WarehouseRuleError) {
        res.status(422).json(errorBody(error.code, error.message));
    }
    throw error;
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
        
        let warehouse:  Warehouse;
        try {
            warehouse = Warehouse.create({ code, name, address: typeof address === 'string' ? address : null });
        } catch (error) {
            sendRuleError(res, error);
            return;
        }

        try {
            await pool.execute(
                `INSERT INTO warehouse_warehouses (id, code, name, address, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)`,
                [warehouse.id, warehouse.code, warehouse.name, warehouse.address, warehouse.createdAt, warehouse.updatedAt],
            );
        } catch (error) {
            if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
                res.status(409).json(errorBody('DUPLICATE_WAREHOUSE_CODE', 'Gudang dengan kode ini sudah ada.'));
                return;
            }
            throw error;
        }

        const created = await findWarehouseById(pool, warehouse.id);
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
        
        const warehouse = toDomain(row);
        try {
            warehouse.update({ name, address });
        } catch (error) {
            sendRuleError(res, error);
            return;
        }

        await pool.execute(
            'UPDATE warehouse_warehouses SET name = ?, address = ?, version = version + 1, updated_at = ? WHERE id = ?',
            [warehouse.name, warehouse.address, warehouse.updatedAt, warehouse.id]
        )
        const updated = await findWarehouseById(pool, warehouse.id);
        res.status(200).json({ data:toWarehouse(updated!), meta: {} });
    });

    //aktifkan gudang 
    app.post('/api/v1/warehouses/:id/activate', async (req, res) => {
        const row = await findWarehouseById(pool, req.params.id);
        if(!row) {
            res.status(422).json(errorBody('NOT_FOUND', 'Gudang tidak ditemukan.'));
            return;
        }

        const warehouse = toDomain(row);
        warehouse.activate();
        if(warehouse.isActive !== (row.is_active === 1)) {
            await pool.execute(
                'UPDATE warehouse_warehouses SET is_active = ?, version = version + 1, updated_at = ? WHERE id = ?',
                [warehouse.isActive, warehouse.updatedAt, warehouse.id]
            );
        }
        const updated = await findWarehouseById(pool, warehouse.id);
        res.status(200).json({ data: toWarehouse(updated!), meta: {} });
    })

    // nonaktifkan gudang
    app.post('/api/v1/warehouses/:id/deactivate', async (req, res) => {
        const row = await findWarehouseById(pool, req.params.id);
        if(!row) {
            res.status(422).json(errorBody('NOT_FOUND', 'Gudang tidak ditemukan.'));
            return;
        }

        const warehouse = toDomain(row);
        warehouse.activate();
        if(warehouse.isActive !== (row.is_active === 1)) {
            await pool.execute(
                'UPDATE warehouse_warehouses SET is_active = ?, version = version + 1, updated_at = ? WHERE id = ?',
                [warehouse.isActive, warehouse.updatedAt, warehouse.id]
            );
        }
        const updated = await findWarehouseById(pool, warehouse.id);
        res.status(200).json({ data: toWarehouse(updated!), meta: {} });      
    });

    return app;
}