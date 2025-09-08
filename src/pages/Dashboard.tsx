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
  RefreshCw
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
}

interface DeviceStats {
  total: number;
  online: number;
  offline: number;
}

interface Notification {
  type: 'warning' | 'critical';
  message: string;
  devices: Device[];
}

interface DashboardData {
  devices: Device[];
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
    loading: true,
    error: null,
    lastUpdate: new Date()
  });

  const loadData = async () => {
    try {
      setData(prev => ({ ...prev, loading: true }));
      const devices = await apiService.getDevices();
      
      const convertedData: Device[] = devices.map(device => ({
        ...device,
        status: Number(device.status) || 0
      }));
      
      setData({
        devices: convertedData,
        loading: false,
        error: null,
        lastUpdate: new Date()
      });
    } catch (error) {
      console.error('Erro ao carregar dispositivos:', error);
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

  const getDeviceStats = (): Record<string, DeviceStats> => {
    const stats = data.devices.reduce((acc: Record<string, DeviceStats>, device) => {
      const type = device.type;
      if (!acc[type]) {
        acc[type] = { total: 0, online: 0, offline: 0 };
      }
      acc[type].total++;
      if (device.status === 1) {
        acc[type].online++;
      } else {
        acc[type].offline++;
      }
      return acc;
    }, {});

    return stats;
  };

  const getTotalStats = (): DeviceStats => {
    const total = data.devices.length;
    const online = data.devices.filter(d => d.status === 1).length;
    const offline = total - online;
    return { total, online, offline };
  };

  const getNotifications = (): Notification[] => {
    const offline = data.devices.filter(d => d.status === 0);
    const notifications: Notification[] = [];

    if (offline.length > 0) {
      notifications.push({
        type: 'warning',
        message: `${offline.length} dispositivo(s) offline`,
        devices: offline
      });
    }

    const criticalDevices = offline.filter(d => d.type === 'Roteador');
    if (criticalDevices.length > 0) {
      notifications.push({
        type: 'critical',
        message: `Roteador offline detectado`,
        devices: criticalDevices
      });
    }

    return notifications;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Computador': return Monitor;
      case 'Impressora': return Printer;
      case 'Roteador': return Router;
      default: return Server;
    }
  };

  const deviceStats = getDeviceStats();
  const totalStats = getTotalStats();
  const notifications = getNotifications();

  return (
    <div>
      <div>
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Dashboard</h1>
            <p className="text-gray-400">
              Última atualização: {data.lastUpdate.toLocaleTimeString('pt-BR')}
            </p>
          </div>
          <button 
            onClick={refresh}
            disabled={data.loading}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg font-medium transition-all shadow-lg disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${data.loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-6 hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400 mb-1">Total de Dispositivos</p>
                <p className="text-3xl font-bold text-white transition-all duration-500">{totalStats.total}</p>
              </div>
              <div className="p-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transform transition-transform duration-300 hover:scale-110">
                <Server className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-6 hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400 mb-1">Dispositivos Online</p>
                <p className="text-3xl font-bold text-green-500 transition-all duration-500">{totalStats.online}</p>
              </div>
              <div className="p-3 bg-gradient-to-r from-green-500 to-green-600 rounded-full transform transition-transform duration-300 hover:scale-110">
                <Wifi className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-6 hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400 mb-1">Dispositivos Offline</p>
                <p className="text-3xl font-bold text-red-500 transition-all duration-500">{totalStats.offline}</p>
              </div>
              <div className="p-3 bg-gradient-to-r from-red-500 to-red-600 rounded-full transform transition-transform duration-300 hover:scale-110">
                <WifiOff className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-6 hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300">
            <h2 className="text-xl font-semibold mb-6 text-white">Dispositivos por Tipo</h2>
            <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
              {Object.entries(deviceStats).map(([type, stats]) => {
                const Icon = getTypeIcon(type);
                const percentage = Math.round((stats.online / stats.total) * 100);
                
                return (
                  <div key={type} className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Icon className="w-6 h-6 text-gray-300" />
                      <span className="font-medium text-white">{type}</span>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-green-400 font-medium">{stats.online} online</span>
                        <span className="text-gray-500">|</span>
                        <span className="text-red-400 font-medium">{stats.offline} offline</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Total: {stats.total} ({percentage}% online)
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-6 hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300">
            <h2 className="text-xl font-semibold mb-6 text-white">Notificações</h2>
            <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
              {notifications.length === 0 ? (
                <div className="flex items-center gap-3 p-4 bg-green-900 bg-opacity-50 border border-green-700 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                  <div>
                    <p className="font-medium text-green-300">Tudo funcionando</p>
                    <p className="text-sm text-green-400">Nenhum problema detectado</p>
                  </div>
                </div>
              ) : (
                notifications.map((notification, index) => (
                  <div 
                    key={index}
                    className={`flex items-start gap-3 p-4 rounded-lg border ${
                      notification.type === 'critical' 
                        ? 'bg-red-900 bg-opacity-50 border-red-700' 
                        : 'bg-yellow-900 bg-opacity-50 border-yellow-700'
                    }`}
                  >
                    <AlertTriangle className={`w-6 h-6 mt-1 ${
                      notification.type === 'critical' 
                        ? 'text-red-400' 
                        : 'text-yellow-400'
                    }`} />
                    <div className="flex-1">
                      <p className={`font-medium ${
                        notification.type === 'critical' 
                          ? 'text-red-300' 
                          : 'text-yellow-300'
                      }`}>
                        {notification.message}
                      </p>
                      <div className="mt-2 space-y-1">
                        {notification.devices.map(device => (
                          <p key={device.id} className={`text-sm ${
                            notification.type === 'critical' 
                              ? 'text-red-400' 
                              : 'text-yellow-400'
                          }`}>
                            {device.ip} - {device.type}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-6 hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300">
          <h2 className="text-xl font-semibold mb-6 text-white">Status da Rede</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-green-900 bg-opacity-50 border border-green-700 rounded-lg">
              <div className="text-2xl font-bold text-green-400">
                {Math.round((totalStats.online / totalStats.total) * 100)}%
              </div>
              <div className="text-sm text-green-300">Uptime Geral</div>
            </div>
            <div className="text-center p-4 bg-blue-900 bg-opacity-50 border border-blue-700 rounded-lg">
              <div className="text-2xl font-bold text-blue-400">{totalStats.total}</div>
              <div className="text-sm text-blue-300">Total Monitorados</div>
            </div>
            <div className="text-center p-4 bg-yellow-900 bg-opacity-50 border border-yellow-700 rounded-lg">
              <div className="text-2xl font-bold text-yellow-400">{notifications.length}</div>
              <div className="text-sm text-yellow-300">Alertas Ativos</div>
            </div>
            <div className="text-center p-4 bg-gray-700 border border-gray-600 rounded-lg">
              <div className="text-2xl font-bold text-gray-300">
                {Object.keys(deviceStats).length}
              </div>
              <div className="text-sm text-gray-400">Tipos de Dispositivos</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;