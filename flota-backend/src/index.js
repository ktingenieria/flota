import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dayjs from 'dayjs';
import cron from 'node-cron';
import { pool } from './config/db.js';
import { auth } from './middlewares/auth.js';
import { upsertNextReminders, statusAgainstTolerance } from './utils/maintenance.js';
import { bot, setWebhook } from './telegram/bot.js';

const app = express();
app.use(cors());
app.use(express.json({limit:'10mb'}));
app.use(morgan('dev'));

// --- Auth básico ---
import authRouter from './routes/auth.js';
app.use('/api/auth', authRouter);

// --- CRUD vehículos ---
import vehiclesRouter from './routes/vehicles.js';
app.use('/api/vehicles', auth(['admin','capturista','reportes']), vehiclesRouter);

// --- Importador CSV/XLSX ---
import importRouter from './routes/importer.js';
app.use('/api/import', auth(['admin','capturista']), importRouter);

// --- Telegram webhook ---
app.post('/api/telegram/webhook', (req, res) => {
  bot.handleUpdate(req.body);
  res.sendStatus(200);
});

// --- Recordatorios (cron cada día 08:00) ---
cron.schedule('0 8 * * *', async () => {
  const [veh] = await pool.query('SELECT id, odometro_actual FROM vehicles WHERE activo=1');
  for (const v of veh) await upsertNextReminders(v.id);

  // Enviar alertas (km o fecha dentro de tolerancia)
  const [rows] = await pool.query(
    `SELECT r.*, t.cada_km, t.cada_meses, t.tolerancia_km, t.tolerancia_dias, v.odometro_actual
     FROM reminders r
     JOIN maintenance_templates t ON t.id=r.origen_template_id
     JOIN vehicles v ON v.id=r.vehicle_id
     WHERE r.estado='pendiente'`
  );
  const today = dayjs();
  for (const r of rows) {
    const { kmOk, dateOk } = statusAgainstTolerance({
      actualKm: r.odometro_actual,
      targetKm: r.proximo_km,
      tolKm: r.tolerancia_km||0,
      today,
      targetDate: r.proxima_fecha,
      tolDays: r.tolerancia_dias||0
    });
    if (kmOk || dateOk) {
      // Notificar por Telegram a admins
      const [chats] = await pool.query(
        `SELECT chat_id FROM telegram_chats tc JOIN users u ON u.id=tc.user_id WHERE u.rol IN ('admin','reportes')`
      );
      for (const c of chats) {
        await bot.telegram.sendMessage(
          c.chat_id,
          `🔔 Recordatorio ${r.tipo.toUpperCase()} para vehículo #${r.vehicle_id} (template ${r.origen_template_id}).`
        ).catch(()=>{});
      }
      await pool.query('UPDATE reminders SET estado="enviado" WHERE id=?', [r.id]);
    }
  }
}, { timezone: process.env.TZ || 'America/Tijuana' });

const PORT = process.env.PORT || 3007;
app.listen(PORT, () => {
  console.log(`Flota backend escuchando en puerto ${PORT}`);
  // Webhook Telegram (opcional)
  if (process.env.TELEGRAM_WEBHOOK_URL) setWebhook().catch(()=>{});
});
