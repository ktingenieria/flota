import dayjs from 'dayjs';
import { pool } from '../config/db.js';

export async function upsertNextReminders(vehicle_id) {
  // Para cada template activo, materializa próximo por km/fecha
  const [tpls] = await pool.query('SELECT * FROM maintenance_templates WHERE activo=1');
  for (const t of tpls) {
    // Último realizado:
    const [[last]] = await pool.query(
      `SELECT realizado_en_km, realizado_en_fecha
       FROM maintenance_events
       WHERE vehicle_id=? AND template_id=? AND estado='realizado'
       ORDER BY realizado_en_fecha DESC NULLS LAST, realizado_en_km DESC NULLS LAST
       LIMIT 1`,
      [vehicle_id, t.id]
    );
    // Odómetro actual:
    const [[veh]] = await pool.query('SELECT odometro_actual FROM vehicles WHERE id=?', [vehicle_id]);

    let proximo_km = null, proxima_fecha = null;
    if (t.cada_km) {
      const baseKm = last?.realizado_en_km ?? 0;
      proximo_km = baseKm + t.cada_km;
    }
    if (t.cada_meses) {
      const baseFecha = last?.realizado_en_fecha ? dayjs(last.realizado_en_fecha) : dayjs().startOf('day');
      proxima_fecha = baseFecha.add(t.cada_meses, 'month').format('YYYY-MM-DD');
    }

    await pool.query(
      `INSERT INTO reminders (vehicle_id, origen_template_id, tipo, proximo_km, proxima_fecha, estado)
       VALUES (?, ?, 'km', ?, NULL, 'pendiente')
       ON DUPLICATE KEY UPDATE proximo_km=VALUES(proximo_km), estado='pendiente'`,
      [vehicle_id, t.id, proximo_km]
    ).catch(()=>{});
    await pool.query(
      `INSERT INTO reminders (vehicle_id, origen_template_id, tipo, proximo_km, proxima_fecha, estado)
       VALUES (?, ?, 'fecha', NULL, ?, 'pendiente')
       ON DUPLICATE KEY UPDATE proxima_fecha=VALUES(proxima_fecha), estado='pendiente'`,
      [vehicle_id, t.id, proxima_fecha]
    ).catch(()=>{});
  }
}

export function statusAgainstTolerance({actualKm, targetKm, tolKm, today, targetDate, tolDays}) {
  const kmOk = targetKm != null ? (actualKm >= (targetKm - tolKm)) : false;
  const dateOk = targetDate ? (dayjs(today).isAfter(dayjs(targetDate).subtract(tolDays,'day'))) : false;
  return {kmOk, dateOk};
}
