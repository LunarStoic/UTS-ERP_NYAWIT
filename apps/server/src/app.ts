
import express from 'express';

import { Warehouse, WarehouseRuleError } from './modules/warehouse/domain/warehouse/warehouse.js'; 
import type { WarehouseRepository } from './modules/warehouse/infrastructure/persistence/WarehouseRepository.js';


function toWarehouse(warehouse: Warehouse) {
    return {
        id: warehouse.id,
        code: warehouse.code,
        name: warehouse.name,
        address: warehouse.address,
        isActive: warehouse.isActive,
        version: warehouse.version,
        createdAt: warehouse.createdAt.toISOString(),
        updatedAt: warehouse.updatedAt.toISOString(),
    };
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


export function createApp(warehouses: WarehouseRepository) {
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

        if (await warehouses.findByCode(warehouse.code)) {
            res.status(409).json(errorBody('DUPLICATE_WAREHOUSE_CODE', 'Gudang dengan kode ini sudah ada.'));
            return;
        }

        await warehouses.add(warehouse);
        res.status(201).json({ data: toWarehouse(warehouse), meta: {} });
    });


    // ambil semua gudang
    app.get('/api/v1/warehouses', async (_req, res) => {
        const all = await warehouses.findAll();
        res.status(200).json({ data: all.map(toWarehouse), meta: {} });
    });

    // ambil 1 gudang dari id 
    app.get('/api/v1/warehouses/:id', async (req, res) => {
        const warehouse = await warehouses.findById(req.params.id);
        if (!warehouse) {
            res.status(404).json(errorBody('NOT_FOUND', 'Gudang tidak ditemukan.'));
            return;
        }
        res.status(200).json({ data: toWarehouse(warehouse), meta: {} });
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

        const warehouse = await warehouses.findById(req.params.id);
        if(!warehouse) {
            res.status(422).json(errorBody('NOT_FOUND', 'Gudang tidak ditemukan'));
            return;
        }
    
        try {
            warehouse.update({ name, address });
        } catch (error) {
            sendRuleError(res, error);
            return;
        }

        const saved = await warehouses.save(warehouse);
        res.status(200).json({ data:toWarehouse(saved), meta: {} });
    });

    //aktifkan gudang 
    app.post('/api/v1/warehouses/:id/activate', async (req, res) => {
        const warehouse = await warehouses.findById(req.params.id);
        if(!warehouse) {
            res.status(422).json(errorBody('NOT_FOUND', 'Gudang tidak ditemukan.'));
            return;
        }

        warehouse.activate();

        const saved = await warehouses.save(warehouse);
        res.status(200).json({ data: toWarehouse(saved), meta: {} });
    })

    // nonaktifkan gudang
    app.post('/api/v1/warehouses/:id/deactivate', async (req, res) => {
        const warehouse = await warehouses.findById(req.params.id);
        if(!warehouse) {
            res.status(422).json(errorBody('NOT_FOUND', 'Gudang tidak ditemukan.'));
            return;
        }

        warehouse.activate();
        const saved = await warehouses.save(warehouse);
        res.status(200).json({ data: toWarehouse(saved), meta: {} });      
    });

    return app;
}