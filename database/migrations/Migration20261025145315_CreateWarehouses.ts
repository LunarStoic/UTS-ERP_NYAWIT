import { Migration } from '@mikro-orm/migrations';

export class Migration20261025145315_CreateWarehouses extends Migration {

  override name = 'Migration20261025145315_CreateWarehouses';

  override up(): void | Promise<void> {
    this.addSql(`select 1`);
  }

  override down(): void | Promise<void> {
    this.addSql(`select 1`);
  }

}
