import { Migration } from '@mikro-orm/migrations';

export class Migration20261102123938_CreatePurchaseReceipts extends Migration {
  override name = 'Migration20261102123938_CreatePurchaseReceipts';

  override up(): void {
    this.addSql(`
      CREATE TABLE infrastructure_document_sequences (
          document_type VARCHAR(50) NOT NULL,
          year_no SMALLINT NOT NULL,
          last_number BIGINT NOT NULL DEFAULT 0,
          version BIGINT NOT NULL DEFAULT 1,
          updated_at DATETIME(6) NOT NULL,
          PRIMARY KEY (document_type, year_no),
          CHECK (last_number >= 0),
          CHECK (version > 0)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);
    this.addSql(`
      CREATE TABLE procurement_purchase_receipts (
          id VARCHAR(36) PRIMARY KEY,
          document_number VARCHAR(40) NOT NULL UNIQUE,
          receipt_date DATE NOT NULL,
          supplier_id VARCHAR(36) NOT NULL,
          product_id VARCHAR(36) NOT NULL,
          warehouse_id VARCHAR(36) NOT NULL,
          quantity_grams BIGINT NOT NULL,
          unit_price_microrupiah_per_kg BIGINT NOT NULL,
          total_amount_rupiah BIGINT NOT NULL,
          status VARCHAR(20) NOT NULL,
          request_loan_deduction BOOLEAN NOT NULL DEFAULT FALSE,
          loan_deduction_note VARCHAR(255),
          notes TEXT,
          version BIGINT NOT NULL DEFAULT 1,
          created_by VARCHAR(36),
          accepted_by VARCHAR(36),
          cancelled_by VARCHAR(36),
          created_at DATETIME(6) NOT NULL,
          accepted_at DATETIME(6),
          cancelled_at DATETIME(6),
          updated_at DATETIME(6) NOT NULL,
          CHECK (quantity_grams > 0),
          CHECK (unit_price_microrupiah_per_kg >= 0),
          CHECK (total_amount_rupiah >= 0),
          CHECK (status IN ('ACCEPTED','CANCELLED')),
          CHECK (version > 0)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);
    this.addSql(`
      CREATE INDEX ix_purchase_receipts_supplier_date ON procurement_purchase_receipts (supplier_id, receipt_date DESC);
    `);
    this.addSql(`
      CREATE INDEX ix_purchase_receipts_product_warehouse_date ON procurement_purchase_receipts (product_id, warehouse_id, receipt_date DESC);
    `);
    this.addSql(`
      CREATE INDEX ix_purchase_receipts_status_date ON procurement_purchase_receipts (status, receipt_date DESC);
    `);
    this.addSql(`
      CREATE TABLE procurement_purchase_price_history (
          id VARCHAR(36) PRIMARY KEY,
          product_id VARCHAR(36) NOT NULL,
          supplier_id VARCHAR(36),
          source_purchase_receipt_id VARCHAR(36) NOT NULL,
          effective_date DATE NOT NULL,
          unit_price_microrupiah_per_kg BIGINT NOT NULL,
          created_at DATETIME(6) NOT NULL,
          CHECK (unit_price_microrupiah_per_kg >= 0)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);
    this.addSql(`
      CREATE INDEX ix_purchase_price_history_product_date ON procurement_purchase_price_history (product_id, effective_date DESC);
    `);
    this.addSql(`
      CREATE INDEX ix_purchase_price_history_supplier_date ON procurement_purchase_price_history (supplier_id, effective_date DESC);
    `);
  }
  override down(): void {
    this.addSql('DROP TABLE procurement_purchase_price_history');
    this.addSql('DROP TABLE procurement_purchase_receipts');
    this.addSql('DROP TABLE infrastructure_document_sequences');
  }
}
