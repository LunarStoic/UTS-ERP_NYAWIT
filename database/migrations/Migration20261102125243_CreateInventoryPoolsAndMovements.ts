import { Migration } from '@mikro-orm/migrations';

export class Migration20261102125243_CreateInventoryPoolsAndMovements extends Migration {
  override name = 'Migration20261102125243_CreateInventoryPoolsAndMovements';

  override up(): void {
    this.addSql(`
      CREATE TABLE inventory_inventory_pools (
          id VARCHAR(36) PRIMARY KEY,
          warehouse_id VARCHAR(36) NOT NULL,
          product_id VARCHAR(36) NOT NULL,
          last_nonzero_average_cost_microrupiah_per_kg BIGINT NOT NULL DEFAULT 0,
          version BIGINT NOT NULL DEFAULT 1,
          created_at DATETIME(6) NOT NULL,
          updated_at DATETIME(6) NOT NULL,
          UNIQUE (warehouse_id, product_id),
          CHECK (version > 0)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);
    this.addSql(`
      CREATE TABLE inventory_inventory_movements (
          id VARCHAR(36) PRIMARY KEY,
          pool_id VARCHAR(36) NOT NULL,
          sequence_no BIGINT NOT NULL,
          movement_date DATE NOT NULL,
          movement_type VARCHAR(30) NOT NULL,
          quantity_in_grams BIGINT NOT NULL DEFAULT 0,
          quantity_out_grams BIGINT NOT NULL DEFAULT 0,
          value_in_rupiah BIGINT NOT NULL DEFAULT 0,
          value_out_rupiah BIGINT NOT NULL DEFAULT 0,
          balance_quantity_grams BIGINT NOT NULL,
          balance_value_rupiah BIGINT NOT NULL,
          average_cost_microrupiah_per_kg BIGINT NOT NULL DEFAULT 0,
          recovery_variance_rupiah BIGINT NOT NULL DEFAULT 0,
          cost_source VARCHAR(30),
          source_context VARCHAR(40) NOT NULL,
          source_type VARCHAR(60) NOT NULL,
          source_id VARCHAR(36) NOT NULL,
          occurred_at DATETIME(6) NOT NULL,
          created_at DATETIME(6) NOT NULL,
          UNIQUE (pool_id, sequence_no),
          CHECK (quantity_in_grams >= 0 AND value_in_rupiah >= 0),
          CHECK (quantity_out_grams >= 0 AND value_out_rupiah >= 0),
          CHECK ((quantity_in_grams > 0 AND quantity_out_grams = 0) OR (quantity_out_grams > 0 AND quantity_in_grams = 0)),
          CHECK (average_cost_microrupiah_per_kg >= 0),
          CHECK (balance_quantity_grams <> 0 OR balance_value_rupiah = 0),
          CHECK (balance_quantity_grams <> 0 OR average_cost_microrupiah_per_kg = 0),
          CHECK (movement_type IN ('RECEIPT','ISSUE','ADJUSTMENT_IN','ADJUSTMENT_OUT','REJECT_RETURN','CONVERSION_IN','CONVERSION_OUT')),
          CONSTRAINT fk_5 FOREIGN KEY (pool_id) REFERENCES inventory_inventory_pools(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);
    this.addSql(`
      CREATE INDEX ix_inventory_movements_pool_date ON inventory_inventory_movements (pool_id, movement_date, sequence_no);
    `);
    this.addSql(`
      CREATE INDEX ix_inventory_movements_source ON inventory_inventory_movements (source_context, source_type, source_id);
    `);
  }
  override down(): void {
    this.addSql('DROP TABLE inventory_inventory_movements');
    this.addSql('DROP TABLE inventory_inventory_pools');
  }
}
