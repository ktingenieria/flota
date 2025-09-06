import { Router } from 'express';
import { pool } from '../config/db.js';
import { upsertNextReminders } from '../utils/maintenance.js';

const r = Router();

r.get('/', async (req,res)=>{
  const [rows] = await pool.query('SELECT * FROM vehicles ORDER BY id DESC');
  res.json(rows);
});

r.post('/', async (req,res)=>{
  const { placa, no_economico, marca, modelo, anio, tipo_combustible } = req.body;
  const [ret] = await pool.query(
    `INSERT INTO vehicles (placa,no_economico,marca,modelo,anio,tipo_combustible)
     VALUES (?,?,?,?,?,?)`,
    [placa,no_economico,marca,modelo,anio,tipo_combustible||'gasolina']
  );
  // Alias automáticos
  if (placa) await pool.query('INSERT IGNORE INTO vehicle_aliases (vehicle_id,alias_type,alias_value) VALUES (?,?,?)',[ret.insertId,'placa',placa]);
  if (no_economico) await pool.query('INSERT IGNORE INTO vehicle_aliases (vehicle_id,alias_type,alias_value) VALUES (?,?,?)',[ret.insertId,'no_economico',no_economico]);
  await upsertNextReminders(ret.insertId);
  res.status(201).json({ id: ret.insertId });
});

export default r;
