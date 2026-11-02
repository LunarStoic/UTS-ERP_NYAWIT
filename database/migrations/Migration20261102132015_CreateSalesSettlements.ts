import { Migration } from '@mikro-orm/migrations';
export class Migration20261102132015_CreateSalesSettlements extends Migration {
  override name = 'Migration20261102132015_CreateSalesSettlements';
  override up(): void {
    this.addSql(`CREATE TABLE sales_sales_settlements (
      id VARCHAR(36) PRIMARY KEY, shipment_id VARCHAR(36) NOT NULL UNIQUE,
      receiving_reference_number VARCHAR(60), settlement_date DATE,
      accepted_quantity_grams BIGINT NOT NULL, deduction_quantity_grams BIGINT NOT NULL DEFAULT 0,
      reject_quantity_grams BIGINT NOT NULL, shrinkage_quantity_grams BIGINT NOT NULL,
      selling_price_microrupiah_per_kg BIGINT, gross_revenue_rupiah BIGINT,
      discount_rupiah BIGINT NOT NULL DEFAULT 0, net_revenue_rupiah BIGINT, cogs_rupiah BIGINT,
      reject_inventory_value_rupiah BIGINT NOT NULL DEFAULT 0, shrinkage_loss_rupiah BIGINT NOT NULL DEFAULT 0,
      status VARCHAR(20) NOT NULL, version BIGINT NOT NULL DEFAULT 1,
      recorded_by VARCHAR(36), settled_by VARCHAR(36), created_at DATETIME(6) NOT NULL,
      settled_at DATETIME(6), updated_at DATETIME(6) NOT NULL,
      FOREIGN KEY (shipment_id) REFERENCES sales_shipments(id),
      CHECK (accepted_quantity_grams > 0), CHECK (reject_quantity_grams >= 0 AND shrinkage_quantity_grams >= 0),
      CHECK (selling_price_microrupiah_per_kg >= 0),
      CHECK (gross_revenue_rupiah >= 0 AND discount_rupiah >= 0 AND net_revenue_rupiah >= 0),
      CHECK (net_revenue_rupiah = gross_revenue_rupiah - discount_rupiah),
      CHECK (status = 'SETTLED'), CHECK (version > 0)
    ) ENGINE=InnoDB`);
  }
  override down(): void { this.addSql('DROP TABLE sales_sales_settlements'); }
}
