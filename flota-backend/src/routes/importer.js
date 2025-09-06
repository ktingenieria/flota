import { Router } from 'express';
import multer from 'multer';
import xlsx from 'xlsx';
import dayjs from 'dayjs';
import { pool } from '../config/db.js';
import { resolveVehicleId } from '../utils/resolveVehicle.js';

const r = Router();
const upload = multer({ storage: multer.memoryStorage(), limits:{ fileSize: 10*1024*1024 } });

// Campos esperados (sin acentos): Fecha, ID Estacion/Estacion, Producto, Litros, Precio, IVA, Total, Placas, No Economico, Tarjeta, Kms, Bomba, No. Venta, ID Consumo
function getCell(o, names=[]) {
  for (const n of names) {
    if (o[n] != null && o[n] !== '') return o[n];
  }
  return null;
}

r.post('/fuel', upload.single('file'), async (req,res)=>{
  try {
    if (!req.file) return res.status(400).json({message:'Sube un CSV o XLSX'});
    const wb = xlsx.read(req.file.buffer);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(ws, { raw: false, defval: null });

    const inserted = [];
    const errors = [];

    for (const row of rows) {
      const providerId = getCell(row, ['ID Consumo','ID_Consumo','ConsumoID']);
      const fechaStr = getCell(row, ['Fecha']);
      const fecha = fechaStr ? dayjs(fechaStr, ['DD/MM/YYYY HH:mm','YYYY-MM-DD HH:mm','YYYY/MM/DD HH:mm']).toDate() : null;

      const litros = parseFloat(getCell(row, ['Litros']));
      const precio = parseFloat(getCell(row, ['Precio','Precio unitario']));
      const iva = parseFloat(getCell(row, ['IVA'])) || 0;
      const total = parseFloat(getCell(row, ['Total','Total venta','Total_venta']));
      const producto = getCell(row, ['Producto']);
      const bomba = getCell(row, ['Bomba']);
      const folio = getCell(row, ['No. Venta','Folio']);

      // Identificación de vehículo (jerarquía)
      const placa = (getCell(row, ['Placas','Placa']) || '')?.toString().trim();
      const noEco = (getCell(row, ['No Economico','No_Economico']) || '')?.toString().trim();
      const tarjeta = (getCell(row, ['Tarjeta']) || '')?.toString().trim();

      const kms = parseInt(getCell(row, ['Kms','Odometro','Odómetro']));
      if (!fecha || !litros || !total || !Number.isFinite(kms)) {
        errors.push({ row, error:'Faltan campos (Fecha/Litros/Total/Kms)' });
        continue;
      }

      // Resolver estación
      const providerStationId = getCell(row, ['ID Estacion','ID_Estacion']);
      const estacion = getCell(row, ['Estacion','Estación']);
      let station_id = null;
      if (providerStationId || estacion) {
        const [[s]] = await pool.query(
          'SELECT id FROM fuel_stations WHERE provider_station_id=? AND nombre=?',
          [providerStationId, estacion]
        );
        if (s) station_id = s.id;
        else {
          const [ins] = await pool.query(
            'INSERT INTO fuel_stations (provider_station_id, nombre) VALUES (?,?)',
            [providerStationId, estacion]
          );
          station_id = ins.insertId;
        }
      }

      // Resolver vehículo
      let vehicle_id = await resolveVehicleId({ placa, no_economico: noEco, tarjeta });
      if (!vehicle_id) {
        errors.push({ row, error:'Vehículo no identificado por placa/no_economico/tarjeta' });
        continue;
      }

      // Dedupe
      if (providerId) {
        const [[dup]] = await pool.query('SELECT id FROM fuel_receipts WHERE provider_id_consumo=?', [providerId]);
        if (dup) { inserted.push({id:dup.id, dedupe:true}); continue; }
      }

      // Insert ticket
      const [ins] = await pool.query(
        `INSERT INTO fuel_receipts (provider_id_consumo, fecha, station_id, vehicle_id, tarjeta, producto, litros, precio_unit, iva, total, kms_reportados, bomba, folio, raw_json)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [providerId, fecha, station_id, vehicle_id, tarjeta, producto, litros, precio, iva, total, kms, bomba, folio, JSON.stringify(row)]
      );

      // Odómetro (y actualizar vehículo)
      await pool.query(
        'INSERT INTO odometer_logs (vehicle_id, fecha, odometro, fuente, comentario) VALUES (?,?,?,?,?)',
        [vehicle_id, fecha, kms, 'carga', `Carga ${litros} L`]
      );
      await pool.query('UPDATE vehicles SET odometro_actual=? WHERE id=? AND (odometro_actual IS NULL OR odometro_actual <= ?)', [kms, vehicle_id, kms]);

      inserted.push({ id: ins.insertId });
    }

    res.json({ inserted_count: inserted.length, errors_count: errors.length, errors });
  } catch (e) {
    console.error(e);
    res.status(500).json({message:'Error importando'});
  }
});

export default r;
