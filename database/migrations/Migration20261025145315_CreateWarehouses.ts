import { Migration } from '@mikro-orm/migrations';

export class Migration20261025145315_CreateWarehouses extends Migration {

  override name = 'Migration20261025145315_CreateWarehouses';

  override up(): void | Promise<void> {
    this.addSql(`
      CREATE TABLE warehouse_warehouses (
        id VARCHAR(36) PRIMARY KEY,
        code VARCHAR(40) NOT NULL UNIQUE,
        name VARCHAR(120) NOT NULL,
        address TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        version BIGINT NOT NULL DEFAULT 1,
        created_at DATETIME(6) NOT NULL,
        updated_at DATETIME(6) NOT NULL,
        CHECK (length(trim(code)) > 0),
        CHECK (length(trim(name)) > 0),
        CHECK (version > 0)
      )
    `);
  }

  override down(): void | Promise<void> {
    this.addSql(`DROP TABLE warehouse_warehouses`);
  }

}
