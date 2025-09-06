import { Telegraf } from 'telegraf';
import { pool } from '../config/db.js';

export const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// /vincular email
bot.command('vincular', async (ctx) => {
  const parts = ctx.message.text.split(' ').filter(Boolean);
  const email = parts[1];
  if (!email) return ctx.reply('Uso: /vincular tu@email');

  const [[u]] = await pool.query('SELECT id, rol FROM users WHERE email=? AND activo=1', [email]);
  if (!u) return ctx.reply('No encontré ese usuario.');
  // Guardar chat
  await pool.query(
    'INSERT INTO telegram_chats (user_id, chat_id, rol_cache) VALUES (?,?,?) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id), rol_cache=VALUES(rol_cache)',
    [u.id, ctx.chat.id, u.rol]
  );
  ctx.reply('✅ Vinculado. Recibirás recordatorios aquí.');
});

// /addkm PLACA 125430
bot.command('addkm', async (ctx) => {
  const parts = ctx.message.text.split(' ').filter(Boolean);
  if (parts.length < 3) return ctx.reply('Uso: /addkm PLACA 125430');
  const placa = parts[1];
  const km = parseInt(parts[2]);
  if (!Number.isFinite(km)) return ctx.reply('Odómetro inválido');

  const [[v]] = await pool.query('SELECT id FROM vehicles WHERE placa=?', [placa]);
  if (!v) return ctx.reply('Vehículo no encontrado');

  await pool.query('INSERT INTO odometer_logs (vehicle_id, fecha, odometro, fuente, comentario) VALUES (?,?,?,?,?)',
    [v.id, new Date(), km, 'bot', 'Actualización por Telegram']);
  await pool.query('UPDATE vehicles SET odometro_actual=? WHERE id=?', [km, v.id]);

  ctx.reply(`✅ Odómetro actualizado para ${placa}: ${km} km`);
});

// /proximos PLACA
bot.command('proximos', async (ctx) => {
  const parts = ctx.message.text.split(' ').filter(Boolean);
  if (parts.length < 2) return ctx.reply('Uso: /proximos PLACA');
  const placa = parts[1];

  const [[v]] = await pool.query('SELECT id, odometro_actual FROM vehicles WHERE placa=?', [placa]);
  if (!v) return ctx.reply('Vehículo no encontrado');

  const [rows] = await pool.query(
    `SELECT r.*, t.nombre, t.tolerancia_km, t.tolerancia_dias
     FROM reminders r JOIN maintenance_templates t ON t.id=r.origen_template_id
     WHERE r.vehicle_id=? AND r.estado IN ('pendiente','enviado')`, [v.id]);

  if (!rows.length) return ctx.reply('No hay recordatorios cargados todavía.');
  const lines = rows.map(r => {
    const kmLine = r.proximo_km ? `KM objetivo: ${r.proximo_km} (actual ${v.odometro_actual})` : '';
    const fechaLine = r.proxima_fecha ? `Fecha objetivo: ${r.proxima_fecha}` : '';
    return `• ${r.nombre} — ${r.tipo}\n   ${kmLine} ${fechaLine}`;
  });
  ctx.reply(`🔧 Próximos mantenimientos para ${placa}:\n` + lines.join('\n'));
});

// /reporte PLACA YYYY-MM
bot.command('reporte', async (ctx) => {
  const parts = ctx.message.text.split(' ').filter(Boolean);
  if (parts.length < 3) return ctx.reply('Uso: /reporte PLACA YYYY-MM');
  const [_, placa, ym] = parts;
  const from = new Date(`${ym}-01T00:00:00Z`);
  const to = new Date(new Date(from).setMonth(from.getMonth()+1));

  const [[v]] = await pool.query('SELECT id FROM vehicles WHERE placa=?', [placa]);
  if (!v) return ctx.reply('Vehículo no encontrado');

  const [fuel] = await pool.query(
    'SELECT COUNT(*) c, SUM(litros) lts, SUM(total) tot FROM fuel_receipts WHERE vehicle_id=? AND fecha>=? AND fecha<?',
    [v.id, from, to]
  );

  const msg = `📊 Reporte ${placa} ${ym}\nCargas: ${fuel[0].c}\nLitros: ${fuel[0].lts||0}\nGasto: $${fuel[0].tot||0}`;
  ctx.reply(msg);
});

export async function setWebhook() {
  if (!process.env.TELEGRAM_WEBHOOK_URL) return;
  await bot.telegram.setWebhook(process.env.TELEGRAM_WEBHOOK_URL);
}
