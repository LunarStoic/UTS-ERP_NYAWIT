import { Migration } from '@mikro-orm/migrations';
export class Migration20261102130215_CreateShipments extends Migration {
  override name = 'Migration20261102130215_CreateShipments';
  override up(): void {
    this.addSql(`CREATE TABLE sales_shipments (
      id VARCHAR(36) PRIMARY KEY,
      document_number VARCHAR(40) NOT NULL UNIQUE,
      shipment_date DATE NOT NULL,
      warehouse_id VARCHAR(36) NOT NULL,
      product_id VARCHAR(36) NOT NULL,
      customer_id VARCHAR(36),
      loading_quantity_grams BIGINT NOT NULL,
      loading_inventory_cost_rupiah BIGINT NOT NULL,
      status VARCHAR(30) NOT NULL,
      version BIGINT NOT NULL DEFAULT 1,
      created_by VARCHAR(36), completed_by VARCHAR(36),
      created_at DATETIME(6) NOT NULL,
      completed_at DATETIME(6), updated_at DATETIME(6) NOT NULL,
      CHECK (loading_quantity_grams > 0),
      CHECK (loading_inventory_cost_rupiah >= 0),
      CHECK (status IN ('IN_TRANSIT', 'COMPLETED')),
      CHECK (version > 0)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
  }
  override down(): void {
    this.addSql('DROP TABLE sales_shipments');
  }
}
