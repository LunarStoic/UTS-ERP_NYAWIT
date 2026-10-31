import { Migration } from '@mikro-orm/migrations';

export class Migration20261031054844_CreatePartners extends Migration {

  override name = 'Migration20261031054844_CreatePartners';

  override up(): void | Promise<void> {
    this.addSql(`
      CREATE TABLE partner_partners (
        id VARCHAR(36) PRIMARY KEY,
        code VARCHAR(40) NOT NULL UNIQUE,
        name VARCHAR(160) NOT NULL,
        phone VARCHAR(50),
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
    this.addSql(`
      CREATE TABLE partner_partner_roles (
        partner_id VARCHAR(36) NOT NULL,
        role_code VARCHAR(30) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at DATETIME(6) NOT NULL,
        PRIMARY KEY (partner_id, role_code),
        CHECK (role_code IN ('SUPPLIER', 'CUSTOMER', 'BORROWER'))
      ) 
    `);
  }

  override down(): void | Promise<void> {
    this.addSql(`DROP TABLE partner_partner_roles`);
    this.addSql(`DROP TABLE partner_partners`);
  }

}
