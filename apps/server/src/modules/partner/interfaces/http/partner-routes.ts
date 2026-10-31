import type { Express, Response } from 'express';

import { Partner, PartnerRuleError } from '../../domain/partner/partner.js';
import type { PartnerRepository } from '../../infrastructure/persistence/partner.repository.js';


function toJson(partner: Partner) {
    return {
        id: partner.id,
        code: partner.code,
        name: partner.name,
        phone: partner.phone,
        address: partner.address,
        isActive: partner.isActive,
        roles: partner.roles.map((role) => ({
            roleCode: role.roleCode,
            isActive: role.isActive,
            createdAt: role.createdAt.toISOString(),
        })),
        version: partner.version,
        createdAt: partner.createdAt.toISOString(),
        updatedAt: partner.updatedAt.toISOString(),
    };
}


function errorBody(code: string, message: string) {
    return { error: { code, message, details: {} } };
}

/** Mengubah pelanggaran aturan bisnis menjadi jawaban 422; galat lain dilempar lagi. */
function sendRuleError(res: Response, error: unknown): void {
    if (error instanceof PartnerRuleError) {
        res.status(422).json(errorBody(error.code, error.message));
        return;
    }
    throw error;
}

function isNullableString(value: unknown): value is string | null | undefined {
    return value === undefined || value === null || typeof value === 'string';
}

function isStringList(value: unknown): value is string[] | undefined {
    return value === undefined || (Array.isArray(value) && value.every((item) => typeof item === 'string'));
}

export function registerPartnerRoutes(app: Express, partners: PartnerRepository): void {
    app.post('/api/v1/partners', async (req, res) => {
        const { code, name, phone, address, roles } = req.body as {
            code?: unknown;
            name?: unknown;
            phone?: unknown;
            address?: unknown;
            roles?: unknown;
        };
        if (typeof code !== 'string' || typeof name !== 'string') {
            res.status(400).json(errorBody('MALFORMED_REQUEST', 'Kode dan nama wajib diisi.'));
            return;
        }
        if (!isNullableString(phone) || !isNullableString(address)) {
            res.status(400).json(errorBody('MALFORMED_REQUEST', 'Telepon dan alamat harus berupa teks atau dikosongkan.'));
            return;
        }
        if (!isStringList(roles)) {
            res.status(400).json(errorBody('MALFORMED_REQUEST', 'Peran harus berupa kumpulan teks bila diisi.'));
            return;
        }
        let partner: Partner;
        try {
            partner = Partner.create({ code, name, phone, address, roles });
        } catch (error) {
            sendRuleError(res, error);
            return;
        }
        if (await partners.findByCode(partner.code)) {
            res.status(409).json(errorBody('DUPLICATE_PARTNER_CODE', 'Mitra dengan kode ini sudah ada.'));
            return;
        }
        await partners.add(partner);
        res.status(201).json({ data: toJson(partner), meta: {} });
    });

    app.get('/api/v1/partners', async (_req, res) => {
        const all = await partners.findAll();
        res.status(200).json({ data: all.map(toJson), meta: {} });
    });

    app.get('/api/v1/partners/:id', async (req, res) => {
        const partner = await partners.findById(req.params.id);
        if (!partner) {
            res.status(404).json(errorBody('NOT_FOUND', 'Mitra tidak ditemukan.'));
            return;
        }
        res.status(200).json({ data: toJson(partner), meta: {} });
    });

    app.patch('/api/v1/partners/:id', async (req, res) => {
        const { name, phone, address } = req.body as { name?: unknown; phone?: unknown; address?: unknown };
        if (name !== undefined && typeof name !== 'string') {
            res.status(400).json(errorBody('MALFORMED_REQUEST', 'Nama harus berupa teks bila diisi.'));
            return;
        }
        if (!isNullableString(phone) || !isNullableString(address)) {
            res.status(400).json(errorBody('MALFORMED_REQUEST', 'Telepon dan alamat harus berupa teks atau dikosongkan.'));
            return;
        }
        const partner = await partners.findById(req.params.id);
        if (!partner) {
            res.status(404).json(errorBody('NOT_FOUND', 'Mitra tidak ditemukan.'));
            return;
        }
        try {
            partner.update({ name, phone, address });
        } catch (error) {
            sendRuleError(res, error);
            return;
        }
        const saved = await partners.save(partner);
        res.status(200).json({ data: toJson(saved), meta: {} });
    });

    app.post('/api/v1/partners/:id/activate', async (req, res) => {
        const partner = await partners.findById(req.params.id);
        if (!partner) {
            res.status(404).json(errorBody('NOT_FOUND', 'Mitra tidak ditemukan.'));
            return;
        }
        partner.activate();
        const saved = await partners.save(partner);
        res.status(200).json({ data: toJson(saved), meta: {} });
    });

    app.post('/api/v1/partners/:id/deactivate', async (req, res) => {
        const partner = await partners.findById(req.params.id);
        if (!partner) {
            res.status(404).json(errorBody('NOT_FOUND', 'Mitra tidak ditemukan.'));
            return;
        }
        partner.deactivate();
        const saved = await partners.save(partner);
        res.status(200).json({ data: toJson(saved), meta: {} });
    });

    app.post('/api/v1/partners/:id/roles/:roleCode', async (req, res) => {
        const partner = await partners.findById(req.params.id);
        if (!partner) {
            res.status(404).json(errorBody('NOT_FOUND', 'Mitra tidak ditemukan.'));
            return;
        }
        try {
            partner.addRole(req.params.roleCode);
        } catch (error) {
            sendRuleError(res, error);
            return;
        }
        const saved = await partners.save(partner);
        res.status(200).json({ data: toJson(saved), meta: {} });
    });
    
    app.delete('/api/v1/partners/:id/roles/:roleCode', async (req, res) => {
        const partner = await partners.findById(req.params.id);
        if (!partner) {
            res.status(404).json(errorBody('NOT_FOUND', 'Mitra tidak ditemukan.'));
            return;
        }
        try {
            partner.deactivateRole(req.params.roleCode);
        } catch (error) {
            sendRuleError(res, error);
            return;
        }
        const saved = await partners.save(partner);
        res.status(200).json({ data: toJson(saved), meta: {} });
    });
}
