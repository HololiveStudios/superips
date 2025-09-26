import { useState, useEffect } from 'react';
import { 
  Server, 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  CheckCircle, 
  Monitor, 
  Printer, 
  Router,
  RefreshCw,
  Activity,
  Play,
  Pause,
  AlertCircle,
  TrendingUp,
  Eye,
  EyeOff
} from 'lucide-react';
import { apiService } from '../services/api';

interface Device {
  id: number;
  ip: string;
  name: string;
  type: string;
  user: string;
  sector: string;
  status: number;
  online?: DeviceStatus;
  created_at?: string;
  updated_at?: string;
  isMonitored?: boolean;
}

interface NetworkStats {
  total: number;
  online: number;
  offline: number;
  uptime_percentage: string;
  monitored: number;
  not_monitored: number; 
}

interface MonitoringStatus {
  running: boolean;
  interval: number;
  last_run?: string;
  devices_monitored: number;
  monitored_ranges?: string[];
}

interface NetworkStatsByType {
  [key: string]: {
    total: number;
    online: number;
    offline: number;
    uptime_percentage: string;
  };
}

interface Notification {
  type: 'warning' | 'critical' | 'info';
  message: string;
  devices: Device[];
}

interface DashboardData {
  devices: Device[];
  networkStats: NetworkStats | null;
  monitoringStatus: MonitoringStatus | null;
  loading: boolean;
  error: string | null;
  lastUpdate: Date;
}

enum DeviceStatus {
  OFFLINE = 0,
  ONLINE = 1
}

const Dashboard = () => {
  const [data, setData] = useState<DashboardData>({
    devices: [],
    networkStats: null,
    monitoringStatus: null,
    loading: true,
    error: null,
    lastUpdate: new Date()
  });

  const [isMonitoringToggling, setIsMonitoringToggling] = useState(false);
  const [showOnlyMonitored, setShowOnlyMonitored] = useState(true); 

  const MONITORED_RANGES = ['10.0.11', '10.4.11']; 
  const isDeviceMonitored = (ip: string): boolean => {
    return MONITORED_RANGES.some(range => ip.startsWith(range));
  };

  const loadData = async () => {
    try {
      setData(prev => ({ ...prev, loading: true }));
      
      const [devices, networkStatsResponse, monitoringStatus] = await Promise.allSettled([
        apiService.getDevices(),
        fetch(`${import.meta.env.VITE_API_URL}/monitoring/network-status`).then(r => r.json()),
        fetch(`${import.meta.env.VITE_API_URL}/monitoring/status`).then(r => r.json()).catch(() => ({ running: false, interval: 0, devices_monitored: 0 }))
      ]);
      
      const convertedDevices = devices.status === 'fulfilled' 
        ? devices.value.map(device => ({
            ...device,
            status: Number(device.status) || 0,
            isMonitored: isDeviceMonitored(device.ip)
          }))
        : [];

      const monitoredDevices = convertedDevices.filter(d => d.isMonitored);
      const notMonitoredDevices = convertedDevices.filter(d => !d.isMonitored);

      const stats = monitoredDevices.length > 0 ? {
        total: convertedDevices.length,
        monitored: monitoredDevices.length,
        not_monitored: notMonitoredDevices.length,
        online: monitoredDevices.filter(d => d.status === 1).length,
        offline: monitoredDevices.filter(d => d.status === 0).length,
        uptime_percentage: ((monitoredDevices.filter(d => d.status === 1).length / monitoredDevices.length) * 100).toFixed(1)
      } : { 
        total: convertedDevices.length, 
        monitored: 0,
        not_monitored: convertedDevices.length,
        online: 0, 
        offline: 0, 
        uptime_percentage: '0.0' 
      };

      setData({
        devices: convertedDevices,
        networkStats: stats,
        monitoringStatus: monitoringStatus.status === 'fulfilled' ? {
          ...monitoringStatus.value,
          monitored_ranges: MONITORED_RANGES
        } : null,
        loading: false,
        error: null,
        lastUpdate: new Date()
      });
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setData(prev => ({ 
        ...prev, 
        loading: false,
        error: error instanceof Error ? error.message : 'Erro ao carregar dados'
      }));
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const refresh = () => {
    loadData();
  };

  const toggleMonitoring = async () => {
    try {
      setIsMonitoringToggling(true);
      
      if (data.monitoringStatus?.running) {
        await fetch(`${import.meta.env.VITE_API_URL}/monitoring/stop-monitoring`, {
          method: 'POST'
        });
      } else {
        await fetch(`${import.meta.env.VITE_API_URL}/monitoring/start-ultra-fast-monitoring`, {
          method: 'POST'
        });
      }
      
      setData(prev => ({
        ...prev,
        monitoringStatus: prev.monitoringStatus ? {
          ...prev.monitoringStatus,
          running: !prev.monitoringStatus.running
        } : null
      }));
      
      setTimeout(loadData, 2000);
    } catch (error) {
      console.error('Erro ao alterar monitoramento:', error);
    } finally {
      setIsMonitoringToggling(false);
    }
  };

  const startNetworkPing = async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/monitoring/ping-all-ultra-fast`, {
        method: 'POST'
      });
      setTimeout(loadData, 2000);
    } catch (error) {
      console.error('Erro ao executar ping:', error);
    }
  };

  const getDeviceStats = (): Record<string, { total: number; online: number; offline: number; monitored: number }> => {
    const devicesToAnalyze = showOnlyMonitored 
      ? data.devices.filter(d => d.isMonitored)
      : data.devices;

    const stats = devicesToAnalyze.reduce((acc: Record<string, { total: number; online: number; offline: number; monitored: number }>, device) => {
      const type = device.type?.trim();

      if (!type) return acc;

      if (!acc[type]) {
        acc[type] = { total: 0, online: 0, offline: 0, monitored: 0 };
      }

      acc[type].total++;
      if (device.isMonitored) {
        acc[type].monitored++;
        if (device.status === 1) {
          acc[type].online++;
        } else {
          acc[type].offline++;
        }
      }

      return acc;
    }, {});

    return stats;
  };

  const isValidField = (value: any) => {
    return value !== null &&
           value !== undefined &&
           String(value).trim() !== '' &&
           String(value).toLowerCase() !== 'desconhecido';
  };

  const getNotifications = (): Notification[] => {
    const notifications: Notification[] = [];

    const validMonitoredDevices = data.devices.filter(d => {
      return d.isMonitored && d.status === 0 &&
             isValidField(d.type) &&
             isValidField(d.name) &&
             isValidField(d.sector);
    });

    if (validMonitoredDevices.length > 0) {
      notifications.push({
        type: 'warning',
        message: `${validMonitoredDevices.length} dispositivo(s) monitorado(s) offline`,
        devices: validMonitoredDevices.slice(0, 5)
      });
    }

    const criticalDevices = validMonitoredDevices.filter(d => d.type?.toLowerCase() === 'roteador');
    if (criticalDevices.length > 0) {
      notifications.push({
        type: 'critical',
        message: `Roteador monitorado offline detectado`,
        devices: criticalDevices
      });
    }

    const notMonitoredCount = data.devices.filter(d => !d.isMonitored).length;
    if (notMonitoredCount > 0 && !showOnlyMonitored) {
      notifications.push({
        type: 'info',
        message: `${notMonitoredCount} dispositivo(s) não estão sendo monitorados`,
        devices: data.devices.filter(d => !d.isMonitored).slice(0, 3)
      });
    }

    return notifications;
  };

  const getTypeIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'computador': return Monitor;
      case 'impressora': return Printer;
      case 'roteador': return Router;
      default: return Server;
    }
  };

  const deviceStats = getDeviceStats();
  const notifications = getNotifications();

  return (
    <div>
      <div>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Dashboard de Monitoramento</h1>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => setShowOnlyMonitored(!showOnlyMonitored)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all shadow-lg ${
                showOnlyMonitored
                  ? 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
            >
              {showOnlyMonitored ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              {showOnlyMonitored ? 'Só Monitorados' : 'Todos'}
            </button>
            <button 
              onClick={startNetworkPing}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white rounded-lg font-medium transition-all shadow-lg"
            >
              <Activity className="w-4 h-4" />
              Ping Rede
            </button>
            <button 
              onClick={toggleMonitoring}
              disabled={isMonitoringToggling}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all shadow-lg disabled:opacity-50 ${
                data.monitoringStatus?.running
                  ? 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white'
                  : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white'
              }`}
            >
              {data.monitoringStatus?.running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {data.monitoringStatus?.running ? 'Parar' : 'Iniciar'} Monitoramento
            </button>
            <button 
              onClick={refresh}
              disabled={data.loading}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white rounded-lg font-medium transition-all shadow-lg disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${data.loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-6 hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400 mb-1">Monitorados</p>
                <p className="text-3xl font-bold text-purple-400 transition-all duration-500">{data.networkStats?.monitored || 0}</p>
              </div>
              <div className="p-3 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transform transition-transform duration-300 hover:scale-110">
                <Eye className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-6 hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400 mb-1">Online</p>
                <p className="text-3xl font-bold text-green-500 transition-all duration-500">{data.networkStats?.online || 0}</p>
              </div>
              <div className="p-3 bg-gradient-to-r from-green-500 to-green-600 rounded-full transform transition-transform duration-300 hover:scale-110">
                <Wifi className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-6 hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400 mb-1">Offline</p>
                <p className="text-3xl font-bold text-red-500 transition-all duration-500">{data.networkStats?.offline || 0}</p>
              </div>
              <div className="p-3 bg-gradient-to-r from-red-500 to-red-600 rounded-full transform transition-transform duration-300 hover:scale-110">
                <WifiOff className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-6 hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400 mb-1">Uptime</p>
                <p className="text-3xl font-bold text-blue-400 transition-all duration-500">{data.networkStats?.uptime_percentage || 0}%</p>
              </div>
              <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transform transition-transform duration-300 hover:scale-110">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-6 hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-white">Dispositivos por Tipo</h2>
              <span className="text-sm text-gray-400">
                {showOnlyMonitored ? 'Apenas monitorados' : 'Todos os dispositivos'}
              </span>
            </div>
            <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
              {Object.entries(deviceStats).map(([type, stats]) => {
                const Icon = getTypeIcon(type);
                const percentage = stats.monitored > 0 ? Math.round((stats.online / stats.monitored) * 100) : 0;
                
                return (
                  <div key={type} className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Icon className="w-6 h-6 text-gray-300" />
                      <div>
                        <span className="font-medium text-white block">{type}</span>
                        <span className="text-xs text-gray-400">
                          {stats.monitored} de {stats.total} monitorados
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-green-400 font-medium">{stats.online} online</span>
                        <span className="text-gray-500">|</span>
                        <span className="text-red-400 font-medium">{stats.offline} offline</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        ({percentage}% uptime)
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-6 hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300">
            <h2 className="text-xl font-semibold mb-6 text-white">Alertas e Notificações</h2>
            <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
              {notifications.length === 0 ? (
                <div className="flex items-center gap-3 p-4 bg-green-900 bg-opacity-50 border border-green-700 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                  <div>
                    <p className="font-medium text-green-300">Dispositivos Monitorados OK</p>
                    <p className="text-sm text-green-400">Todos os dispositivos monitorados estão funcionando</p>
                  </div>
                </div>
              ) : (
                notifications.map((notification, index) => (
                  <div 
                    key={index}
                    className={`flex items-start gap-3 p-4 rounded-lg border ${
                      notification.type === 'critical' 
                        ? 'bg-red-900 bg-opacity-50 border-red-700' 
                        : notification.type === 'warning'
                        ? 'bg-yellow-900 bg-opacity-50 border-yellow-700'
                        : 'bg-blue-900 bg-opacity-50 border-blue-700'
                    }`}
                  >
                    <AlertTriangle className={`w-6 h-6 mt-1 ${
                      notification.type === 'critical' 
                        ? 'text-red-400' 
                        : notification.type === 'warning'
                        ? 'text-yellow-400'
                        : 'text-blue-400'
                    }`} />
                    <div className="flex-1">
                      <p className={`font-medium ${
                        notification.type === 'critical' 
                          ? 'text-red-300' 
                          : notification.type === 'warning'
                          ? 'text-yellow-300'
                          : 'text-blue-300'
                      }`}>
                        {notification.message}
                      </p>
                      <div className="mt-2 space-y-1">
                        {notification.devices.slice(0, 3).map(device => (
                          <p key={device.id} className={`text-sm ${
                            notification.type === 'critical' 
                              ? 'text-red-400' 
                              : notification.type === 'warning'
                              ? 'text-yellow-400'
                              : 'text-blue-400'
                          }`}>
                            {device.ip} - {device.name || device.type} 
                            {device.isMonitored ? ' (monitorado)' : ' (não monitorado)'}
                          </p>
                        ))}
                        {notification.devices.length > 3 && (
                          <p className="text-xs text-gray-400">
                            ... e mais {notification.devices.length - 3} dispositivos
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-6 hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300">
          <h2 className="text-xl font-semibold mb-6 text-white">Resumo da Rede</h2>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="text-center p-4 bg-green-900 bg-opacity-50 border border-green-700 rounded-lg">
              <div className="text-2xl font-bold text-green-400">
                {data.networkStats?.uptime_percentage || '0'}%
              </div>
              <div className="text-sm text-green-300">Uptime Monitorados</div>
            </div>
            <div className="text-center p-4 bg-purple-900 bg-opacity-50 border border-purple-700 rounded-lg">
              <div className="text-2xl font-bold text-purple-400">{data.networkStats?.monitored || 0}</div>
              <div className="text-sm text-purple-300">Sendo Monitorados</div>
            </div>
            <div className="text-center p-4 bg-gray-700 border border-gray-600 rounded-lg">
              <div className="text-2xl font-bold text-gray-300">{data.networkStats?.not_monitored || 0}</div>
              <div className="text-sm text-gray-400">Não Monitorados</div>
            </div>
            <div className="text-center p-4 bg-yellow-900 bg-opacity-50 border border-yellow-700 rounded-lg">
              <div className="text-2xl font-bold text-yellow-400">
                {notifications.filter(n => n.type !== 'info').length}
              </div>
              <div className="text-sm text-yellow-300">Alertas Críticos</div>
            </div>
            <div className="text-center p-4 bg-blue-900 bg-opacity-50 border border-blue-700 rounded-lg">
              <div className="text-2xl font-bold text-blue-400">
                {MONITORED_RANGES.length}
              </div>
              <div className="text-sm text-blue-300">Faixas Monitoradas</div>
            </div>
            <div className="text-center p-4 bg-gray-700 border border-gray-600 rounded-lg">
              <div className="text-2xl font-bold text-gray-300">
                {data.monitoringStatus?.running ? 'Ativo' : 'Inativo'}
              </div>
              <div className="text-sm text-gray-400">Status Monitoramento</div>
            </div>
          </div>
        </div>

        {data.error && (
          <div className="mt-6 p-4 bg-red-900 bg-opacity-50 border border-red-700 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-400" />
            <div>
              <p className="font-medium text-red-300">Erro no Dashboard</p>
              <p className="text-sm text-red-400">{data.error}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;