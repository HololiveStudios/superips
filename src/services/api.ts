import axios, { AxiosInstance, AxiosError } from 'axios';
import type { Device } from '@/types';
import type {
  DiscoveryResult,
  NetworkDevice,
  NetworkDeviceDetails,
  PingResult,
  PortScanResult,
  SharesResult,
  TracerouteResult,
  MonitoringStatus,
  NetworkStats,
  NetworkAlerts,
  MonitoringHistory,
  RemoteCommandResult,
  SnmpResult,
  BandwidthResult,
  Switch,
  Rack,
  Router,
  Printer,
  Box,
  Room,
  DevicePosition
} from '@/types';

const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    console.error('API Error:', error.response?.data || error.message);
    throw error;
  }
);

class ApiService {
  async getDevices(): Promise<Device[]> {
    const response = await api.get('/devices');
    return response.data;
  }

  async createDevice(device: Partial<Device>): Promise<Device> {
    const response = await api.post('/devices', device);
    return response.data;
  }

  async updateDevice(id: number, device: Partial<Device>): Promise<Device> {
    const response = await api.put(`/devices/${id}`, device);
    return response.data;
  }
  
  async deleteDevice(id: number) {
    const response = await api.delete(`/devices/${id}`);
    return response.data;
  }

  async getRouters() {
    const response = await api.get('/routers');
    return response.data;
  }

  async updateRouter(id: number, routerData: Partial<Router>): Promise<Router> {
    const response = await api.put(`/routers/${id}`, routerData);
    return response.data;
  }

  async getPrinters() {
    const response = await api.get('/printers');
    return response.data;
  }

  async updatePrinter(id: number, printerData: Partial<Printer>): Promise<Printer> {
    const response = await api.put(`/printers/${id}`, printerData);
    return response.data;
  }
  
  async getBoxes() {
    const response = await api.get('/boxes');
    return response.data;
  }

  async updateBox(id: number, boxData: Partial<Box>): Promise<Box> {
    const response = await api.put(`/boxes/${id}`, boxData);
    return response.data;
  }

  async getRooms(): Promise<Room[]> {
    const response = await api.get('/rooms');
    return response.data;
  }

  async createRoom(room: Omit<Room, 'id'>): Promise<Room> {
    const response = await api.post('/rooms', room);
    return response.data;
  }

  async updateRoom(id: number, room: Partial<Room>): Promise<Room> {
    const response = await api.put(`/rooms/${id}`, room);
    return response.data;
  }

  async deleteRoom(id: number): Promise<void> {
    await api.delete(`/rooms/${id}`);
  }

  async getDevicePositions(): Promise<DevicePosition[]> {
    const response = await api.get('/device-positions');
    return response.data;
  }

  async updateDevicePosition(position: {
    device_id: number
    room_id: number
    x: number
    y: number
  }): Promise<DevicePosition> {
    const response = await api.post('/device-positions', position);
    return response.data;
  }

  async deleteDevicePosition(deviceId: number): Promise<void> {
    await api.delete(`/device-positions/${deviceId}`);
  }

  async batchUpdatePositions(positions: Array<{
    device_id: number;
    room_id: number;
    x: number;
    y: number;
  }>): Promise<{ success: boolean; updated: number }> {
    const response = await api.post('/device-positions/batch', { positions });
    return response.data;
  }

  async getMapData(floor?: number): Promise<{
    rooms: Room[];
    devices: DevicePosition[];
    sectors: string[];
    device_types: string[];
  }> {
    const params = floor ? { floor } : {};
    const response = await api.get('/map-data', { params });
    return response.data;
  }

  async getTasks() {
    const response = await api.get('/tasks');
    return response.data;
  }

  async createTask(taskData: any) {
    const response = await api.post('/tasks', taskData);
    return response.data;
  }

  async updateTask(id: number, taskData: any) {
    const response = await api.put(`/tasks/${id}`, taskData);
    return response.data;
  }

  async deleteTask(id: number) {
    const response = await api.delete(`/tasks/${id}`);
    return response.data;
  }

  async setupMonitoringTables(): Promise<{ success: boolean; message: string }> {
    const response = await api.post('/setup-monitoring-tables');
    return response.data;
  }

  async discoverNetworkDevices(): Promise<DiscoveryResult> {
    const response = await api.post('/network/discover');
    return response.data;
  }

  async getNetworkDevices(): Promise<NetworkDevice[]> {
    const response = await api.get('/network/devices');
    return response.data;
  }

  async getNetworkDevice(id: number): Promise<NetworkDeviceDetails> {
    const response = await api.get(`/network/devices/${id}`);
    return response.data;
  }

  async getAvailableIPs(network?: string): Promise<string[]> {
    const url = network 
      ? `/devices/available-ips?network=${network}`
      : '/devices/available-ips';
    
    const response = await api.get(url);
    return response.data.available.map((item: any) => item.ip);
  }

  async updateNetworkDevice(id: number, data: {
    hostname?: string;
    device_type?: string;
    vendor?: string;
    os_info?: string;
  }): Promise<NetworkDevice> {
    const response = await api.put(`/network/devices/${id}`, data);
    return response.data;
  }

  async deleteNetworkDevice(id: number): Promise<{ success: boolean; message: string }> {
    const response = await api.delete(`/network/devices/${id}`);
    return response.data;
  }

  async searchNetworkDevices(query: string, type: 'all' | 'ip' | 'hostname' | 'mac' = 'all'): Promise<NetworkDevice[]> {
    const response = await api.get(`/network/search?query=${encodeURIComponent(query)}&type=${type}`);
    return response.data;
  }

  async pingDevice(ip: string): Promise<PingResult> {
    const response = await api.post(`/network/ping/${ip}`);
    return response.data;
  }

  async scanPorts(ip: string, ports?: number[]): Promise<PortScanResult> {
    const response = await api.post(`/network/scan-ports/${ip}`, { ports });
    return response.data;
  }

  async checkRDP(ip: string): Promise<{ ip: string; rdp_available: boolean; port: number; checked_at: string }> {
    const response = await api.post(`/network/check-rdp/${ip}`);
    return response.data;
  }

  async checkShares(ip: string): Promise<SharesResult> {
    const response = await api.post(`/network/check-shares/${ip}`);
    return response.data;
  }

  async traceroute(ip: string): Promise<TracerouteResult> {
    const response = await api.post(`/network/traceroute/${ip}`);
    return response.data;
  }

  async startMonitoring(interval: number = 10): Promise<{ success: boolean; message: string }> {
    const response = await api.post('/network/monitoring/start', { interval });
    return response.data;
  }

  async stopMonitoring(): Promise<{ success: boolean; message: string }> {
    const response = await api.post('/network/monitoring/stop');
    return response.data;
  }

  async getMonitoringStatus(): Promise<MonitoringStatus> {
    const response = await api.get('/network/monitoring/status');
    return response.data;
  }

  async getNetworkStats(): Promise<NetworkStats> {
    const response = await api.get('/network/stats');
    return response.data;
  }

  async getNetworkAlerts(): Promise<NetworkAlerts> {
    const response = await api.get('/network/alerts');
    return response.data;
  }

  async getMonitoringHistory(deviceId: number, hours: number = 24): Promise<MonitoringHistory[]> {
    const response = await api.get(`/network/history/${deviceId}?hours=${hours}`);
    return response.data;
  }

  async exportNetworkData(format: 'json' | 'csv' | 'xlsx' = 'json'): Promise<any> {
    const response = await api.get(`/network/export?format=${format}`, {
      responseType: format === 'xlsx' ? 'blob' : 'json'
    });
    return response.data;
  }

  async executeRemoteCommand(data: {
    ip: string;
    command: string;
    username: string;
    password: string;
  }): Promise<RemoteCommandResult> {
    const response = await api.post('/network/remote-command', data);
    return response.data;
  }

  async snmpWalk(ip: string, data: {
    community?: string;
    oid?: string;
  } = {}): Promise<SnmpResult> {
    const response = await api.post(`/network/snmp-walk/${ip}`, data);
    return response.data;
  }

  async getBandwidthStats(networkInterface?: string): Promise<BandwidthResult> {
    const endpoint = networkInterface 
      ? `/network/bandwidth/${networkInterface}` 
      : '/network/bandwidth';
    const response = await api.get(endpoint);
    return response.data;
  }

  async getSwitches(): Promise<Switch[]> {
    const response = await api.get('/switches');
    return response.data;
  }

  async createSwitch(switchData: Partial<Switch>): Promise<Switch> {
    const response = await api.post('/switches', switchData);
    return response.data;
  }

  async updateSwitch(id: number, switchData: Partial<Switch>): Promise<Switch> {
    const response = await api.put(`/switches/${id}`, switchData);
    return response.data;
  }

  async deleteSwitch(id: number): Promise<{ message: string }> {
    const response = await api.delete(`/switches/${id}`);
    return response.data;
  }

  async getRacks(): Promise<Rack[]> {
    const response = await api.get('/racks');
    return response.data;
  }

  async createRack(rackData: Partial<Rack>): Promise<Rack> {
    const response = await api.post('/racks', rackData);
    return response.data;
  }

  async updateRack(id: number, rackData: Partial<Rack>): Promise<Rack> {
    const response = await api.put(`/racks/${id}`, rackData);
    return response.data;
  }

  async deleteRack(id: number): Promise<{ message: string }> {
    const response = await api.delete(`/racks/${id}`);
    return response.data;
  }

  async downloadExportedFile(format: 'xlsx' | 'csv' = 'xlsx', filename: string = 'network_devices'): Promise<void> {
    try {
      const response = await api.get(`/network/export?format=${format}`, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao baixar arquivo:', error);
      throw error;
    }
  }

  async pingMultipleDevices(ips: string[]): Promise<PingResult[]> {
    const promises = ips.map(ip => this.pingDevice(ip));
    const results = await Promise.allSettled(promises);
    
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          ip: ips[index],
          alive: false,
          time: 0,
          min: 0,
          max: 0,
          avg: 0,
          packetLoss: '100%'
        };
      }
    });
  }

  async fullDeviceScan(ip: string): Promise<{
    ping: PingResult;
    ports: PortScanResult;
    rdp: { rdp_available: boolean };
    shares: SharesResult;
  }> {
    try {
      const [ping, ports, rdp, shares] = await Promise.allSettled([
        this.pingDevice(ip),
        this.scanPorts(ip),
        this.checkRDP(ip),
        this.checkShares(ip)
      ]);

      return {
        ping: ping.status === 'fulfilled' ? ping.value : { ip, alive: false, time: 0, min: 0, max: 0, avg: 0, packetLoss: '100%' },
        ports: ports.status === 'fulfilled' ? ports.value : { ip, scanned_ports: [], open_ports: [], services: [] },
        rdp: rdp.status === 'fulfilled' ? rdp.value : { rdp_available: false },
        shares: shares.status === 'fulfilled' ? shares.value : { ip, shares: [] }
      };
    } catch (error) {
      console.error('Erro no scan completo:', error);
      throw error;
    }
  }

  isValidIP(ip: string): boolean {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
  }

  isValidMAC(mac: string): boolean {
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    return macRegex.test(mac);
  }

  formatResponseTime(time: number | null): string {
    if (!time) return 'N/A';
    return `${time}ms`;
  }

  formatLastSeen(lastSeen: string): string {
    const date = new Date(lastSeen);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Agora mesmo';
    if (minutes < 60) return `${minutes} min atrás`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h atrás`;
    return `${Math.floor(minutes / 1440)} dias atrás`;
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export const apiService = new ApiService();

export const {
  getDevices,
  createDevice,
  updateDevice,
  deleteDevice,
  getRouters,
  updateRouter,
  getPrinters,
  updatePrinter,
  getBoxes,
  updateBox,
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  setupMonitoringTables,
  discoverNetworkDevices,
  getNetworkDevices,
  getNetworkDevice,
  updateNetworkDevice,
  deleteNetworkDevice,
  searchNetworkDevices,
  pingDevice,
  scanPorts,
  checkRDP,
  checkShares,
  traceroute,
  startMonitoring,
  stopMonitoring,
  getMonitoringStatus,
  getNetworkStats,
  getNetworkAlerts,
  getMonitoringHistory,
  exportNetworkData,
  executeRemoteCommand,
  snmpWalk,
  getBandwidthStats,
  downloadExportedFile,
  pingMultipleDevices,
  fullDeviceScan,
  getSwitches,
  createSwitch,
  updateSwitch,
  deleteSwitch,
  getRacks,
  createRack,
  updateRack,
  deleteRack,
  isValidIP,
  isValidMAC,
  formatResponseTime,
  formatLastSeen,
  formatBytes
} = apiService;