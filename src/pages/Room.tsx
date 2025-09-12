import React, { useState, useRef, useEffect } from 'react';
import { 
  Activity, 
  Power, 
  Search,
  Monitor,
  Printer,
  Router,
  Smartphone,
  Server,
  Tablet,
  Move,
  Eye,
  EyeOff,
  Loader2,
  Save,
  RefreshCw,
  Filter,
  MapPin,
  Network,
  Building,
  Users,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import type { Device, Room, MapData} from '@/types';
import { apiService } from '@/services/api';


const showToast = (title: string, message?: string, variant?: 'destructive'): void => {
  console.log(`Toast: ${title}${message ? ` - ${message}` : ''}${variant ? ` (${variant})` : ''}`);
  
  if (variant === 'destructive') {
    console.error(`Error: ${title}${message ? ` - ${message}` : ''}`);
  }
};

const getDeviceIcon = (type: string, status: number) => {
  const iconClass = status === 1 ? "text-emerald-500" : "text-red-500";
  
  switch (type?.toLowerCase()) {
    case 'impressora':
      return <Printer className={`w-4 h-4 ${iconClass}`} />;
    case 'roteador':
      return <Router className={`w-4 h-4 ${iconClass}`} />;
    case 'computador':
    case 'desktop':
      return <Monitor className={`w-4 h-4 ${iconClass}`} />;
    case 'tablet':
      return <Tablet className={`w-4 h-4 ${iconClass}`} />;
    case 'smartphone':
      return <Smartphone className={`w-4 h-4 ${iconClass}`} />;
    case 'servidor':
      return <Server className={`w-4 h-4 ${iconClass}`} />;
    default:
      return status === 1 ? <Activity className="w-4 h-4 text-emerald-500" /> : <Power className="w-4 h-4 text-red-500" />;
  }
};

const StatusBadge: React.FC<{ status: number }> = ({ status }) => (
  <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
    status === 1 
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' 
      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
  }`}>
    <div className={`w-2 h-2 rounded-full mr-1 ${status === 1 ? 'bg-emerald-500' : 'bg-red-500'}`} />
    {status === 1 ? 'Online' : 'Offline'}
  </div>
);

const CollapsibleSection: React.FC<{
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  count?: number;
}> = ({ title, children, defaultOpen = true, count }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 hover:from-gray-100 hover:to-gray-200 dark:hover:from-gray-700 dark:hover:to-gray-600 transition-all duration-200 flex items-center justify-between text-left"
      >
        <div className="flex items-center space-x-2">
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <span className="font-semibold text-gray-900 dark:text-gray-100">{title}</span>
          {count !== undefined && (
            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs font-medium">
              {count}
            </span>
          )}
        </div>
      </button>
      {isOpen && (
        <div className="p-4 bg-white dark:bg-gray-800">
          {children}
        </div>
      )}
    </div>
  );
};

export default function NetworkMapViewer() {
  const [mapData, setMapData] = useState<MapData>({
    rooms: [],
    devices: [],
    sectors: [],
    device_types: []
  });
  const [selectedRoom, setSelectedRoom] = useState<number | null>(null);
  const [mode, setMode] = useState<'view' | 'move'>('view');
  const [filterType, setFilterType] = useState<string>('');
  const [filterSector, setFilterSector] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showDeviceLabels, setShowDeviceLabels] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMapData();
  }, []);

  const loadMapData = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiService.getMapData(1);
      setMapData(data);
    } catch (error) {
      console.error('Erro ao carregar dados do mapa:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setError('Erro ao carregar dados: ' + errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const savePositions = async (): Promise<void> => {
    try {
      setIsSaving(true);
      const positions = mapData.devices
        .filter(device => device.room_id && device.id != null)
        .map(device => ({
          device_id: Number(device.id),
          room_id: Number(device.room_id),
          x: device.x || 0,
          y: device.y || 0
        }));
      
      if (positions.length > 0) {
        await apiService.batchUpdatePositions(positions);
        showToast("Posições salvas", `${positions.length} posições foram salvas com sucesso.`);
      }
    } catch (error) {
      console.error('Erro ao salvar posições:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      showToast("Erro", "Erro ao salvar: " + errorMessage, "destructive");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredDevices = mapData.devices.filter(device => {
    const matchesSearch = device.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         device.ip.includes(searchTerm) ||
                         device.user?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = !filterType || device.type === filterType;
    const matchesSector = !filterSector || device.sector === filterSector;
    return matchesSearch && matchesType && matchesSector;
  });

  // Dispositivos sem sala (para exibir na lista)
  const devicesWithoutRoom = filteredDevices.filter(device => !device.room_id);

  const handleDeviceDrag = async (device: Device, newX: number, newY: number): Promise<void> => {
    const updatedDevices = mapData.devices.map(d => 
      d.id === device.id ? { ...d, x: newX, y: newY } : d
    );
    
    setMapData(prev => ({
      ...prev,
      devices: updatedDevices
    }));

    try {
      if (device.room_id && device.id != null) {
        await apiService.updateDevicePosition({
          device_id: Number(device.id),
          room_id: Number(device.room_id),
          x: newX,
          y: newY
        });
      }
    } catch (error) {
      console.error('Erro ao salvar posição do dispositivo:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      showToast("Erro", "Erro ao salvar posição: " + errorMessage, "destructive");
    }
  };

  const handleRoomDrag = async (room: Room, newX: number, newY: number): Promise<void> => {
    try {
      await apiService.updateRoom(room.id, { x: newX, y: newY });
      setMapData(prev => ({
        ...prev,
        rooms: prev.rooms.map(r => r.id === room.id ? { ...r, x: newX, y: newY } : r)
      }));
    } catch (error) {
      console.error('Erro ao mover sala:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      showToast("Erro", "Erro ao mover sala: " + errorMessage, "destructive");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-200 rounded-full animate-spin"></div>
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
          </div>
          <p className="mt-6 text-lg font-medium text-gray-700 dark:text-gray-300">Carregando dispositivos da rede...</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Aguarde enquanto sincronizamos os dados</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-red-50 to-pink-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <Network className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Erro de Conexão</h2>
          <p className="text-red-600 dark:text-red-400 mb-6">{error}</p>
          <button 
            onClick={loadMapData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 h-screen">
      <div className="w-96 h-full shadow-2xl flex flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
                <Network className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Mapa de Rede</h1>
                <p className="text-blue-100 text-sm">Visualizador</p>
              </div>
            </div>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={loadMapData}
              className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white border border-white border-opacity-30 rounded-lg transition-all"
              title="Atualizar dados"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={savePositions}
              disabled={isSaving}
              className="p-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-all disabled:opacity-50"
              title="Salvar posições"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              onClick={() => setMode('view')}
              className={`flex items-center justify-center p-2 rounded-lg transition-all ${
                mode === 'view' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              <Eye className="w-4 h-4 mr-2" />
              Visualizar
            </button>
            <button
              onClick={() => setMode('move')}
              className={`flex items-center justify-center p-2 rounded-lg transition-all ${
                mode === 'move' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              <Move className="w-4 h-4 mr-2" />
              Mover
            </button>
            <button
              onClick={() => setShowDeviceLabels(!showDeviceLabels)}
              className={`flex items-center justify-center p-2 rounded-lg transition-all col-span-2 ${
                showDeviceLabels 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              {showDeviceLabels ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
              Labels dos Dispositivos
            </button>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar dispositivos, IPs, usuários..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <Filter className="absolute left-3 top-3 h-4 w-4 text-gray-400 z-10" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              >
                <option value="">Todos os tipos</option>
                {mapData.device_types.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div className="relative">
              <Building className="absolute left-3 top-3 h-4 w-4 text-gray-400 z-10" />
              <select
                value={filterSector}
                onChange={(e) => setFilterSector(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              >
                <option value="">Todos os setores</option>
                {mapData.sectors.map(sector => (
                  <option key={sector} value={sector}>{sector}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <CollapsibleSection title="Salas" count={mapData.rooms.length}>
            <div className="space-y-3">
              {mapData.rooms.map(room => {
                const devicesInRoom = mapData.devices.filter(d => d.room_id === room.id);
                return (
                  <div
                    key={room.id}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                      selectedRoom === room.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 shadow-lg'
                        : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 hover:shadow-md'
                    }`}
                    onClick={() => setSelectedRoom(selectedRoom === room.id ? null : room.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <MapPin className="w-5 h-5 text-blue-600" />
                          <span className="font-semibold text-gray-900 dark:text-gray-100">{room.name}</span>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                          <div className="flex items-center space-x-1">
                            <Users className="w-4 h-4" />
                            <span>{devicesInRoom.length} dispositivos</span>
                          </div>
                          <div>{room.width}x{room.height}px</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CollapsibleSection>

          {/* Dispositivos sem sala */}
          {devicesWithoutRoom.length > 0 && (
            <CollapsibleSection title="Dispositivos sem Sala" count={devicesWithoutRoom.length}>
              <div className="space-y-2">
                {devicesWithoutRoom.map(device => (
                  <div
                    key={device.id}
                    className="flex items-center p-3 border border-gray-200 dark:border-gray-600 rounded-lg"
                  >
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="flex-shrink-0">
                        {getDeviceIcon(device.type, device.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {device.name || device.ip}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {device.user} • {device.ip} • {device.sector}
                        </p>
                      </div>
                      <StatusBadge status={device.status} />
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          <CollapsibleSection title="Dispositivos por Setor" count={filteredDevices.length}>
            <div className="space-y-4">
              {mapData.sectors.map(sector => {
                const devicesInSector = filteredDevices.filter(device => device.sector === sector);
                
                if (devicesInSector.length === 0) return null;

                return (
                  <div key={sector} className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                    <div className="px-4 py-3 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-900 dark:text-gray-100">{sector}</span>
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs font-medium">
                          {devicesInSector.length}
                        </span>
                      </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto bg-white dark:bg-gray-800">
                      {devicesInSector.map(device => (
                        <div
                          key={device.id}
                          className="flex items-center p-3 border-b border-gray-100 dark:border-gray-700"
                        >
                          <div className="flex items-center space-x-3 flex-1">
                            <div className="flex-shrink-0">
                              {getDeviceIcon(device.type, device.status)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                {device.name || device.ip}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {device.user} • {device.ip}
                              </p>
                            </div>
                            <StatusBadge status={device.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CollapsibleSection>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <div
          ref={mapRef}
          className="w-full h-full relative overflow-auto"
          style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
            backgroundImage: `
              radial-gradient(circle at 1px 1px, rgba(99, 102, 241, 0.15) 1px, transparent 0),
              radial-gradient(circle at 10px 10px, rgba(139, 92, 246, 0.1) 1px, transparent 0)
            `,
            backgroundSize: '20px 20px, 40px 40px',
            cursor: mode === 'move' ? 'move' : 'default'
          }}
        >
          {mapData.rooms.map(room => (
            <div
              key={room.id}
              className={`absolute border-2 rounded-2xl backdrop-blur-sm transition-all duration-200 ${
                selectedRoom === room.id
                  ? 'border-blue-500 bg-white bg-opacity-90 shadow-2xl scale-105'
                  : 'border-gray-300 bg-white bg-opacity-80 hover:border-blue-400 hover:shadow-xl'
              } ${mode === 'move' ? 'cursor-move' : 'cursor-pointer'}`}
              style={{
                left: room.x,
                top: room.y,
                width: room.width,
                height: room.height
              }}
              onMouseDown={(e: React.MouseEvent) => {
                if (mode !== 'move') return;
                e.preventDefault();
                
                const startX = e.clientX - room.x;
                const startY = e.clientY - room.y;
                
                const handleMouseMove = (e: MouseEvent) => {
                  const newX = Math.max(0, e.clientX - startX);
                  const newY = Math.max(0, e.clientY - startY);
                  handleRoomDrag(room, newX, newY);
                };
                
                const handleMouseUp = () => {
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                };
                
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
              }}
            >
              <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm truncate">{room.name}</h3>
                  <div className="flex items-center space-x-1 text-xs">
                    <Users className="w-3 h-3" />
                    <span>{mapData.devices.filter(d => d.room_id === room.id).length}</span>
                  </div>
                </div>
              </div>
              
              <div className="relative p-2" style={{ height: room.height - 50 }}>
                {mapData.devices
                  .filter(device => device.room_id === room.id)
                  .map(device => (
                    <div
                      key={device.id}
                      className={`absolute bg-white dark:bg-gray-800 border-2 border-gray-300 rounded-xl p-3 shadow-lg hover:shadow-2xl transition-all duration-200 transform hover:scale-110 ${
                        mode === 'move' ? 'cursor-move' : 'cursor-pointer'
                      } ${device.status === 1 ? 'border-emerald-300' : 'border-red-300'}`}
                      style={{
                        left: device.x || 50,
                        top: device.y || 50,
                        transform: 'translate(-50%, -50%)',
                        minWidth: '48px',
                        minHeight: '48px'
                      }}
                      onMouseDown={(e: React.MouseEvent) => {
                        if (mode !== 'move') return;
                        e.stopPropagation();
                        e.preventDefault();
                        
                        const rect = mapRef.current?.getBoundingClientRect();
                        if (!rect) return;
                        
                        const startX = e.clientX - rect.left - room.x - (device.x || 50);
                        const startY = e.clientY - rect.top - room.y - (device.y || 50);
                        
                        const handleMouseMove = (e: MouseEvent) => {
                          const newX = Math.max(25, Math.min(room.width - 25, e.clientX - rect.left - room.x - startX));
                          const newY = Math.max(60, Math.min(room.height - 25, e.clientY - rect.top - room.y - startY));
                          handleDeviceDrag(device, newX, newY);
                        };
                        
                        const handleMouseUp = () => {
                          document.removeEventListener('mousemove', handleMouseMove);
                          document.removeEventListener('mouseup', handleMouseUp);
                        };
                        
                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                      }}
                      title={`${device.name} (${device.ip}) - ${device.user}`}
                    >
                      <div className="flex items-center justify-center">
                        {getDeviceIcon(device.type, device.status)}
                      </div>
                      
                      {showDeviceLabels && (
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 bg-gray-900 bg-opacity-90 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap z-10 pointer-events-none">
                          <div className="font-medium">{device.name || device.ip}</div>
                          <div className="text-gray-300">{device.user}</div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
        
        <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 backdrop-blur-sm bg-opacity-90">
          <div className="flex justify-between items-center p-4">
            <div className="flex items-center space-x-6 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>
                  {mode === 'move' && 'Arraste salas e dispositivos para reposicioná-los'}
                  {mode === 'view' && 'Modo de visualização - clique em "Mover" para reposicionar elementos'}
                </span>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center space-x-1">
                  <Building className="w-4 h-4" />
                  <span>{mapData.rooms.length} salas</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Network className="w-4 h-4" />
                  <span>{mapData.devices.length} dispositivos</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span>{mapData.devices.filter(d => d.status === 1).length} online</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span>{mapData.devices.filter(d => d.status === 0).length} offline</span>
                </div>
              </div>
              
              {isSaving && (
                <div className="flex items-center text-emerald-600 dark:text-emerald-400">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  <span className="text-sm font-medium">Salvando...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}