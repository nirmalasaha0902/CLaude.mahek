const { Pool } = require('pg');

let pool;

if (process.env.DATABASE_URL) {
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false // Required for Neon and many managed PG databases
        }
    });

    pool.on('error', (err, client) => {
        console.error('Unexpected error on idle client', err);
    });
} else {
    console.warn('DATABASE_URL not provided. Admin database features will not work.');
}

module.exports = pool;
