// scripts/seed.js
// Seed data minimal: satu produk dengan variasi valid untuk development.

import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

async function seed() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Cek apakah sudah ada data seed
    const { rows: existing } = await client.query(
      "SELECT id FROM products WHERE name = 'Kaos Katun Polos' LIMIT 1",
    );

    if (existing.length > 0) {
      console.log('[seed] Seed data already exists. Skipping.');
      await client.query('ROLLBACK');
      return;
    }

    // Insert produk pertama
    const { rows: [product1] } = await client.query(
      `INSERT INTO products (name, price, image_url, description)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [
        'Kaos Katun Polos',
        150000,
        'https://example.com/kaos-katun.png',
        'Kaos katun nyaman untuk penggunaan sehari hari.',
      ],
    );

    const variants1 = [
      { type: 'size', value: 'S', quantity: 10 },
      { type: 'size', value: 'M', quantity: 15 },
      { type: 'size', value: 'L', quantity: 5 },
    ];

    for (const v of variants1) {
      await client.query(
        `INSERT INTO product_variants (product_id, variant_type, value, quantity)
         VALUES ($1, $2, $3, $4)`,
        [product1.id, v.type, v.value, v.quantity],
      );
    }

    // Insert produk kedua
    const { rows: [product2] } = await client.query(
      `INSERT INTO products (name, price, image_url, description)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [
        'Sepatu Sneaker Casual',
        450000,
        'https://example.com/sepatu-sneaker.png',
        'Sepatu sneaker casual cocok untuk sehari hari.',
      ],
    );

    const variants2 = [
      { type: 'color', value: 'Merah', quantity: 8 },
      { type: 'color', value: 'Biru', quantity: 12 },
      { type: 'color', value: 'Hitam', quantity: 20 },
    ];

    for (const v of variants2) {
      await client.query(
        `INSERT INTO product_variants (product_id, variant_type, value, quantity)
         VALUES ($1, $2, $3, $4)`,
        [product2.id, v.type, v.value, v.quantity],
      );
    }

    await client.query('COMMIT');
    console.log('[seed] Seed data inserted successfully.');
    console.log(`[seed] Product 1 ID: ${product1.id}`);
    console.log(`[seed] Product 2 ID: ${product2.id}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[seed] Failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('[seed] Fatal error:', err.message);
  process.exit(1);
});
