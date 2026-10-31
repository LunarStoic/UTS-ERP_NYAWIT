
import express from 'express';

import type { PartnerRepository } from './modules/partner/infrastructure/persistence/partner.repository.js';
import { registerPartnerRoutes } from './modules/partner/interfaces/http/partner-routes.js';
import type { ProductRepository } from './modules/product/infrastructure/persistence/product.repository.js';
import { registerProductRoutes } from './modules/product/interfaces/http/product-routes.js';
import { WarehouseRepository } from './modules/warehouse/infrastructure/persistence/warehouse.repository.js';
import { registerWarehouseRoutes } from './modules/warehouse/interfaces/http/warehouse-routes.js';


export interface AppRepositories {
    warehouses: WarehouseRepository;
    products: ProductRepository;
    partners: PartnerRepository;
}

export function createApp(repositories: AppRepositories) {
    const app = express();
    app.use(express.json());

    registerWarehouseRoutes(app, repositories.warehouses);
    registerProductRoutes(app, repositories.products);
    registerPartnerRoutes(app, repositories.partners);
    return app;
}