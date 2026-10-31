
import express from 'express';

import type { ProductRepository } from './modules/product/infrastructure/persistence/product.repository.js';
import { registerProductRoutes } from './modules/product/interfaces/http/product-routes.js';
import { WarehouseRepository } from './modules/warehouse/infrastructure/persistence/warehouse.repository.js';
import { registerWarehouseRoutes } from './modules/warehouse/interfaces/http/warehouse-routes.js';


export interface AppRepositories {
    warehouses: WarehouseRepository;
    products: ProductRepository;
}

export function createApp(repositories: AppRepositories) {
    const app = express();
    app.use(express.json());

    registerWarehouseRoutes(app, repositories.warehouses);
    registerProductRoutes(app, repositories.products);
    return app;
}