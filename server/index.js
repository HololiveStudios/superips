import express from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import cors from 'cors';
import path from 'path';
import pkg from 'pg';
import fs from 'fs';
import { NetworkMonitor } from './network-monitor.js';
import { Pool } from 'pg';

const app = express();

const db = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'superips_user',
  password: '359628',
  database: 'superips_db'
});

// Inicia o monitor
const monitor = new NetworkMonitor(db);

// Loop infinito de monitoramento
async function startRealtimeMonitoring() {
  while (true) {
    try {
      const devices = await monitor.discoverNetworkDevices();
      for (const device of devices) {
        await monitor.saveDeviceToDatabase(device);
      }
    } catch (err) {
      console.error("Erro no monitoramento:", err);
    }
    // tempo entre ciclos (30s, ajusta conforme quiser)
    await new Promise((res) => setTimeout(res, 30 * 1000));
  }
}

// Dispara quando o servidor sobe
startRealtimeMonitoring();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());


// Inicializar o monitor de rede
const networkMonitor = new NetworkMonitor(db);

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
      liMIT 100
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
      liMIT 10
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
      liMIT 10
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
      sqlQuery += ` AND nd.ip IliKE ${paramIndex}`;
      params.push(`%${query}%`);
      paramIndex++;
    }
    
    if (type === 'hostname' || type === 'all') {
      if (type === 'all') {
        sqlQuery = sqlQuery.replace('AND nd.ip', 'AND (nd.ip');
        sqlQuery += ` OR nd.hostname IliKE ${paramIndex})`;
      } else {
        sqlQuery += ` AND nd.hostname IliKE ${paramIndex}`;
      }
      params.push(`%${query}%`);
      paramIndex++;
    }
    
    if (type === 'mac' || type === 'all') {
      if (type === 'all') {
        sqlQuery = sqlQuery.replace(')', ` OR nd.mac_address IliKE ${paramIndex})`);
      } else {
        sqlQuery += ` AND nd.mac_address IliKE ${paramIndex}`;
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

// Função helper para verificar se um campo está realmente vazio
function isFieldEmpty(field) {
  if (!field) return true; // null, undefined
  if (typeof field !== 'string') return false; // se não for string, tem dados
  
  const cleaned = field.trim().toLowerCase();
  return cleaned === '' || cleaned === 'desconhecido' || cleaned === 'reservado' || cleaned === 'null';
}

// Função para verificar se um dispositivo está realmente livre
function isDeviceReallyFree(device) {
  // Um dispositivo só é livre se TODOS os campos importantes estão vazios
  const nameEmpty = isFieldEmpty(device.name);
  const typeEmpty = isFieldEmpty(device.type);
  const userEmpty = isFieldEmpty(device.user);
  const sectorEmpty = isFieldEmpty(device.sector);
  
  // TODOS os campos devem estar vazios para ser considerado livre
  return nameEmpty && typeEmpty && userEmpty && sectorEmpty;
}

// API melhorada para buscar IPs disponíveis
app.get('/api/devices/available-ips', async (req, res) => {
  try {
    const networks = ['10.0.11', '10.2.11', '10.4.11'];
    const { network } = req.query;
    
    const usedDevices = await db.query(`
      SELECT ip, name, type, "user", sector, status 
      FROM devices 
      ORDER BY ip
    `);
    const devices = usedDevices.rows;

    const available = [];
    const networksToCheck = network ? [network] : networks;

    for (const net of networksToCheck) {
     for (let i = 1; i <= 254; i++) {
  const ip = `${net}.${i}`;
        const device = devices.find(d => d.ip === ip);

        if (!device) {
          // IP não existe no banco - totalmente livre
          available.push({
            ip: ip,
            status: 'não_cadastrado',
            reason: 'IP não encontrado no banco de dados'
          });
        } else {
          // Verificar se o dispositivo está realmente livre
          if (isDeviceReallyFree(device)) {
            available.push({
              ip: ip,
              status: 'livre',
              reason: 'Todos os campos estão vazios',
              device_status: device.status === 0 ? 'offline' : 'online'
            });
          }
          // Se não está livre, não adiciona na lista de disponíveis
        }
      }
    }

    // Estatísticas
    const stats = {};
    for (const net of networks) {
      const networkIPs = available.filter(item => item.ip.startsWith(net));
      const totalDevicesInNetwork = devices.filter(d => d.ip.startsWith(net)).length;
      
      stats[net] = {
        available_count: networkIPs.length,
        total_devices: totalDevicesInNetwork,
        usage_percentage: ((totalDevicesInNetwork / 254) * 100).toFixed(1)
      };
    }

    res.json({
      available: available,
      stats: stats,
      total_available: available.length,
      networks: networks
    });

  } catch (error) {
    console.error('Erro ao buscar IPs disponíveis:', error);
    res.status(500).json({ error: error.message });
  }
});

// API para verificar um IP específico
app.get('/api/devices/check-ip/:ip', async (req, res) => {
  try {
    const { ip } = req.params;
    
    const result = await db.query(`
      SELECT * FROM devices WHERE ip = $1
    `, [ip]);

    if (result.rows.length === 0) {
      res.json({
        ip: ip,
        status: 'não_cadastrado',
        available: true,
        message: 'IP não encontrado no banco de dados'
      });
    } else {
      const device = result.rows[0];
      const isFree = isDeviceReallyFree(device);

      res.json({
        ip: ip,
        status: isFree ? 'livre' : 'ocupado',
        available: isFree,
        device: device,
        message: isFree ? 'IP disponível para uso' : 'IP já está em uso',
        details: {
          name_empty: isFieldEmpty(device.name),
          type_empty: isFieldEmpty(device.type),
          user_empty: isFieldEmpty(device.user),
          sector_empty: isFieldEmpty(device.sector)
        }
      });
    }
  } catch (error) {
    console.error('Erro ao verificar IP:', error);
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

// ========== ROOMS API ==========
app.get('/api/rooms', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        r.*,
        COUNT(dp.device_id) as device_count
      FROM rooms r
      LEFT JOIN device_positions dp ON r.id = dp.room_id
      GROUP BY r.id
      ORDER BY r.floor, r.name
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== CORREÇÃO DA API DE ROOMS ==========
app.put('/api/rooms/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, x, y, width, height, floor } = req.body;
    
    console.log('Atualizando sala:', { id, name, x, y, width, height, floor }); // Debug
    
    const result = await db.query(`
      UPDATE rooms 
      SET 
        name = COALESCE($2, name),
        x = CASE WHEN $3 IS NOT NULL THEN $3 ELSE x END,
        y = CASE WHEN $4 IS NOT NULL THEN $4 ELSE y END,
        width = CASE WHEN $5 IS NOT NULL THEN $5 ELSE width END,
        height = CASE WHEN $6 IS NOT NULL THEN $6 ELSE height END,
        floor = COALESCE($7, floor),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 
      RETURNING *
    `, [id, name, x, y, width, height, floor]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sala não encontrada' });
    }
    
    console.log('Sala atualizada:', result.rows[0]); // Debug
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar sala:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== CORREÇÃO DA API GET /api/rooms ==========
app.get('/api/rooms', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        r.id,
        r.name,
        COALESCE(r.x, 100) as x,
        COALESCE(r.y, 100) as y,
        COALESCE(r.width, 300) as width,
        COALESCE(r.height, 200) as height,
        COALESCE(r.floor, 1) as floor,
        r.created_at,
        r.updated_at,
        COUNT(dp.device_id) as device_count
      FROM rooms r
      LEFT JOIN device_positions dp ON r.id = dp.room_id
      GROUP BY r.id, r.name, r.x, r.y, r.width, r.height, r.floor, r.created_at, r.updated_at
      ORDER BY r.floor, r.name
    `);
    
    console.log('Salas carregadas:', result.rows); // Debug
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar salas:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/rooms/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query('DELETE FROM rooms WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sala não encontrada' });
    }
    
    res.json({ message: 'Sala removida com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== DEVICE POSITIONS API ==========
app.get('/api/device-positions', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        dp.*,
        d.ip,
        d.name as device_name,
        d.type,
        d.user,
        d.sector,
        d.status,
        d.online,
        r.name as room_name,
        r.floor
      FROM device_positions dp
      LEFT JOIN devices d ON dp.device_id = d.id
      LEFT JOIN rooms r ON dp.room_id = r.id
      ORDER BY r.floor, r.name, d.name
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/device-positions', async (req, res) => {
  try {
    const { device_id, room_id, x, y } = req.body;
    
    if (!device_id || !room_id) {
      return res.status(400).json({ error: 'device_id e room_id são obrigatórios' });
    }

    const result = await db.query(`
      INSERT INTO device_positions (device_id, room_id, x, y) 
      VALUES ($1, $2, $3, $4) 
      ON CONFLICT (device_id) 
      DO UPDATE SET 
        room_id = EXCLUDED.room_id,
        x = EXCLUDED.x,
        y = EXCLUDED.y,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [device_id, room_id, x || 0, y || 0]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/device-positions/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { room_id, x, y } = req.body;
    
    const result = await db.query(`
      UPDATE device_positions 
      SET room_id = COALESCE($2, room_id),
          x = COALESCE($3, x),
          y = COALESCE($4, y),
          updated_at = CURRENT_TIMESTAMP
      WHERE device_id = $1 
      RETURNING *
    `, [deviceId, room_id, x, y]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Posição do dispositivo não encontrada' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/device-positions/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const result = await db.query('DELETE FROM device_positions WHERE device_id = $1 RETURNING *', [deviceId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Posição do dispositivo não encontrada' });
    }
    
    res.json({ message: 'Posição do dispositivo removida com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/map-data', async (req, res) => {
  try {
    const { floor } = req.query;
    
    let roomsQuery = 'SELECT * FROM rooms ORDER BY id';
    let roomsParams = [];
    
    if (floor) {
      roomsQuery = 'SELECT * FROM rooms WHERE floor = $1 ORDER BY name';
      roomsParams = [floor];
    }
    
    const [roomsResult, devicesResult, positionsResult] = await Promise.all([
      db.query(roomsQuery, roomsParams),
      db.query('SELECT * FROM devices ORDER BY id'),
      db.query(`
        SELECT 
          dp.*,
          r.floor
        FROM device_positions dp
        LEFT JOIN rooms r ON dp.room_id = r.id
        ${floor ? 'WHERE r.floor = $1' : ''}
      `, floor ? [floor] : [])
    ]);

    const spacing = 80; // espaço entre dispositivos
    const cols = 5;     // quantos por linha antes de quebrar

    const devicesWithPositions = devicesResult.rows
      .map((device, index) => {
        const position = positionsResult.rows.find(p => p.device_id === device.id);

        let x, y;

        if (position) {
          x = position.x;
          y = position.y;
        } else {
          // Gera posição em grade para não sobrepor
          x = 50 + (index % cols) * spacing;
          y = 50 + Math.floor(index / cols) * spacing;
        }

        return {
          ...device,
          room_id: position?.room_id || null,
          x,
          y,
          status: Number(device.status) === 1 ? 1 : 0
        };
      })
      .filter(device => device.ip.startsWith('10.0.11.'));

    res.json({
      rooms: roomsResult.rows,
      devices: devicesWithPositions,
      sectors: [...new Set(devicesResult.rows.map(d => d.sector).filter(Boolean))],
      device_types: [...new Set(devicesResult.rows.map(d => d.type).filter(Boolean))]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// ========== BATCH UPDATE POSITIONS ==========
app.post('/api/device-positions/batch', async (req, res) => {
  try {
    const { positions } = req.body;
    
    if (!Array.isArray(positions)) {
      return res.status(400).json({ error: 'positions deve ser um array' });
    }

    const client = await db.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const pos of positions) {
        const { device_id, room_id, x, y } = pos;
        
        await client.query(`
          INSERT INTO device_positions (device_id, room_id, x, y) 
          VALUES ($1, $2, $3, $4) 
          ON CONFLICT (device_id) 
          DO UPDATE SET 
            room_id = EXCLUDED.room_id,
            x = EXCLUDED.x,
            y = EXCLUDED.y,
            updated_at = CURRENT_TIMESTAMP
        `, [device_id, room_id, x, y]);
      }
      
      await client.query('COMMIT');
      res.json({ success: true, updated: positions.length });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
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
              ON CONFliCT (id) DO UPDATE
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

app.put('/api/routers/:id', async (req, res) => {
  const { id } = req.params;
  const {
    name,
    ip,
    status,
    sector,
    model,
    login_username,
    login_password,
    wifi_ssid,
    wifi_password,
    hidden
  } = req.body;

  try {
    // 1. Busca o IP antigo do roteador
    const current = await db.query(
      "SELECT ip FROM devices WHERE id = $1 AND type = 'Roteador'",
      [id]
    );

    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Roteador não encontrado' });
    }

    const oldIp = current.rows[0].ip;

    // 2. Se o IP mudou, limpa o IP antigo
    if (oldIp && oldIp !== ip) {
      await db.query(
        `UPDATE devices
         SET name = NULL,
             type = NULL,
             "user" = NULL,
             sector = NULL,
             status = NULL,
             model = NULL,
             login_username = NULL,
             login_password = NULL,
             wifi_ssid = NULL,
             wifi_password = NULL,
             hidden = NULL
         WHERE ip = $1`,
        [oldIp]
      );
    }

    // 3. Verifica se o novo IP já existe
    const existing = await db.query(
      "SELECT id FROM devices WHERE ip = $1",
      [ip]
    );

    let result;
    if (existing.rows.length > 0) {
      // Atualiza o registro existente com os dados do roteador
      result = await db.query(
        `UPDATE devices
         SET name = $1,
             type = 'Roteador',
             status = $2,
             sector = $3,
             model = $4,
             login_username = $5,
             login_password = $6,
             wifi_ssid = $7,
             wifi_password = $8,
             hidden = $9
         WHERE ip = $10
         RETURNING *`,
        [name, status, sector, model, login_username, login_password, wifi_ssid, wifi_password, hidden, ip]
      );
    } else {
      // Atualiza o próprio registro do roteador para usar o novo IP
      result = await db.query(
        `UPDATE devices
         SET name = $1,
             ip = $2,
             type = 'Roteador',
             status = $3,
             sector = $4,
             model = $5,
             login_username = $6,
             login_password = $7,
             wifi_ssid = $8,
             wifi_password = $9,
             hidden = $10
         WHERE id = $11
         RETURNING *`,
        [name, ip, status, sector, model, login_username, login_password, wifi_ssid, wifi_password, hidden, id]
      );
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Erro ao atualizar roteador:', error);
    res.status(500).json({ error: error.message });
  }
});

// 1. Corrigir o GET para garantir tipos consistentes
app.get('/api/printers', async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM devices WHERE type = 'Impressora' ORDER BY sector, ip");
    
    // Garantir que os campos numéricos sejam retornados como números
    const printers = result.rows.map(printer => ({
      ...printer,
      online: Number(printer.online) || 0,
      status: Number(printer.status) || 0,
      // Garantir que campos opcionais existam
      npat: printer.npat || 0
    }));
    
    res.json(printers);
  } catch (error) {
    console.error('Erro ao buscar impressoras:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Corrigir o PUT para incluir o campo 'online' e melhorar a lógica
app.put('/api/printers/:id', async (req, res) => {
  const { id } = req.params;
  const {
    name,
    ip,
    online,
    status,
    sector,
    model,
    user,
    npat,
    li,  // Leitura Inicial
    lf   // Leitura Final
  } = req.body;

  try {
    // Buscar dados atuais da impressora
    const current = await db.query(
      "SELECT ip FROM devices WHERE id = $1 AND type = 'Impressora'",
      [id]
    );

    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Impressora não encontrada' });
    }

    const oldIp = current.rows[0].ip;

    // Se o IP mudou, limpar o registro antigo
    if (oldIp && oldIp !== ip) {
      await db.query(
        `UPDATE devices
         SET name = NULL,
             type = NULL,
             "user" = NULL,
             sector = NULL,
             status = NULL,
             online = NULL,
             model = NULL,
             npat = NULL,
             "li" = NULL,
             "lf" = NULL
         WHERE ip = $1`,
        [oldIp]
      );
    }

    // Verificar se já existe um dispositivo com o novo IP
    const existing = await db.query(
      "SELECT id FROM devices WHERE ip = $1 AND id != $2",
      [ip, id]
    );

    let result;
    if (existing.rows.length > 0) {
      // Atualizar o dispositivo existente com o novo IP
      result = await db.query(
        `UPDATE devices
         SET name = $1,
             type = 'Impressora',
             online = $2,
             status = $3,
             sector = $4,
             model = $5,
             "user" = $6,
             npat = $7,
             "li" = $8,
             "lf" = $9
         WHERE ip = $10
         RETURNING *`,
        [name, online, status, sector, model, user, npat, Li, Lf, ip]
      );
    } else {
      // Atualizar o dispositivo atual
      result = await db.query(
        `UPDATE devices
         SET name = $1,
             ip = $2,
             type = 'Impressora',
             online = $3,
             status = $4,
             sector = $5,
             model = $6,
             "user" = $7,
             npat = $8,
             "li" = $9,
             "lf" = $10
         WHERE id = $11
         RETURNING *`,
        [name, ip, online, status, sector, model, user, npat, li, lf, id]
      );
    }

    // Garantir tipos consistentes na resposta
    const updatedPrinter = {
      ...result.rows[0],
      online: Number(result.rows[0].online) || 0,
      status: Number(result.rows[0].status) || 0,
    };

    res.json(updatedPrinter);

  } catch (error) {
    console.error('Erro ao atualizar impressora:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== CAIXAS ==========
app.get('/api/boxes', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        id,
        ip,
        name,
        status,
        online AS power_status,
        codigo_acesso,
        identificacao,
        chave
      FROM devices
      WHERE sector = 'Caixas'
      ORDER BY name
    `);

    const boxes = result.rows.map(box => ({
      ...box,
      status: Number(box.status) || 0,
      power_status: Number(box.power_status) || 0,
    }));

    res.json(boxes);
  } catch (error) {
    console.error('Erro ao buscar caixas:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT - Atualiza dados do caixa
app.put('/api/boxes/:id', async (req, res) => {
  const { id } = req.params;
  const {
    name,
    ip,
    status,
    power_status,
    codigo_acesso,
    identificacao,
    chave
  } = req.body;

  try {
    // Busca IP antigo
    const current = await db.query(
      "SELECT ip FROM devices WHERE id = $1 AND sector = 'Caixas'",
      [id]
    );

    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Caixa não encontrado' });
    }

    const oldIp = current.rows[0].ip;

    // Se o IP mudou, limpar registro antigo
    if (oldIp && oldIp !== ip) {
      await db.query(
        `UPDATE devices
         SET name = NULL,
             type = NULL,
             "user" = NULL,
             sector = NULL,
             status = NULL,
             online = NULL,
             codigo_acesso = NULL,
             identificacao = NULL,
             chave = NULL
         WHERE ip = $1`,
        [oldIp]
      );
    }

    // Verifica se o novo IP já existe em outro registro
    const existing = await db.query(
      "SELECT id FROM devices WHERE ip = $1 AND id != $2",
      [ip, id]
    );

    let result;
    if (existing.rows.length > 0) {
      // Atualiza o registro existente
      result = await db.query(
        `UPDATE devices
         SET name = $1,
             type = 'Caixa',
             sector = 'Caixas',
             ip = $2,
             status = $3,
             online = $4,
             codigo_acesso = $5,
             identificacao = $6,
             chave = $7
         WHERE ip = $2
         RETURNING *`,
        [name, ip, status, power_status, codigo_acesso, identificacao, chave]
      );
    } else {
      // Atualiza o próprio registro
      result = await db.query(
        `UPDATE devices
         SET name = $1,
             ip = $2,
             type = 'Caixa',
             sector = 'Caixas',
             status = $3,
             online = $4,
             codigo_acesso = $5,
             identificacao = $6,
             chave = $7
         WHERE id = $8
         RETURNING *`,
        [name, ip, status, power_status, codigo_acesso, identificacao, chave, id]
      );
    }

    const updatedBox = {
      ...result.rows[0],
      status: Number(result.rows[0].status) || 0,
      power_status: Number(result.rows[0].online) || 0,
    };

    res.json(updatedBox);

  } catch (error) {
    console.error('Erro ao atualizar caixa:', error);
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