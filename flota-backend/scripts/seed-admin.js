import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

async function run() {
  const nombre = process.argv[2] || 'Administrador';
  const email = process.argv[3] || 'admin@flota.local';
  const pass  = process.argv[4] || 'admin123';

  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DB
  });

  const hash = await bcrypt.hash(pass, 10);
  await conn.query(
    'INSERT INTO users (nombre, email, password_hash, rol) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash), rol=VALUES(rol)',
    [nombre, email, hash, 'admin']
  );
  await conn.end();
  console.log(`✔ Admin listo: ${email} / ${pass}`);
}

run().catch(e => { console.error(e); process.exit(1); });
