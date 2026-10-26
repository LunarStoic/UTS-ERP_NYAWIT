import { Migrator } from '@mikro-orm/migrations';
import { defineConfig } from '@mikro-orm/mysql';

export default defineConfig({
    clientUrl: process.env.DATABASE_URL,
    entities: [],
    discovery: { warnWhenNoEntities: false },
    extensions: [Migrator],
    migrations: {
        path: 'database/migrations',
        glob: '!{*.d}.{js,ts}'
    }
});

