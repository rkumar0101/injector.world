import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URI, max: 2 });
const t = await pool.query(`select distinct page_type::text pt, count(*)::int c from page_index group by 1 order by 1`);
console.log(t.rows);
await pool.end();
