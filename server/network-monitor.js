// network-monitor.js - Serviço de Monitoramento de Rede
import { exec } from 'child_process';
import { promisify } from 'util';
import net from 'net';
import ping from 'ping';
import { networkInterfaces } from 'os';
import dgram from 'dgram';

const execAsync = promisify(exec);

export class NetworkMonitor {
  constructor(db) {
    this.db = db;
    this.scanInterval = null;
    this.commonPorts = [21, 22, 23, 25, 53, 80, 110, 135, 139, 143, 443, 993, 995, 1433, 3389, 5432];
  }

    // -------------------- Atualização da tabela devices --------------------
  async updateDeviceStatus(ip, status) {
    try {
      const client = await this.db.connect();
      try {
        await client.query(`
          UPDATE devices
          SET status = $2
          WHERE ip = $1
        `, [ip, status]);
      } finally {
        client.release();
      }
    } catch (error) {
      console.error(`Erro ao atualizar status do dispositivo ${ip}:`, error);
    }
  }

  async discoverNetworkDevices(subnet = null, ranges = null, concurrency = 100) {
    try {
      // se o usuário passou ranges, usar a varredura específica
      if (ranges) {
        const devices = await this.scanSpecificRanges(ranges, concurrency);
        return devices;
      }

      // comportamento padrão: usa as interfaces locais
      const networks = this.getLocalNetworks();
      const devices = [];

      for (const network of networks) {
        const networkDevices = await this.scanSubnet(network.subnet, network.mask);
        devices.push(...networkDevices);
      }

      return devices;
    } catch (error) {
      console.error('Erro na descoberta de dispositivos:', error);
      throw error;
    }
  }

  // Obter redes locais
  getLocalNetworks() {
    const interfaces = networkInterfaces();
    const networks = [];

    for (const [name, configs] of Object.entries(interfaces)) {
      for (const config of configs) {
        if (!config.internal && config.family === 'IPv4') {
          const ip = config.address;
          const mask = config.netmask;
          const subnet = this.calculateSubnet(ip, mask);
          
          networks.push({
            interface: name,
            ip,
            mask,
            subnet,
            cidr: this.maskToCIDR(mask)
          });
        }
      }
    }

    return networks;
  }

  // Calcular subnet
  calculateSubnet(ip, mask) {
    const ipParts = ip.split('.').map(Number);
    const maskParts = mask.split('.').map(Number);
    
    return ipParts.map((part, index) => part & maskParts[index]).join('.');
  }

  // Converter máscara para CIDR
  maskToCIDR(mask) {
    return mask.split('.')
      .map(part => parseInt(part).toString(2))
      .join('')
      .split('1').length - 1;
  }

  // Escanear subnet
  async scanSubnet(subnet, mask) {
    const devices = [];
    const baseIP = subnet.split('.').slice(0, 3).join('.');
    const promises = [];

    // Escanear IPs de 1 a 254
    for (let i = 1; i <= 254; i++) {
      const ip = `${baseIP}.${i}`;
      promises.push(this.scanHost(ip));
    }

    const results = await Promise.allSettled(promises);
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        devices.push(result.value);
      }
    }

    return devices;
  }

    /**
   * parseShortRanges:
   * - input: string '10.0.11-10.2.11,10.4.11' ou array ['10.0.11','10.4.11']
   * - output: array de bases ['10.0.11','10.1.11','10.2.11','10.4.11']
   */
  parseShortRanges(rangeInput) {
    if (!rangeInput) return [];
    if (Array.isArray(rangeInput)) return rangeInput.map(String);

    const parts = String(rangeInput).split(',').map(p => p.trim()).filter(Boolean);
    const outs = [];

    for (const p of parts) {
      if (p.includes('-')) {
        const [start, end] = p.split('-').map(s => s.trim());
        const sParts = start.split('.');
        const eParts = end.split('.');
        // aqui assumimos formato A.B.C (mesmo primeiro e terceiro octeto)
        if (sParts.length === 3 && eParts.length === 3 && sParts[0] === eParts[0] && sParts[2] === eParts[2]) {
          const a = Number(sParts[1]);
          const b = Number(eParts[1]);
          if (!Number.isFinite(a) || !Number.isFinite(b)) {
            outs.push(start, end);
            continue;
          }
          const from = Math.min(a, b), to = Math.max(a, b);
          const prefix = `${sParts[0]}.`;
          const suffix = `.${sParts[2]}`;
          for (let x = from; x <= to; x++) outs.push(`${prefix}${x}${suffix}`);
          continue;
        }
        // se não encaixar no padrão esperado, apenas adicione os extremos
        outs.push(start, end);
        continue;
      }

      // aceitar CIDR ex: 10.0.11.0/24 -> extrai 10.0.11
      if (p.includes('/')) {
        const base = p.split('/')[0].split('.').slice(0,3).join('.');
        outs.push(base);
        continue;
      }

      // base simples 10.0.11
      outs.push(p);
    }

    return Array.from(new Set(outs));
  }

  /**
   * scanSpecificRanges:
   * - ranges: string ou array (aceita o formato de parseShortRanges)
   * - concurrency: número de workers (recomendo 30..200)
   * Gera ips .1..254 para cada base 10.x.y e usa this.scanHost(ip)
   */
  async scanSpecificRanges(ranges, concurrency = 100) {
    const bases = this.parseShortRanges(ranges);
    if (!bases.length) return [];
    const ips = [];

    for (const base of bases) {
      const parts = base.split('.');
      if (parts.length !== 3) continue;
      for (let i = 1; i <= 254; i++) {
        ips.push(`${parts[0]}.${parts[1]}.${parts[2]}.${i}`);
      }
    }

    const results = [];
    let idx = 0;

    const worker = async () => {
      while (true) {
        const i = idx++;
        if (i >= ips.length) return;
        const ip = ips[i];
        try {
          const r = await this.scanHost(ip);
          if (r) results.push(r);
        } catch (e) {
          // fail softly
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, ips.length) }, () => worker());
    await Promise.all(workers);
    return results;
  }


  // Escanear host individual
  async scanHost(ip) {
    try {
      // Ping para verificar se está ativo
      const pingResult = await ping.promise.probe(ip, {
        timeout: 2,
        extra: ['-c', '1']
      });

      if (!pingResult.alive) {
        return null;
      }

      const deviceInfo = {
        ip,
        hostname: null,
        mac_address: null,
        vendor: null,
        os_info: null,
        open_ports: [],
        services: [],
        response_time: pingResult.time,
        last_seen: new Date(),
        status: 1
      };

      // Obter hostname
      try {
        const { stdout } = await execAsync(`nslookup ${ip} | grep "name =" | head -1`, { timeout: 3000 });
        if (stdout) {
          const hostname = stdout.split('name = ')[1]?.trim().replace(/\.$/, '');
          if (hostname) deviceInfo.hostname = hostname;
        }
      } catch (error) {
        // Tentar com nmblookup (NetBIOS)
        try {
          const { stdout } = await execAsync(`nmblookup -A ${ip} | grep "<00>" | head -1`, { timeout: 3000 });
          if (stdout) {
            const hostname = stdout.split(/\s+/)[0];
            if (hostname && hostname !== ip) deviceInfo.hostname = hostname;
          }
        } catch (e) {}
      }

      // Obter MAC address
      deviceInfo.mac_address = await this.getMacAddress(ip);

      // Obter informações do vendor baseado no MAC
      if (deviceInfo.mac_address) {
        deviceInfo.vendor = await this.getVendorFromMac(deviceInfo.mac_address);
      }

      // Escanear portas principais
      deviceInfo.open_ports = await this.scanPorts(ip, this.commonPorts);

      // Identificar serviços baseado nas portas abertas
      deviceInfo.services = this.identifyServices(deviceInfo.open_ports);

      // Tentar identificar OS
      deviceInfo.os_info = await this.detectOS(ip, deviceInfo.open_ports);

      return deviceInfo;
    } catch (error) {
      console.error(`Erro ao escanear ${ip}:`, error);
      return null;
    }
  }

  // Obter MAC address
  async getMacAddress(ip) {
    try {
      // Linux/macOS
      const { stdout } = await execAsync(`arp -n ${ip} | grep -E "([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}"`, { timeout: 3000 });
      const match = stdout.match(/([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}/i);
      return match ? match[0].toUpperCase() : null;
    } catch (error) {
      try {
        // Windows
        const { stdout } = await execAsync(`arp -a | findstr ${ip}`, { timeout: 3000 });
        const match = stdout.match(/([0-9a-fA-F]{2}-){5}[0-9a-fA-F]{2}/i);
        return match ? match[0].replace(/-/g, ':').toUpperCase() : null;
      } catch (e) {
        return null;
      }
    }
  }

  // Obter vendor do MAC
  async getVendorFromMac(mac) {
    try {
      const oui = mac.slice(0, 8).replace(/:/g, '');
      // Aqui você pode usar uma API ou base local de OUI
      // Por simplicidade, vou usar alguns vendors conhecidos
      const vendors = {
        '00:50:56': 'VMware',
        '08:00:27': 'Oracle VirtualBox',
        '52:54:00': 'QEMU/KVM',
        '00:0C:29': 'VMware',
        '00:15:5D': 'Microsoft Hyper-V',
        '00:1B:21': 'Intel',
        '00:26:BB': 'Apple',
        '28:C6:3F': 'Apple',
        'AC:BC:32': 'Apple'
      };

      for (const [ouiPrefix, vendor] of Object.entries(vendors)) {
        if (mac.startsWith(ouiPrefix)) {
          return vendor;
        }
      }

      return 'Unknown';
    } catch (error) {
      return 'Unknown';
    }
  }

  // Escanear portas
  async scanPorts(ip, ports, timeout = 1000) {
    const openPorts = [];
    const promises = ports.map(port => this.checkPort(ip, port, timeout));
    
    const results = await Promise.allSettled(promises);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        openPorts.push(ports[index]);
      }
    });

    return openPorts;
  }

  // Verificar porta específica
  async checkPort(ip, port, timeout = 1000) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      
      const timer = setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, timeout);

      socket.connect(port, ip, () => {
        clearTimeout(timer);
        socket.destroy();
        resolve(true);
      });

      socket.on('error', () => {
        clearTimeout(timer);
        resolve(false);
      });
    });
  }

  // Identificar serviços
  identifyServices(openPorts) {
    const services = [];
    const serviceMap = {
      21: 'FTP',
      22: 'SSH',
      23: 'Telnet',
      25: 'SMTP',
      53: 'DNS',
      80: 'HTTP',
      110: 'POP3',
      135: 'RPC',
      139: 'NetBIOS',
      143: 'IMAP',
      443: 'HTTPS',
      993: 'IMAPS',
      995: 'POP3S',
      1433: 'SQL Server',
      3389: 'RDP',
      5432: 'PostgreSQL'
    };

    for (const port of openPorts) {
      if (serviceMap[port]) {
        services.push({
          port,
          service: serviceMap[port],
          protocol: 'TCP'
        });
      }
    }

    return services;
  }

  // Detectar OS
  async detectOS(ip, openPorts) {
    try {
      let os = 'Unknown';
      
      // Baseado em portas abertas
      if (openPorts.includes(3389)) {
        os = 'Windows';
      } else if (openPorts.includes(22)) {
        os = 'Linux/Unix';
      } else if (openPorts.includes(135) || openPorts.includes(139)) {
        os = 'Windows';
      }

      // Tentar TTL do ping para mais informações
      try {
        const { stdout } = await execAsync(`ping -c 1 ${ip}`, { timeout: 3000 });
        const ttlMatch = stdout.match(/ttl=(\d+)/i);
        
        if (ttlMatch) {
          const ttl = parseInt(ttlMatch[1]);
          if (ttl <= 64) {
            os = os === 'Unknown' ? 'Linux/Unix' : os;
          } else if (ttl <= 128) {
            os = os === 'Unknown' ? 'Windows' : os;
          }
        }
      } catch (e) {}

      return os;
    } catch (error) {
      return 'Unknown';
    }
  }

  // Monitorar tráfego (simplificado)
  async monitorTraffic(ip) {
    try {
      const { stdout } = await execAsync(`netstat -i`, { timeout: 5000 });
      // Processar estatísticas de rede
      // Este é um exemplo básico, você pode expandir conforme necessário
      return {
        bytes_received: 0,
        bytes_sent: 0,
        packets_received: 0,
        packets_sent: 0,
        last_updated: new Date()
      };
    } catch (error) {
      console.error('Erro ao monitorar tráfego:', error);
      return null;
    }
  }

  // Verificar compartilhamentos (Windows)
  async checkSharedFolders(ip) {
    try {
      const { stdout } = await execAsync(`smbclient -L ${ip} -N`, { timeout: 10000 });
      const shares = [];
      
      const lines = stdout.split('\n');
      let inShareSection = false;
      
      for (const line of lines) {
        if (line.includes('Sharename')) {
          inShareSection = true;
          continue;
        }
        
        if (inShareSection && line.trim() && !line.includes('---')) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 2) {
            shares.push({
              name: parts[0],
              type: parts[1] || 'Disk',
              comment: parts.slice(2).join(' ') || ''
            });
          }
        }
        
        if (line.includes('Server') || line.includes('Workgroup')) {
          inShareSection = false;
        }
      }
      
      return shares;
    } catch (error) {
      return [];
    }
  }

  // Salvar dispositivo no banco
  async saveDeviceToDatabase(deviceInfo) {
    try {
      const client = await this.db.connect();
      
      try {
        await client.query('BEGIN');

        // Verificar se dispositivo já existe
        const existing = await client.query(
          'SELECT id FROM network_devices WHERE ip = $1',
          [deviceInfo.ip]
        );

        let deviceId;
        
        if (existing.rows.length > 0) {
          // Atualizar dispositivo existente
          const result = await client.query(`
            UPDATE network_devices 
            SET hostname = $2, mac_address = $3, vendor = $4, os_info = $5,
                response_time = $6, last_seen = $7, status = $8, updated_at = CURRENT_TIMESTAMP
            WHERE ip = $1 
            RETURNING id
          `, [
            deviceInfo.ip, deviceInfo.hostname, deviceInfo.mac_address,
            deviceInfo.vendor, deviceInfo.os_info, deviceInfo.response_time,
            deviceInfo.last_seen, deviceInfo.status
          ]);
          
          deviceId = result.rows[0].id;
        } else {
          // Inserir novo dispositivo
          const result = await client.query(`
            INSERT INTO network_devices 
            (ip, hostname, mac_address, vendor, os_info, response_time, last_seen, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
          `, [
            deviceInfo.ip, deviceInfo.hostname, deviceInfo.mac_address,
            deviceInfo.vendor, deviceInfo.os_info, deviceInfo.response_time,
            deviceInfo.last_seen, deviceInfo.status
          ]);
          
          deviceId = result.rows[0].id;
        }

        // Limpar portas antigas
        await client.query('DELETE FROM device_ports WHERE device_id = $1', [deviceId]);

        // Inserir portas abertas
        for (const port of deviceInfo.open_ports) {
          const service = deviceInfo.services.find(s => s.port === port);
          await client.query(`
            INSERT INTO device_ports (device_id, port, service_name, protocol, status)
            VALUES ($1, $2, $3, $4, $5)
          `, [
            deviceId, port, service?.service || 'Unknown', 
            service?.protocol || 'TCP', 'open'
          ]);
        }

        // Limpar serviços antigos
        await client.query('DELETE FROM device_services WHERE device_id = $1', [deviceId]);

        // Inserir serviços
        for (const service of deviceInfo.services) {
          await client.query(`
            INSERT INTO device_services (device_id, service_name, port, protocol, status)
            VALUES ($1, $2, $3, $4, $5)
          `, [deviceId, service.service, service.port, service.protocol, 'active']);
        }

        await client.query('COMMIT');
        return deviceId;
        
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Erro ao salvar dispositivo:', error);
      throw error;
    }
  }

  // Iniciar monitoramento contínuo
  startContinuousMonitoring(intervalMinutes = 10) {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
    }

    console.log(`Iniciando monitoramento contínuo a cada ${intervalMinutes} minutos`);
    
    this.scanInterval = setInterval(async () => {
      try {
        console.log('Iniciando varredura da rede...');
        const devices = await this.discoverNetworkDevices();
        
        console.log(`Descobertos ${devices.length} dispositivos`);
        
        for (const device of devices) {
          await this.saveDeviceToDatabase(device);
        }
        
        console.log('Varredura concluída');
      } catch (error) {
        console.error('Erro na varredura automática:', error);
      }
    }, intervalMinutes * 60 * 1000);

    // Executar primeira varredura imediatamente
    setTimeout(() => {
      this.discoverNetworkDevices().then(devices => {
        devices.forEach(device => this.saveDeviceToDatabase(device));
      });
    }, 1000);
  }

  // Parar monitoramento
  stopContinuousMonitoring() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
      console.log('Monitoramento contínuo parado');
    }
  }
}


/* // network-monitor.js - Serviço de Monitoramento de Rede
import { exec } from 'child_process';
import { promisify } from 'util';
import net from 'net';
import ping from 'ping';
import { networkInterfaces } from 'os';

const execAsync = promisify(exec);

export class NetworkMonitor {
  constructor(db) {
    this.db = db;
    this.scanInterval = null;
    this.commonPorts = [21, 22, 23, 25, 53, 80, 110, 135, 139, 143, 443, 993, 995, 1433, 3389, 5432];
  }

  // -------------------- Atualização da tabela devices --------------------
  async updateDeviceStatus(ip, status) {
    try {
      const client = await this.db.connect();
      try {
        await client.query(`
          UPDATE devices
          SET status = $2
          WHERE ip = $1
        `, [ip, status]);
      } finally {
        client.release();
      }
    } catch (error) {
      console.error(`Erro ao atualizar status do dispositivo ${ip}:`, error);
    }
  }

  // -------------------- Descoberta e scan de rede --------------------
  async discoverNetworkDevices(subnet = null, ranges = null, concurrency = 100) {
    try {
      if (ranges) {
        const devices = await this.scanSpecificRanges(ranges, concurrency);
        return devices;
      }
      const networks = this.getLocalNetworks();
      const devices = [];
      for (const network of networks) {
        const networkDevices = await this.scanSubnet(network.subnet, network.mask);
        devices.push(...networkDevices);
      }
      return devices;
    } catch (error) {
      console.error('Erro na descoberta de dispositivos:', error);
      throw error;
    }
  }

  getLocalNetworks() {
    const interfaces = networkInterfaces();
    const networks = [];
    for (const [name, configs] of Object.entries(interfaces)) {
      for (const config of configs) {
        if (!config.internal && config.family === 'IPv4') {
          const ip = config.address;
          const mask = config.netmask;
          const subnet = this.calculateSubnet(ip, mask);
          networks.push({ interface: name, ip, mask, subnet, cidr: this.maskToCIDR(mask) });
        }
      }
    }
    return networks;
  }

  calculateSubnet(ip, mask) {
    const ipParts = ip.split('.').map(Number);
    const maskParts = mask.split('.').map(Number);
    return ipParts.map((part, index) => part & maskParts[index]).join('.');
  }

  maskToCIDR(mask) {
    return mask.split('.')
      .map(part => parseInt(part).toString(2))
      .join('')
      .split('1').length - 1;
  }

  async scanSubnet(subnet, mask) {
    const devices = [];
    const baseIP = subnet.split('.').slice(0, 3).join('.');
    const promises = [];
    for (let i = 1; i <= 254; i++) promises.push(this.scanHost(`${baseIP}.${i}`));
    const results = await Promise.allSettled(promises);
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) devices.push(result.value);
    }
    return devices;
  }

  parseShortRanges(rangeInput) {
    if (!rangeInput) return [];
    if (Array.isArray(rangeInput)) return rangeInput.map(String);
    const parts = String(rangeInput).split(',').map(p => p.trim()).filter(Boolean);
    const outs = [];
    for (const p of parts) {
      if (p.includes('-')) {
        const [start, end] = p.split('-').map(s => s.trim());
        const sParts = start.split('.'); const eParts = end.split('.');
        if (sParts.length === 3 && eParts.length === 3 && sParts[0] === eParts[0] && sParts[2] === eParts[2]) {
          const from = Math.min(Number(sParts[1]), Number(eParts[1]));
          const to = Math.max(Number(sParts[1]), Number(eParts[1]));
          for (let x = from; x <= to; x++) outs.push(`${sParts[0]}.${x}.${sParts[2]}`);
          continue;
        }
        outs.push(start, end); continue;
      }
      if (p.includes('/')) {
        outs.push(p.split('/')[0].split('.').slice(0, 3).join('.'));
        continue;
      }
      outs.push(p);
    }
    return Array.from(new Set(outs));
  }

  async scanSpecificRanges(ranges, concurrency = 100) {
    const bases = this.parseShortRanges(ranges);
    if (!bases.length) return [];
    const ips = [];
    for (const base of bases) {
      const parts = base.split('.');
      if (parts.length !== 3) continue;
      for (let i = 1; i <= 254; i++) ips.push(`${parts[0]}.${parts[1]}.${parts[2]}.${i}`);
    }
    const results = []; let idx = 0;
    const worker = async () => {
      while (true) {
        const i = idx++;
        if (i >= ips.length) return;
        const ip = ips[i];
        try { const r = await this.scanHost(ip); if (r) results.push(r); } catch {}
      }
    };
    const workers = Array.from({ length: Math.min(concurrency, ips.length) }, () => worker());
    await Promise.all(workers);
    return results;
  }

  // -------------------- Scan de host --------------------
  async scanHost(ip) {
    try {
      const pingResult = await ping.promise.probe(ip, { timeout: 2, extra: ['-c', '1'] });
      const status = pingResult.alive ? 1 : 0;

      // Atualiza status na tabela devices
      await this.updateDeviceStatus(ip, status);

      if (!pingResult.alive) return null;

      const deviceInfo = { ip, hostname: null, mac_address: null, vendor: null, os_info: null, open_ports: [], services: [], response_time: pingResult.time, last_seen: new Date(), status };

      // Hostname
      try { const { stdout } = await execAsync(`nslookup ${ip} | grep "name =" | head -1`, { timeout: 3000 });
        if (stdout) deviceInfo.hostname = stdout.split('name = ')[1]?.trim().replace(/\.$/, '');
      } catch { try { const { stdout } = await execAsync(`nmblookup -A ${ip} | grep "<00>" | head -1`, { timeout: 3000 });
        if (stdout) { const hostname = stdout.split(/\s+/)[0]; if (hostname && hostname !== ip) deviceInfo.hostname = hostname; }
      } catch {} }

      deviceInfo.mac_address = await this.getMacAddress(ip);
      if (deviceInfo.mac_address) deviceInfo.vendor = await this.getVendorFromMac(deviceInfo.mac_address);
      deviceInfo.open_ports = await this.scanPorts(ip, this.commonPorts);
      deviceInfo.services = this.identifyServices(deviceInfo.open_ports);
      deviceInfo.os_info = await this.detectOS(ip, deviceInfo.open_ports);

      return deviceInfo;
    } catch (error) { console.error(`Erro ao escanear ${ip}:`, error); return null; }
  }

  async getMacAddress(ip) {
    try { const { stdout } = await execAsync(`arp -n ${ip} | grep -E "([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}"`, { timeout: 3000 });
      const match = stdout.match(/([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}/i); return match ? match[0].toUpperCase() : null;
    } catch (error) { try { const { stdout } = await execAsync(`arp -a | findstr ${ip}`, { timeout: 3000 });
      const match = stdout.match(/([0-9a-fA-F]{2}-){5}[0-9a-fA-F]{2}/i); return match ? match[0].replace(/-/g, ':').toUpperCase() : null;
    } catch { return null; } }
  }

  async getVendorFromMac(mac) {
    try {
      const oui = mac.slice(0, 8).replace(/:/g, '');
      const vendors = { '00:50:56': 'VMware','08:00:27': 'Oracle VirtualBox','52:54:00': 'QEMU/KVM','00:0C:29': 'VMware','00:15:5D': 'Microsoft Hyper-V','00:1B:21': 'Intel','00:26:BB': 'Apple','28:C6:3F': 'Apple','AC:BC:32': 'Apple' };
      for (const [ouiPrefix, vendor] of Object.entries(vendors)) if (mac.startsWith(ouiPrefix)) return vendor;
      return 'Unknown';
    } catch { return 'Unknown'; }
  }

  async scanPorts(ip, ports, timeout = 1000) {
    const openPorts = []; const promises = ports.map(port => this.checkPort(ip, port, timeout));
    const results = await Promise.allSettled(promises);
    results.forEach((result, index) => { if (result.status === 'fulfilled' && result.value) openPorts.push(ports[index]); });
    return openPorts;
  }

  async checkPort(ip, port, timeout = 1000) {
    return new Promise(resolve => {
      const socket = new net.Socket();
      const timer = setTimeout(() => { socket.destroy(); resolve(false); }, timeout);
      socket.connect(port, ip, () => { clearTimeout(timer); socket.destroy(); resolve(true); });
      socket.on('error', () => { clearTimeout(timer); resolve(false); });
    });
  }

  identifyServices(openPorts) {
    const services = [];
    const serviceMap = {21:'FTP',22:'SSH',23:'Telnet',25:'SMTP',53:'DNS',80:'HTTP',110:'POP3',135:'RPC',139:'NetBIOS',143:'IMAP',443:'HTTPS',993:'IMAPS',995:'POP3S',1433:'SQL Server',3389:'RDP',5432:'PostgreSQL'};
    for (const port of openPorts) if (serviceMap[port]) services.push({port, service: serviceMap[port], protocol:'TCP'});
    return services;
  }

  async detectOS(ip, openPorts) {
    try {
      let os = 'Unknown';
      if (openPorts.includes(3389)) os='Windows';
      else if (openPorts.includes(22)) os='Linux/Unix';
      else if (openPorts.includes(135)||openPorts.includes(139)) os='Windows';
      try { const { stdout } = await execAsync(`ping -c 1 ${ip}`, { timeout: 3000 });
        const ttlMatch = stdout.match(/ttl=(\d+)/i); if (ttlMatch) { const ttl=parseInt(ttlMatch[1]);
          if (ttl<=64) os=os==='Unknown'?'Linux/Unix':os;
          else if(ttl<=128) os=os==='Unknown'?'Windows':os;
        }
      } catch {}
      return os;
    } catch { return 'Unknown'; }
  }

  // -------------------- Salvamento em network_devices --------------------
  async saveDeviceToDatabase(deviceInfo) {
    try {
      const client = await this.db.connect();
      try {
        await client.query('BEGIN');
        const existing = await client.query('SELECT id FROM network_devices WHERE ip=$1',[deviceInfo.ip]);
        let deviceId;
        if (existing.rows.length>0) {
          const result = await client.query(`
            UPDATE network_devices
            SET hostname=$2,mac_address=$3,vendor=$4,os_info=$5,response_time=$6,last_seen=$7,status=$8,updated_at=CURRENT_TIMESTAMP
            WHERE ip=$1 RETURNING id
          `,[deviceInfo.ip,deviceInfo.hostname,deviceInfo.mac_address,deviceInfo.vendor,deviceInfo.os_info,deviceInfo.response_time,deviceInfo.last_seen,deviceInfo.status]);
          deviceId=result.rows[0].id;
        } else {
          const result = await client.query(`
            INSERT INTO network_devices(ip,hostname,mac_address,vendor,os_info,response_time,last_seen,status)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id
          `,[deviceInfo.ip,deviceInfo.hostname,deviceInfo.mac_address,deviceInfo.vendor,deviceInfo.os_info,deviceInfo.response_time,deviceInfo.last_seen,deviceInfo.status]);
          deviceId=result.rows[0].id;
        }

        await client.query('DELETE FROM device_ports WHERE device_id=$1',[deviceId]);
        for(const port of deviceInfo.open_ports){
          const service=deviceInfo.services.find(s=>s.port===port);
          await client.query(`
            INSERT INTO device_ports(device_id,port,service_name,protocol,status)
            VALUES($1,$2,$3,$4,$5)
          `,[deviceId,port,service?.service||'Unknown',service?.protocol||'TCP','open']);
        }

        await client.query('DELETE FROM device_services WHERE device_id=$1',[deviceId]);
        for(const service of deviceInfo.services){
          await client.query(`
            INSERT INTO device_services(device_id,service_name,port,protocol,status)
            VALUES($1,$2,$3,$4,$5)
          `,[deviceId,service.service,service.port,service.protocol,'active']);
        }

        await client.query('COMMIT');
        return deviceId;
      } catch (error){ await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    } catch (error){ console.error('Erro ao salvar dispositivo:',error); throw error; }
  }

  // -------------------- Monitoramento contínuo --------------------
  startContinuousMonitoring(intervalMinutes=10){
    if(this.scanInterval) clearInterval(this.scanInterval);
    console.log(`Iniciando monitoramento contínuo a cada ${intervalMinutes} minutos`);
    this.scanInterval=setInterval(async()=>{
      try{
        console.log('Iniciando varredura da rede...');
        const devices=await this.discoverNetworkDevices();
        console.log(`Descobertos ${devices.length} dispositivos`);
        for(const device of devices) await this.saveDeviceToDatabase(device);
        console.log('Varredura concluída');
      } catch(error){ console.error('Erro na varredura automática:',error); }
    }, intervalMinutes*60*1000);

    // Primeira varredura imediata
    setTimeout(()=>{
      this.discoverNetworkDevices().then(devices=>{ devices.forEach(device=>this.saveDeviceToDatabase(device)); });
    },1000);
  }

  stopContinuousMonitoring(){ if(this.scanInterval){ clearInterval(this.scanInterval); this.scanInterval=null; console.log('Monitoramento contínuo parado'); } }
}
 */