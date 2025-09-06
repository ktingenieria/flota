import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';

const r = Router();

r.post('/register', async (req,res)=>{
  const { nombre, email, password, rol='capturista' } = req.body;
  const hash = await bcrypt.hash(password, 10);
  await pool.query('INSERT INTO users (nombre,email,password_hash,rol) VALUES (?,?,?,?)',
    [nombre,email,hash,rol]);
  res.sendStatus(201);
});

r.post('/login', async (req,res)=>{
  const { email, password } = req.body;
  const [[u]] = await pool.query('SELECT * FROM users WHERE email=? AND activo=1', [email]);
  if (!u) return res.status(401).json({message:'Credenciales'});
  const ok = await bcrypt.compare(password, u.password_hash);
  if (!ok) return res.status(401).json({message:'Credenciales'});
  const token = jwt.sign({ id:u.id, email:u.email, rol:u.rol }, process.env.JWT_SECRET, { expiresIn:'7d' });
  res.json({ token, user:{id:u.id, nombre:u.nombre, rol:u.rol} });
});

export default r;
