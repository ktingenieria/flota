import { pool } from '../config/db.js';

/** Jerarquía: placa > no_economico > tarjeta */
export async function resolveVehicleId({ placa, no_economico, tarjeta }) {
  const candidates = [];
  if (placa) candidates.push(['placa', placa]);
  if (no_economico) candidates.push(['no_economico', no_economico]);
  if (tarjeta) candidates.push(['tarjeta', tarjeta]);

  for (const [type, val] of candidates) {
    const [rows] = await pool.query(
      'SELECT vehicle_id FROM vehicle_aliases WHERE alias_type=? AND alias_value=?',
      [type, val]
    );
    if (rows.length) return rows[0].vehicle_id;
  }
  // Intentar match directo por placas/no_economico también:
  if (placa) {
    const [[v]] = await pool.query('SELECT id FROM vehicles WHERE placa=?', [placa]);
    if (v) return v.id;
  }
  if (no_economico) {
    const [[v]] = await pool.query('SELECT id FROM vehicles WHERE no_economico=?', [no_economico]);
    if (v) return v.id;
  }
  return null;
}
