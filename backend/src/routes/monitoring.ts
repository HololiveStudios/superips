import { Elysia } from 'elysia';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../db/database';
import { devices } from '../db/schema';
import { spawn } from 'bun';

interface PingHistory {
  [ip: string]: {
    attempts: number;
    successes: number;
    failures: number;
    lastSeen: Date;
    consecutiveFailures: number;
    avgResponseTime: number;
    lastStatus: boolean;
  };
}

interface PingResult {
  ip: string;
  online: boolean;
  responseTime: number;
  timestamp: string;
  error?: string;
}

interface FastPingResult {
  ip: string;
  online: boolean;
  responseTime: number;
  changed: boolean;
  timestamp: string;
}

interface NetworkStats {
  [network: string]: {
    total: number;
    online: number;
    offline: number;
    uptime_percentage: string;
    reliability: string;
  };
}

const pingHistory: PingHistory = {};
const ULTRA_BATCH_SIZE = 100;
const NETWORKS = ['10.0.11', '10.4.11']; // Removido 10.2.11
const CHANGE_DETECTION_ONLY = true;

export const monitoringRoutes = new Elysia({ prefix: '/api/monitoring' })
  .get('/status', async () => {
    return {
      running: global.fastMonitoringInterval !== null && global.fastMonitoringInterval !== undefined,
      interval: 1,
      last_run: global.lastMonitoringRun || new Date().toISOString(),
      devices_monitored: Object.keys(pingHistory).length,
      networks: NETWORKS,
      ultra_fast_mode: true
    };
  })
  
  .post('/ping-all-ultra-fast', async () => {
    const allDevices = await db.select({ ip: devices.ip }).from(devices);
    const deviceIPs = allDevices.filter(d => d.ip && (d.ip.startsWith('10.0.11') || d.ip.startsWith('10.4.11'))).map(d => d.ip!);
    
    console.log(`Iniciando ping ultra-rápido para ${deviceIPs.length} dispositivos...`);
    const startTime = Date.now();
    
    const batches = chunkArray(deviceIPs, ULTRA_BATCH_SIZE);
    const results: FastPingResult[] = [];
    let changedDevices = 0;
    
    const batchPromises = batches.map(async (batch, index) => {
      const batchResults = await Promise.all(batch.map(ip => pingDeviceUltraFast(ip)));
      results.push(...batchResults);
      changedDevices += batchResults.filter(r => r.changed).length;
      return batchResults;
    });
    
    await Promise.all(batchPromises);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    global.lastMonitoringRun = new Date().toISOString();
    
    return {
      success: true,
      total_pinged: results.length,
      online: results.filter(r => r.online).length,
      offline: results.filter(r => !r.online).length,
      changed_devices: changedDevices,
      processing_time_ms: duration,
      devices_per_second: Math.round(results.length / (duration / 1000)),
      networks_scanned: NETWORKS
    };
  })
  
  .post('/start-ultra-fast-monitoring', async () => {
    if (global.fastMonitoringInterval) {
      clearInterval(global.fastMonitoringInterval);
    }
    
    console.log('Iniciando monitoramento ultra-rápido (1 segundo)...');
    
    global.fastMonitoringInterval = setInterval(async () => {
      try {
        const startTime = Date.now();
        
        const allDevices = await db.select({ ip: devices.ip }).from(devices);
        const deviceIPs = allDevices.filter(d => d.ip && (d.ip.startsWith('10.0.11') || d.ip.startsWith('10.4.11'))).map(d => d.ip!);
        
        const batches = chunkArray(deviceIPs, ULTRA_BATCH_SIZE);
        let changedDevices = 0;
        
        const batchPromises = batches.map(async (batch) => {
          const batchResults = await Promise.all(batch.map(ip => pingDeviceUltraFast(ip)));
          changedDevices += batchResults.filter(r => r.changed).length;
          return batchResults;
        });
        
        await Promise.all(batchPromises);
        
        const duration = Date.now() - startTime;
        global.lastMonitoringRun = new Date().toISOString();
        
        if (changedDevices > 0) {
          console.log(`Monitoramento: ${deviceIPs.length} dispositivos em ${duration}ms - ${changedDevices} mudanças detectadas`);
        }
      } catch (error) {
        console.error('Erro no monitoramento ultra-rápido:', error);
      }
    }, 1000);
    
    return {
      success: true,
      message: 'Monitoramento ultra-rápido iniciado (1 segundo)',
      networks: NETWORKS,
      estimated_devices: '~500'
    };
  })
  
  .post('/stop-monitoring', async () => {
    if (global.fastMonitoringInterval) {
      clearInterval(global.fastMonitoringInterval);
      global.fastMonitoringInterval = null;
    }
    
    return {
      success: true,
      message: 'Monitoramento ultra-rápido parado'
    };
  })
  
  .get('/network-status', async ({ query }) => {
    const { network } = query;
    const allDevices = await db.select().from(devices);
    
    const networks = network ? [network as string] : NETWORKS;
    const stats: NetworkStats = {};
    
    for (const net of networks) {
      const networkDevices = allDevices.filter(d => d.ip?.startsWith(net));
      const onlineDevices = networkDevices.filter(d => d.status === 1);
      
      stats[net] = {
        total: networkDevices.length,
        online: onlineDevices.length,
        offline: networkDevices.length - onlineDevices.length,
        uptime_percentage: networkDevices.length > 0 
          ? ((onlineDevices.length / networkDevices.length) * 100).toFixed(1)
          : '0.0',
        reliability: calculateNetworkReliability(net)
      };
    }
    
    return { stats, networks };
  })
  
  .get('/performance-metrics', async () => {
    const totalDevices = Object.keys(pingHistory).length;
    const avgResponseTime = Object.values(pingHistory)
      .reduce((sum, h) => sum + h.avgResponseTime, 0) / Math.max(totalDevices, 1);
    
    const highReliability = Object.values(pingHistory)
      .filter(h => h.attempts > 10 && (h.successes / h.attempts) > 0.95).length;
    
    return {
      total_monitored: totalDevices,
      avg_response_time: Math.round(avgResponseTime),
      high_reliability_devices: highReliability,
      networks_active: NETWORKS,
      monitoring_active: global.fastMonitoringInterval !== null,
      last_run: global.lastMonitoringRun
    };
  });

async function pingDeviceUltraFast(ip: string): Promise<FastPingResult> {
  if (!pingHistory[ip]) {
    pingHistory[ip] = {
      attempts: 0,
      successes: 0,
      failures: 0,
      lastSeen: new Date(),
      consecutiveFailures: 0,
      avgResponseTime: 0,
      lastStatus: false
    };
  }
  
  const history = pingHistory[ip];
  const startTime = Date.now();
  let online = false;
  let responseTime = 0;
  
  try {
    const proc = spawn(['fping', '-c', '1', '-t', '500', ip], {
      stdio: ['ignore', 'pipe', 'ignore']
    });
    
    const result = await proc.exited;
    online = result === 0;
    responseTime = Date.now() - startTime;
    
    if (!online) {
      try {
        const tcpStart = Date.now();
        const net = await import('net');
        const socket = new net.Socket();
        
        const connectPromise = new Promise<boolean>((resolve) => {
          const timeout = setTimeout(() => {
            socket.destroy();
            resolve(false);
          }, 300);
          
          socket.connect(80, ip, () => {
            clearTimeout(timeout);
            socket.destroy();
            resolve(true);
          });
          
          socket.on('error', () => {
            clearTimeout(timeout);
            socket.destroy();
            resolve(false);
          });
        });
        
        online = await connectPromise;
        if (online) {
          responseTime = Date.now() - tcpStart;
        }
      } catch {}
    }
    
  } catch (error) {
    online = false;
    responseTime = Date.now() - startTime;
  }
  
  history.attempts++;
  
  if (online) {
    history.successes++;
    history.lastSeen = new Date();
    history.consecutiveFailures = 0;
    history.avgResponseTime = (history.avgResponseTime + responseTime) / 2;
  } else {
    history.failures++;
    history.consecutiveFailures++;
  }
  
  const statusChanged = history.lastStatus !== online;
  history.lastStatus = online;
  
  if (statusChanged || history.consecutiveFailures === 1 || (online && history.consecutiveFailures === 0)) {
    await db.update(devices)
      .set({ status: online ? 1 : 0 })
      .where(eq(devices.ip, ip));
  }
  
  return {
    ip,
    online,
    responseTime,
    changed: statusChanged,
    timestamp: new Date().toISOString()
  };
}

function calculateNetworkReliability(network: string): string {
  const networkDevices = Object.entries(pingHistory)
    .filter(([ip]) => ip.startsWith(network))
    .map(([, history]) => history);
  
  if (networkDevices.length === 0) return '0.0';
  
  const avgReliability = networkDevices.reduce((sum, device) => 
    sum + (device.successes / Math.max(device.attempts, 1)), 0
  ) / networkDevices.length;
  
  return (avgReliability * 100).toFixed(1);
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

declare global {
  var fastMonitoringInterval: NodeJS.Timeout | null;
  var lastMonitoringRun: string;
}