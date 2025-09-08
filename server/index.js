import express from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import cors from 'cors';
import path from 'path';
import pkg from 'pg';
import fs from 'fs';
const { Pool } = pkg;

const app = express();

const db = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'superips_user',
  password: '359628',
  database: 'superips_db'
});

const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

import { NetworkMonitor, networkMonitoringTables } from './network-monitor.js';

// Inicializar o monitor de rede
const networkMonitor = new NetworkMonitor(db);

// Criar tabelas necessárias (execute uma vez)
app.post('/api/setup-monitoring-tables', async (req, res) => {
  try {
    await db.query(networkMonitoringTables);
    res.json({ success: true, message: 'Tabelas de monitoramento criadas com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Descobrir dispositivos na rede
app.post('/api/network/discover', async (req, res) => {
  try {
    const devices = await networkMonitor.discoverNetworkDevices();
    
    // Salvar dispositivos no banco
    for (const device of devices) {
      await networkMonitor.saveDeviceToDatabase(device);
    }
    
    res.json({ 
      success: true, 
      discovered: devices.length,
      devices: devices
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obter todos os dispositivos de rede
app.get('/api/network/devices', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        nd.*,
        COUNT(dp.id) as open_ports_count,
        COUNT(ds.id) as services_count,
        ARRAY_AGG(DISTINCT dp.port ORDER BY dp.port) FILTER (WHERE dp.port IS NOT NULL) as open_ports,
        ARRAY_AGG(DISTINCT ds.service_name) FILTER (WHERE ds.service_name IS NOT NULL) as services
      FROM network_devices nd
      LEFT JOIN device_ports dp ON nd.id = dp.device_id
      LEFT JOIN device_services ds ON nd.id = ds.device_id
      GROUP BY nd.id
      ORDER BY nd.ip
    `);
    
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obter detalhes de um dispositivo específico
app.get('/api/network/devices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const device = await db.query('SELECT * FROM network_devices WHERE id = $1', [id]);
    
    if (device.rows.length === 0) {
      return res.status(404).json({ error: 'Dispositivo não encontrado' });
    }
    
    const ports = await db.query('SELECT * FROM device_ports WHERE device_id = $1 ORDER BY port', [id]);
    const services = await db.query('SELECT * FROM device_services WHERE device_id = $1', [id]);
    const shares = await db.query('SELECT * FROM network_shares WHERE device_id = $1', [id]);
    const history = await db.query(`
      SELECT * FROM monitoring_history 
      WHERE device_id = $1 
      ORDER BY timestamp DESC 
      LIMIT 100
    `, [id]);
    
    res.json({
      device: device.rows[0],
      ports: ports.rows,
      services: services.rows,
      shares: shares.rows,
      history: history.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fazer ping em um dispositivo específico
app.post('/api/network/ping/:ip', async (req, res) => {
  try {
    const { ip } = req.params;
    const ping = await import('ping');
    
    const result = await ping.promise.probe(ip, {
      timeout: 5,
      extra: ['-c', '4']
    });
    
    res.json({
      ip,
      alive: result.alive,
      time: result.time,
      min: result.min,
      max: result.max,
      avg: result.avg,
      packetLoss: result.packetLoss
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Escanear portas de um dispositivo
app.post('/api/network/scan-ports/:ip', async (req, res) => {
  try {
    const { ip } = req.params;
    const { ports } = req.body; // Array de portas ou usar padrão
    
    const portsToScan = ports || networkMonitor.commonPorts;
    const openPorts = await networkMonitor.scanPorts(ip, portsToScan);
    
    res.json({
      ip,
      scanned_ports: portsToScan,
      open_ports: openPorts,
      services: networkMonitor.identifyServices(openPorts)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verificar compartilhamentos de um dispositivo Windows
app.post('/api/network/check-shares/:ip', async (req, res) => {
  try {
    const { ip } = req.params;
    const shares = await networkMonitor.checkSharedFolders(ip);
    
    res.json({
      ip,
      shares
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Iniciar monitoramento contínuo
app.post('/api/network/monitoring/start', async (req, res) => {
  try {
    const { interval = 10 } = req.body; // Intervalo em minutos
    
    networkMonitor.startContinuousMonitoring(interval);
    
    res.json({
      success: true,
      message: `Monitoramento iniciado com intervalo de ${interval} minutos`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Parar monitoramento contínuo
app.post('/api/network/monitoring/stop', async (req, res) => {
  try {
    networkMonitor.stopContinuousMonitoring();
    
    res.json({
      success: true,
      message: 'Monitoramento parado'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Status do monitoramento
app.get('/api/network/monitoring/status', async (req, res) => {
  try {
    const isRunning = networkMonitor.scanInterval !== null;
    
    res.json({
      monitoring_active: isRunning,
      last_scan: new Date().toISOString() // Você pode armazenar isso no banco
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Estatísticas da rede
app.get('/api/network/stats', async (req, res) => {
  try {
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total_devices,
        COUNT(*) FILTER (WHERE status = 1) as online_devices,
        COUNT(*) FILTER (WHERE status = 0) as offline_devices,
        COUNT(DISTINCT os_info) as different_os,
        COUNT(DISTINCT vendor) as different_vendors
      FROM network_devices
    `);
    
    const portStats = await db.query(`
      SELECT 
        service_name,
        COUNT(*) as count
      FROM device_ports 
      WHERE status = 'open'
      GROUP BY service_name 
      ORDER BY count DESC 
      LIMIT 10
    `);
    
    const osStats = await db.query(`
      SELECT 
        os_info,
        COUNT(*) as count
      FROM network_devices 
      WHERE os_info IS NOT NULL 
      GROUP BY os_info 
      ORDER BY count DESC
    `);
    
    const vendorStats = await db.query(`
      SELECT 
        vendor,
        COUNT(*) as count
      FROM network_devices 
      WHERE vendor IS NOT NULL AND vendor != 'Unknown'
      GROUP BY vendor 
      ORDER BY count DESC 
      LIMIT 10
    `);
    
    res.json({
      overview: stats.rows[0],
      top_services: portStats.rows,
      os_distribution: osStats.rows,
      vendor_distribution: vendorStats.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Histórico de monitoramento
app.get('/api/network/history/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { hours = 24 } = req.query;
    
    const history = await db.query(`
      SELECT 
        timestamp,
        response_time,
        status,
        cpu_usage,
        memory_usage,
        disk_usage,
        network_in,
        network_out
      FROM monitoring_history 
      WHERE device_id = $1 
        AND timestamp > NOW() - INTERVAL '${hours} hours'
      ORDER BY timestamp DESC
    `, [deviceId]);
    
    res.json(history.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Alertas baseados em dispositivos offline
app.get('/api/network/alerts', async (req, res) => {
  try {
    const offlineDevices = await db.query(`
      SELECT * FROM network_devices 
      WHERE status = 0 OR last_seen < NOW() - INTERVAL '30 minutes'
      ORDER BY last_seen DESC
    `);
    
    const slowDevices = await db.query(`
      SELECT * FROM network_devices 
      WHERE response_time > 100 AND status = 1
      ORDER BY response_time DESC
    `);
    
    const suspiciousPorts = await db.query(`
      SELECT nd.ip, nd.hostname, dp.port, dp.service_name
      FROM network_devices nd
      JOIN device_ports dp ON nd.id = dp.device_id
      WHERE dp.port IN (21, 23, 135, 139, 445) -- Portas potencialmente inseguras
      ORDER BY nd.ip
    `);
    
    res.json({
      offline_devices: offlineDevices.rows,
      slow_devices: slowDevices.rows,
      suspicious_ports: suspiciousPorts.rows,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Exportar dados de rede
app.get('/api/network/export', async (req, res) => {
  try {
    const { format = 'json' } = req.query;
    
    const devices = await db.query(`
      SELECT 
        nd.*,
        STRING_AGG(DISTINCT dp.port::text, ',') as open_ports,
        STRING_AGG(DISTINCT ds.service_name, ',') as services
      FROM network_devices nd
      LEFT JOIN device_ports dp ON nd.id = dp.device_id
      LEFT JOIN device_services ds ON nd.id = ds.device_id
      GROUP BY nd.id
      ORDER BY nd.ip
    `);
    
    if (format === 'csv') {
      const { Parser } = await import('json2csv');
      const parser = new Parser();
      const csv = parser.parse(devices.rows);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=network_devices.csv');
      res.send(csv);
    } else if (format === 'xlsx') {
      const XLSX = await import('xlsx');
      const ws = XLSX.utils.json_to_sheet(devices.rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Network Devices');
      
      const filePath = './network_devices.xlsx';
      XLSX.writeFile(wb, filePath);
      
      res.download(filePath, 'network_devices.xlsx', (err) => {
        if (err) {
          console.error('Erro ao enviar arquivo:', err);
          return res.status(500).json({ error: 'Erro ao gerar planilha' });
        }
        
        import('fs').then(fs => fs.unlinkSync(filePath));
      });
    } else {
      res.json({
        export_date: new Date().toISOString(),
        total_devices: devices.rows.length,
        devices: devices.rows
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Atualizar dispositivo manualmente
app.put('/api/network/devices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { hostname, device_type, vendor, os_info } = req.body;
    
    const result = await db.query(`
      UPDATE network_devices 
      SET hostname = $2, device_type = $3, vendor = $4, os_info = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 
      RETURNING *
    `, [id, hostname, device_type, vendor, os_info]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dispositivo não encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deletar dispositivo de rede
app.delete('/api/network/devices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query('DELETE FROM network_devices WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dispositivo não encontrado' });
    }
    
    res.json({ success: true, message: 'Dispositivo removido com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Buscar dispositivos por critério
app.get('/api/network/search', async (req, res) => {
  try {
    const { query, type = 'all' } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Query de busca é obrigatória' });
    }
    
    let sqlQuery = `
      SELECT nd.*, 
             COUNT(dp.id) as open_ports_count,
             STRING_AGG(DISTINCT dp.port::text, ',') as open_ports
      FROM network_devices nd
      LEFT JOIN device_ports dp ON nd.id = dp.device_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (type === 'ip' || type === 'all') {
      sqlQuery += ` AND nd.ip ILIKE ${paramIndex}`;
      params.push(`%${query}%`);
      paramIndex++;
    }
    
    if (type === 'hostname' || type === 'all') {
      if (type === 'all') {
        sqlQuery = sqlQuery.replace('AND nd.ip', 'AND (nd.ip');
        sqlQuery += ` OR nd.hostname ILIKE ${paramIndex})`;
      } else {
        sqlQuery += ` AND nd.hostname ILIKE ${paramIndex}`;
      }
      params.push(`%${query}%`);
      paramIndex++;
    }
    
    if (type === 'mac' || type === 'all') {
      if (type === 'all') {
        sqlQuery = sqlQuery.replace(')', ` OR nd.mac_address ILIKE ${paramIndex})`);
      } else {
        sqlQuery += ` AND nd.mac_address ILIKE ${paramIndex}`;
      }
      params.push(`%${query}%`);
      paramIndex++;
    }
    
    sqlQuery += ` GROUP BY nd.id ORDER BY nd.ip`;
    
    const result = await db.query(sqlQuery, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verificar conectividade RDP
app.post('/api/network/check-rdp/:ip', async (req, res) => {
  try {
    const { ip } = req.params;
    const rdpPort = 3389;
    
    const isOpen = await networkMonitor.checkPort(ip, rdpPort, 5000);
    
    res.json({
      ip,
      rdp_available: isOpen,
      port: rdpPort,
      checked_at: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Executar comando remoto (requer configuração SSH)
app.post('/api/network/remote-command', async (req, res) => {
  try {
    const { ip, command, username, password } = req.body;
    
    // AVISO: Este é um exemplo básico. Em produção, use chaves SSH e validação adequada
    if (!ip || !command || !username) {
      return res.status(400).json({ error: 'IP, comando e usuário são obrigatórios' });
    }
    
    // Para segurança, limite os comandos permitidos
    const allowedCommands = ['uptime', 'df -h', 'free -h', 'ps aux', 'netstat -tuln'];
    const isAllowed = allowedCommands.some(cmd => command.startsWith(cmd));
    
    if (!isAllowed) {
      return res.status(403).json({ error: 'Comando não permitido' });
    }
    
    const { execSync } = await import('child_process');
    
    try {
      // Usando sshpass (instale: apt-get install sshpass)
      const sshCommand = `sshpass -p '${password}' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${username}@${ip} "${command}"`;
      const output = execSync(sshCommand, { encoding: 'utf8', timeout: 30000 });
      
      res.json({
        ip,
        command,
        output,
        success: true,
        executed_at: new Date().toISOString()
      });
    } catch (error) {
      res.json({
        ip,
        command,
        error: error.message,
        success: false,
        executed_at: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Integração com SNMP (Simple Network Management Protocol)
app.post('/api/network/snmp-walk/:ip', async (req, res) => {
  try {
    const { ip } = req.params;
    const { community = 'public', oid = '1.3.6.1.2.1.1' } = req.body;
    
    const { execAsync } = await import('child_process');
    const { promisify } = await import('util');
    const execPromise = promisify(execAsync);
    
    try {
      const { stdout } = await execPromise(`snmpwalk -v2c -c ${community} ${ip} ${oid}`, { timeout: 10000 });
      
      const results = stdout.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const parts = line.split(' = ');
          return {
            oid: parts[0]?.trim(),
            value: parts[1]?.trim()
          };
        });
      
      res.json({
        ip,
        community,
        oid,
        results,
        success: true
      });
    } catch (error) {
      res.json({
        ip,
        error: 'SNMP não disponível ou comunidade inválida',
        success: false
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mapear topologia de rede (traceroute)
app.post('/api/network/traceroute/:ip', async (req, res) => {
  try {
    const { ip } = req.params;
    const { execAsync } = await import('child_process');
    const { promisify } = await import('util');
    const execPromise = promisify(execAsync);
    
    const { stdout } = await execPromise(`traceroute -n ${ip}`, { timeout: 30000 });
    
    const hops = stdout.split('\n')
      .filter(line => line.trim() && !line.includes('traceroute to'))
      .map(line => {
        const parts = line.trim().split(/\s+/);
        return {
          hop: parseInt(parts[0]) || 0,
          ip: parts[1] || '',
          rtt1: parts[2] || '',
          rtt2: parts[4] || '',
          rtt3: parts[6] || ''
        };
      })
      .filter(hop => hop.hop > 0);
    
    res.json({
      target_ip: ip,
      hops,
      total_hops: hops.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Monitoramento de largura de banda (iftop/nload)
app.get('/api/network/bandwidth/:interface?', async (req, res) => {
  try {
    const { interface: netInterface } = req.params;
    const { execAsync } = await import('child_process');
    const { promisify } = await import('util');
    const execPromise = promisify(execAsync);
    
    // Usar cat /proc/net/dev para obter estatísticas
    const { stdout } = await execPromise('cat /proc/net/dev');
    
    const lines = stdout.split('\n');
    const interfaces = [];
    
    for (let i = 2; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const parts = line.split(/\s+/);
      const ifName = parts[0].replace(':', '');
      
      if (netInterface && ifName !== netInterface) continue;
      
      interfaces.push({
        interface: ifName,
        bytes_received: parseInt(parts[1]) || 0,
        packets_received: parseInt(parts[2]) || 0,
        bytes_sent: parseInt(parts[9]) || 0,
        packets_sent: parseInt(parts[10]) || 0,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      interfaces,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/devices', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM devices ORDER BY ip');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/devices', async (req, res) => {
  try {
    const { ip, name, type, user, sector } = req.body;
    const result = await db.query(
      'INSERT INTO devices (ip, name, type, "user", sector) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [ip, name, type, user, sector]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/devices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { ip, name, type, user, sector } = req.body;
    const result = await db.query(
      'UPDATE devices SET ip = $1, name = $2, type = $3, "user" = $4, sector = $5 WHERE id = $6 RETURNING *',
      [ip, name, type, user, sector, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/devices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM devices WHERE id = $1', [id]);
    res.json({ message: 'Device deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/devices/import', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Arquivo não enviado' });

  try {
    let rows = [];

    const name = (req.file.originalname || '').toLowerCase();
    const isXlsx = name.endsWith('.xlsx') || name.endsWith('.xls') || req.file.mimetype.includes('spreadsheet') || req.file.mimetype.includes('excel');
    const isJson = name.endsWith('.json') || req.file.mimetype.includes('json');

    if (isXlsx) {
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null });
    } else if (isJson) {
      const text = req.file.buffer.toString('utf8');
      rows = JSON.parse(text);
      if (!Array.isArray(rows)) {
        if (rows.devices && Array.isArray(rows.devices)) rows = rows.devices;
        else return res.status(400).json({ error: 'JSON inválido: esperar array de objetos ou { devices: [] }' });
      }
    } else {
      return res.status(400).json({ error: 'Tipo de arquivo não suportado. Envie XLSX ou JSON.' });
    }

    const normalize = (obj) => {
      const out = {};
      for (const k of Object.keys(obj)) {
        out[k.toString().trim().toLowerCase()] = obj[k];
      }
      return out;
    };

    const client = await db.connect();
    const summary = { inserted: 0, updated: 0, skipped: 0, errors: [] };

    try {
      await client.query('BEGIN');

      for (const rawRow of rows) {
        const r = normalize(rawRow);

        const id = r.id ? Number(r.id) : null;
        const ip = r.ip ?? r.ip_address ?? r.endereco ?? r.address ?? null;
        const name = r.name ?? r.nome ?? r.device_name ?? null;
        const type = r.type ?? r.tipo ?? null;
        const user = r.user ?? r.usuario ?? r.owner ?? null;
        const sector = r.sector ?? r.setor ?? r.department ?? null;
        const status = r.status !== undefined && r.status !== null ? (Number(r.status) || 0) : null;
        const online = r.online !== undefined && r.online !== null ? (Number(r.online) || 0) : null;

        if (!id && !ip && !name) {
          summary.skipped++;
          continue;
        }

        try {
          if (id) {
            const q = `
              INSERT INTO devices (id, ip, name, type, "user", sector, status, online)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
              ON CONFLICT (id) DO UPDATE
              SET ip = EXCLUDED.ip, name = EXCLUDED.name, type = EXCLUDED.type,
                  "user" = EXCLUDED."user", sector = EXCLUDED.sector,
                  status = EXCLUDED.status, online = EXCLUDED.online
              RETURNING id
            `;
            await client.query(q, [id, ip, name, type, user, sector, status, online]);
            summary.updated++;
          } else if (ip) {
            const upd = await client.query(
              `UPDATE devices SET name=$1, type=$2, "user"=$3, sector=$4, status=$5, online=$6, updated_at=CURRENT_TIMESTAMP WHERE ip = $7 RETURNING id`,
              [name, type, user, sector, status, online, ip]
            );
            if (upd.rowCount > 0) {
              summary.updated++;
            } else {
              await client.query(
                `INSERT INTO devices (ip, name, type, "user", sector, status, online) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                [ip, name, type, user, sector, status, online]
              );
              summary.inserted++;
            }
          } else {
            await client.query(
              `INSERT INTO devices (ip, name, type, "user", sector, status, online) VALUES ($1,$2,$3,$4,$5,$6)`,
              [ip, name, type, user, sector, status, online]
            );
            summary.inserted++;
          }
        } catch (errRow) {
          summary.errors.push({ row: rawRow, error: String(errRow.message || errRow) });
        }
      }

      await client.query('COMMIT');
      res.json({ success: true, summary });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Import devices transaction error:', err);
      res.status(500).json({ error: 'Erro ao importar dispositivos', detail: String(err.message || err) });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Import devices error:', err);
    res.status(500).json({ error: 'Erro ao processar arquivo', detail: String(err.message || err) });
  }
});

app.get('/api/devices/export', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM devices')
    const devices = result.rows

    if (devices.length === 0) {
      return res.status(404).json({ error: 'Nenhum dispositivo encontrado' })
    }

    const ws = XLSX.utils.json_to_sheet(devices)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Devices')

    const filePath = './devices.xlsx'
    XLSX.writeFile(wb, filePath)

    res.download(filePath, 'devices.xlsx', (err) => {
      if (err) {
        console.error('Erro ao enviar arquivo:', err)
        return res.status(500).json({ error: 'Erro ao gerar planilha' })
      }

      fs.unlinkSync(filePath)
    })
  } catch (error) {
    console.error('Erro ao exportar devices:', error)
    res.status(500).json({ error: 'Erro ao exportar dados' })
  }
})

app.get('/api/routers', async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM devices WHERE type = 'Roteador' ORDER BY ip");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/printers', async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM devices WHERE type = 'Impressora' ORDER BY sector, ip");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/boxes', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        id AS device_id,
        ip,
        name,
        status,
        online AS power_status
      FROM devices
      WHERE sector = 'Caixas'
      ORDER BY name
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/boxes/:id/power-status', async (req, res) => {
  try {
    const { id } = req.params;
    const { power_status } = req.body;

    if (![0, 1].includes(power_status)) {
      return res.status(400).json({ error: 'Invalid power status. Must be 0 or 1.' });
    }

    const updateResult = await db.query(
      'UPDATE devices SET online = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND sector = $3 RETURNING id AS device_id, ip, name, status, online AS power_status',
      [power_status, id, 'Caixas']
    );
    console.log(updateResult);
    if (updateResult.rowCount === 0) {
      return res.status(404).json({ error: 'Box not found' });
    }

    res.json(updateResult.rows[0]);
  } catch (error) {
    console.error('Error updating box power status:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/printers/:id/online', async (req, res) => {
  try {
    const { id } = req.params;
    const online = Number(req.body?.online);

    if (![0, 1].includes(online)) {
      return res.status(400).json({ error: 'Invalid online status. Must be 0 or 1.' });
    }

    const updateResult = await db.query(
      `UPDATE devices 
         SET online = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 AND type = $3
       RETURNING id, ip, name, status, online`,
      [online, id, 'Impressora']
    );

    if (updateResult.rowCount === 0) {
      return res.status(404).json({ error: 'Printer not found or not of type Impressora' });
    }

    res.json(updateResult.rows[0]);
  } catch (error) {
    console.error('Error updating printer online status:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});


app.get('/api/tasks', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM tasks ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const { title, description, priority, category, due_date, assigned_to } = req.body;
    const result = await db.query(
      'INSERT INTO tasks (title, description, priority, category, due_date, assigned_to) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [title, description, priority, category, due_date, assigned_to]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, priority, status, category, due_date, assigned_to } = req.body;
    const result = await db.query(
      'UPDATE tasks SET title = $1, description = $2, priority = $3, status = $4, category = $5, due_date = $6, assigned_to = $7 WHERE id = $8 RETURNING *',
      [title, description, priority, status, category, due_date, assigned_to, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM tasks WHERE id = $1', [id]);
    res.json({ message: 'Task deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Adicione essas rotas ao seu server.js existente, após as outras rotas

// ========== SWITCHES ==========
app.get('/api/switches', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        id,
        name,
        model,
        sector,
        rack_position,
        total_ports,
        used_ports,
        is_poe,
        status,
        ip_address,
        ports_status,
        created_at,
        updated_at
      FROM switches 
      ORDER BY sector, name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar switches:', error);
    res.status(500).json({ message: 'Erro ao buscar switches' });
  }
});

app.post('/api/switches', async (req, res) => {
  try {
    const { 
      name, 
      model, 
      sector, 
      rack_position, 
      total_ports, 
      used_ports, 
      is_poe, 
      status, 
      ip_address,
      ports_status 
    } = req.body;

    // Validação básica
    if (!name || !model || !sector) {
      return res.status(400).json({ message: 'Nome, modelo e setor são obrigatórios' });
    }

    const result = await db.query(`
      INSERT INTO switches (
        name, model, sector, rack_position, total_ports, used_ports, 
        is_poe, status, ip_address, ports_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
      RETURNING *
    `, [
      name, 
      model, 
      sector, 
      rack_position || 1, 
      total_ports || 24, 
      used_ports || 0, 
      is_poe || false, 
      status || 'active', 
      ip_address || '',
      JSON.stringify(ports_status || Array(total_ports || 24).fill(false))
    ]);
    
    const newSwitch = result.rows[0];
    if (newSwitch.ports_status && typeof newSwitch.ports_status === 'string') {
      newSwitch.ports_status = JSON.parse(newSwitch.ports_status);
    }
    
    res.status(201).json(newSwitch);
  } catch (error) {
    console.error('Erro ao criar switch:', error);
    res.status(400).json({ message: 'Erro ao criar switch' });
  }
});

app.put('/api/switches/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      model, 
      sector, 
      rack_position, 
      total_ports, 
      used_ports, 
      is_poe, 
      status, 
      ip_address,
      ports_status 
    } = req.body;

    const result = await db.query(`
      UPDATE switches 
      SET 
        name = COALESCE($2, name),
        model = COALESCE($3, model),
        sector = COALESCE($4, sector),
        rack_position = COALESCE($5, rack_position),
        total_ports = COALESCE($6, total_ports),
        used_ports = COALESCE($7, used_ports),
        is_poe = COALESCE($8, is_poe),
        status = COALESCE($9, status),
        ip_address = COALESCE($10, ip_address),
        ports_status = COALESCE($11, ports_status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 
      RETURNING *
    `, [
      id,
      name,
      model,
      sector,
      rack_position,
      total_ports,
      used_ports,
      is_poe,
      status,
      ip_address,
      ports_status ? JSON.stringify(ports_status) : null
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Switch não encontrado' });
    }

    const updatedSwitch = result.rows[0];
    if (updatedSwitch.ports_status && typeof updatedSwitch.ports_status === 'string') {
      updatedSwitch.ports_status = JSON.parse(updatedSwitch.ports_status);
    }
    
    res.json(updatedSwitch);
  } catch (error) {
    console.error('Erro ao atualizar switch:', error);
    res.status(400).json({ message: 'Erro ao atualizar switch' });
  }
});

app.delete('/api/switches/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query('DELETE FROM switches WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Switch não encontrado' });
    }
    
    res.json({ message: 'Switch removido com sucesso' });
  } catch (error) {
    console.error('Erro ao remover switch:', error);
    res.status(500).json({ message: 'Erro ao remover switch' });
  }
});

// ========== RACKS ==========
app.get('/api/racks', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        id,
        name,
        sector,
        total_units,
        used_units,
        location,
        status,
        created_at,
        updated_at
      FROM racks 
      ORDER BY sector, name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar racks:', error);
    res.status(500).json({ message: 'Erro ao buscar racks' });
  }
});

app.post('/api/racks', async (req, res) => {
  try {
    const { 
      name, 
      sector, 
      total_units, 
      used_units, 
      location, 
      status 
    } = req.body;

    // Validação básica
    if (!name || !sector || !location) {
      return res.status(400).json({ message: 'Nome, setor e localização são obrigatórios' });
    }

    const result = await db.query(`
      INSERT INTO racks (
        name, sector, total_units, used_units, location, status
      ) VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING *
    `, [
      name, 
      sector, 
      total_units || 42, 
      used_units || 0, 
      location, 
      status || 'active'
    ]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar rack:', error);
    res.status(400).json({ message: 'Erro ao criar rack' });
  }
});

app.put('/api/racks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      sector, 
      total_units, 
      used_units, 
      location, 
      status 
    } = req.body;

    const result = await db.query(`
      UPDATE racks 
      SET 
        name = COALESCE($2, name),
        sector = COALESCE($3, sector),
        total_units = COALESCE($4, total_units),
        used_units = COALESCE($5, used_units),
        location = COALESCE($6, location),
        status = COALESCE($7, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 
      RETURNING *
    `, [
      id,
      name,
      sector,
      total_units,
      used_units,
      location,
      status
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Rack não encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar rack:', error);
    res.status(400).json({ message: 'Erro ao atualizar rack' });
  }
});

app.delete('/api/racks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query('DELETE FROM racks WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Rack não encontrado' });
    }
    
    res.json({ message: 'Rack removido com sucesso' });
  } catch (error) {
    console.error('Erro ao remover rack:', error);
    res.status(500).json({ message: 'Erro ao remover rack' });
  }
});

// ========== SCRIPT SQL PARA CRIAR AS TABELAS ==========
/*
Execute este SQL no seu PostgreSQL para criar as tabelas necessárias:

-- Tabela de Switches
CREATE TABLE IF NOT EXISTS switches (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  sector VARCHAR(50) NOT NULL,
  rack_position INTEGER DEFAULT 1,
  total_ports INTEGER DEFAULT 24,
  used_ports INTEGER DEFAULT 0,
  is_poe BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  ip_address VARCHAR(15) DEFAULT '',
  ports_status JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Racks
CREATE TABLE IF NOT EXISTS racks (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  sector VARCHAR(50) NOT NULL,
  total_units INTEGER DEFAULT 42,
  used_units INTEGER DEFAULT 0,
  location VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_switches_sector ON switches(sector);
CREATE INDEX IF NOT EXISTS idx_switches_status ON switches(status);
CREATE INDEX IF NOT EXISTS idx_racks_sector ON racks(sector);
CREATE INDEX IF NOT EXISTS idx_racks_status ON racks(status);

-- Inserir alguns dados de exemplo (opcional)
INSERT INTO switches (name, model, sector, rack_position, total_ports, used_ports, is_poe, ip_address, ports_status) VALUES
('SW-TI-01', 'Cisco SG350-24', 'TI', 1, 24, 18, true, '192.168.1.10', '[true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,false,false,false,false,false,false]'),
('SW-ADM-01', 'HPE 1920-24G', 'Administrativo', 2, 24, 12, false, '192.168.1.11', '[true,true,true,true,true,true,true,true,true,true,true,true,false,false,false,false,false,false,false,false,false,false,false,false]'),
('SW-PROD-01', 'Cisco SG350-24P', 'Produção', 1, 24, 20, true, '192.168.1.12', '[true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,false,false,false,false]');

INSERT INTO racks (name, sector, total_units, used_units, location) VALUES
('RACK-TI-01', 'TI', 42, 8, 'Sala de Servidores - Andar 1'),
('RACK-ADM-01', 'Administrativo', 24, 5, 'Sala de TI - Andar 2'),
('RACK-PROD-01', 'Produção', 42, 12, 'Galpão de Produção');
*/

const __dirname = path.resolve();
const distPath = path.join(__dirname, 'dist');

app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = 5173;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT} e servindo front-end da pasta dist`);
}); 