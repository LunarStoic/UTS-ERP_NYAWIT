import type { Express, Response } from 'express';

import { Product, ProductRuleError } from '../../domain/product/product.js';
import type { ProductRepository } from '../../infrastructure/persistence/product.repository.js';

function toJson(product: Product) {
    return {
        id: product.id,
        code: product.code,
        name: product.name,
        unitCode: product.unitCode,
        isActive: product.isActive,
        version: product.version,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
    };
}

function errorBody(code: string, message: string) {
    return { error: { code, message, details: {} } };
}

/** Mengubah pelanggaran aturan bisnis menjadi jawaban 422; galat lain dilempar lagi. */
function sendRuleError(res: Response, error: unknown): void {
    if (error instanceof ProductRuleError) {
        res.status(422).json(errorBody(error.code, error.message));
        return;
    }
    throw error;
}


export function registerProductRoutes(app: Express, products: ProductRepository): void {
    app.post('/api/v1/products', async (req, res) => {
        const { code, name, unitCode } = req.body as { code?: unknown; name?: unknown; unitCode?: unknown };
        if (typeof code !== 'string' || typeof name !== 'string') {
            res.status(400).json(errorBody('MALFORMED_REQUEST', 'Kode dan nama wajib diisi.'));
            return;
        }
        if (unitCode !== undefined && typeof unitCode !== 'string') {
            res.status(400).json(errorBody('MALFORMED_REQUEST', 'Kode satuan harus berupa teks bila diisi.'));
            return;
        }
        let product: Product;
        try {
            product = Product.create({ code, name, unitCode });
        } catch (error) {
            sendRuleError(res, error);
            return;
        }
        if (await products.findByCode(product.code)) {
            res.status(409).json(errorBody('DUPLICATE_PRODUCT_CODE', 'Produk dengan kode ini sudah ada.'));
            return;
        }
        await products.add(product);
        res.status(201).json({ data: toJson(product), meta: {} });
    });

    app.get('/api/v1/products', async (_req, res) => {
        const all = await products.findAll();
        res.status(200).json({ data: all.map(toJson), meta: {} });
    });

    app.get('/api/v1/products/:id', async (req, res) => {
        const product = await products.findById(req.params.id);
        if (!product) {
            res.status(404).json(errorBody('NOT_FOUND', 'Produk tidak ditemukan.'));
            return;
        }
        res.status(200).json({ data: toJson(product), meta: {} });
    });

    app.patch('/api/v1/products/:id', async (req, res) => {
        const { name, unitCode } = req.body as { name?: unknown; unitCode?: unknown };
        if (name !== undefined && typeof name !== 'string') {
            res.status(400).json(errorBody('MALFORMED_REQUEST', 'Nama harus berupa teks bila diisi.'));
            return;
        }
        if (unitCode !== undefined && typeof unitCode !== 'string') {
            res.status(400).json(errorBody('MALFORMED_REQUEST', 'Kode satuan harus berupa teks bila diisi.'));
            return;
        }
        const product = await products.findById(req.params.id);
        if (!product) {
            res.status(404).json(errorBody('NOT_FOUND', 'Produk tidak ditemukan.'));
            return;
        }
        try {
            product.update({ name, unitCode });
        } catch (error) {
            sendRuleError(res, error);
            return;
        }
        const saved = await products.save(product);
        res.status(200).json({ data: toJson(saved), meta: {} });
    });

    app.post('/api/v1/products/:id/activate', async (req, res) => {
        const product = await products.findById(req.params.id);
        if (!product) {
            res.status(404).json(errorBody('NOT_FOUND', 'Produk tidak ditemukan.'));
            return;
        }
        product.activate();
        const saved = await products.save(product);
        res.status(200).json({ data: toJson(saved), meta: {} });
    });

    app.post('/api/v1/products/:id/deactivate', async (req, res) => {
        const product = await products.findById(req.params.id);
        if (!product) {
            res.status(404).json(errorBody('NOT_FOUND', 'Produk tidak ditemukan.'));
            return;
        }
        product.deactivate();
        const saved = await products.save(product);
        res.status(200).json({ data: toJson(saved), meta: {} });
    });
}
