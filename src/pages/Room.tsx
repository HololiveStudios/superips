import { useState, useRef, useEffect } from 'react';
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
  RefreshCw,
  MapPin,
  Network,
  Building,
  Users,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

interface Device {
  id: number;
  ip: string;
  name?: string;
  type: string;
  user?: string;
  sector: string;
  status: number;
  room_id?: number | null;
  x?: number | null;
  y?: number | null;
}

interface Room {
  id: number;
  name: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

interface DevicePosition {
  id: number;
  device_id: number;
  room_id: number;
  x: number;
  y: number;
}

interface PositionData {
  device_id: number;
  room_id: number;
  x: number;
  y: number;
}

const apiService = {
  async getDevices(): Promise<Device[]> {
    const response = await fetch('http://10.0.11.150:5173/api/devices');
    return response.json();
  },
  
  async getRooms(): Promise<Room[]> {
    const response = await fetch('http://10.0.11.150:5173/api/rooms');
    return response.json();
  },
  
  async getDevicePositions(): Promise<DevicePosition[]> {
    const response = await fetch('http://10.0.11.150:5173/api/device-positions');
    return response.json();
  },
  
  async createInitialPositions(positions: PositionData[]): Promise<{ success: boolean; updated: number }> {
    const response = await fetch('http://10.0.11.150:5173/api/device-positions/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positions })
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  },
  
  async updateDevicePosition(position: PositionData): Promise<DevicePosition> {
    const response = await fetch('http://10.0.11.150:5173/api/device-positions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(position)
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  },
  
  async updateRoom(id: number, roomData: Partial<Room>): Promise<Room> {
    const response = await fetch(`http://10.0.11.150:5173/api/rooms/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(roomData)
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }
};

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
  const [devices, setDevices] = useState<Device[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<number | null>(null);
  const [mode, setMode] = useState<'view' | 'move' | 'edit'>('view');
  const [filterType, setFilterType] = useState<string>('');
  const [filterSector, setFilterSector] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showDeviceLabels, setShowDeviceLabels] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const generateInitialPositions = (roomDevices: Device[], roomWidth: number = 300): PositionData[] => {
    const spacing = 60;
    const marginX = 30;
    const marginY = 70;
    const cols = Math.max(1, Math.floor((roomWidth - marginX * 2) / spacing));
    
    return roomDevices.map((device: Device, index: number): PositionData => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      const x = marginX + col * spacing;
      const y = marginY + row * spacing;
      
      return {
        device_id: device.id,
        room_id: device.room_id!,
        x,
        y
      };
    });
  };

const generateInitialRoomPositions = (rooms: Room[]): Room[] => {
  const roomSpacing = 50;
  const roomsPerRow = 3;
  
  return rooms.map((room: Room, index: number): Room => {
    // ✅ CORREÇÃO: Verificar null E undefined
    if (room.x !== null && room.x !== undefined && room.y !== null && room.y !== undefined) {
      return room;
    }
    
    const row = Math.floor(index / roomsPerRow);
    const col = index % roomsPerRow;
    const x = 100 + col * ((room.width || 300) + roomSpacing);
    const y = 100 + row * ((room.height || 200) + roomSpacing);
    
    return { 
      ...room, 
      x, 
      y,
      width: room.width || 300,
      height: room.height || 200
    };
  });
};

// 2. Função loadData corrigida
const loadData = async () => {
  try {
    setIsLoading(true);
    setError(null);
    
    console.log('Carregando dados...'); // Debug
    
    const [devicesData, roomsData, positionsData] = await Promise.all([
      apiService.getDevices(),
      apiService.getRooms(),
      apiService.getDevicePositions()
    ]);
    
    console.log('Dados das salas recebidos:', roomsData); // Debug
    
    // ✅ CORREÇÃO: Garantir que as salas tenham posições válidas
    const roomsWithPositions = roomsData.map((room: Room) => ({
      ...room,
      x: room.x ?? 100,
      y: room.y ?? 100,
      width: room.width ?? 300,
      height: room.height ?? 200
    }));
    
    console.log('Salas com posições processadas:', roomsWithPositions); // Debug
    
    const positionsMap: Record<number, DevicePosition> = {};
    positionsData.forEach((pos: DevicePosition) => {
      positionsMap[pos.device_id] = pos;
    });
    
    const devicesWithRooms = devicesData.map((device: Device) => {
      const room = roomsWithPositions.find((r: Room) => r.name === device.sector);
      const position = positionsMap[device.id];
      
      return {
        ...device,
        room_id: room?.id || null,
        x: position?.x ?? null,
        y: position?.y ?? null
      } as Device;
    });
      
      const devicesWithoutPosition = devicesWithRooms.filter((d: Device) => 
        d.room_id !== null && (d.x === null || d.y === null)
      );
      
      if (devicesWithoutPosition.length > 0) {
        const devicesBySector: Record<string, Device[]> = {};
        devicesWithoutPosition.forEach((device: Device) => {
          if (device.sector) {
            if (!devicesBySector[device.sector]) {
              devicesBySector[device.sector] = [];
            }
            devicesBySector[device.sector].push(device);
          }
        });
        
        const positionsToCreate: PositionData[] = [];
        
        Object.entries(devicesBySector).forEach(([sectorName, roomDevices]) => {
          const room = roomsWithPositions.find((r: Room) => r.name === sectorName);
          if (!room) return;
          
          const initialPositions = generateInitialPositions(
            roomDevices, 
            room.width || 300
          );
          
          positionsToCreate.push(...initialPositions);
        });
        
        if (positionsToCreate.length > 0) {
          try {
            await apiService.createInitialPositions(positionsToCreate);
            
            positionsToCreate.forEach((pos: PositionData) => {
              const device = devicesWithRooms.find((d: Device) => d.id === pos.device_id);
              if (device) {
                device.x = pos.x;
                device.y = pos.y;
              }
            });
          } catch (error) {
            console.error('Erro ao criar posições iniciais:', error);
            showToast("Aviso", "Erro ao criar posições iniciais dos dispositivos", "destructive");
          }
        }
      }

   setDevices(devicesWithRooms);
    setRooms(roomsWithPositions);
    
    console.log('Salas definidas no state:', roomsWithPositions); // Debug
    
  } catch (error: unknown) {
    console.error('Erro ao carregar dados:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    setError('Erro ao carregar dados: ' + errorMessage);
  } finally {
    setIsLoading(false);
  }
};

  const getDeviceRoom = (device: Device): Room | undefined => {
    return rooms.find((room: Room) => room.name === device.sector);
  };

  const filteredDevices = devices.filter((device: Device) => {
    const matchesSearch = device.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         device.ip.includes(searchTerm) ||
                         device.user?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = !filterType || device.type === filterType;
    const matchesSector = !filterSector || device.sector === filterSector;
    return matchesSearch && matchesType && matchesSector;
  });

  const devicesWithoutRoom = filteredDevices.filter((device: Device) => !getDeviceRoom(device));

  const handleDeviceDrag = async (device: Device, newX: number, newY: number) => {
    const room = getDeviceRoom(device);
    if (!room) return;

    setDevices(prevDevices => 
      prevDevices.map((d: Device) => 
        d.id === device.id ? { ...d, x: newX, y: newY } : d
      )
    );

    if (mode === 'move') {
      try {
        await apiService.updateDevicePosition({
          device_id: device.id,
          room_id: room.id,
          x: newX,
          y: newY
        });
      } catch (error: unknown) {
        console.error('Erro ao salvar posição do dispositivo:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        showToast("Erro", "Erro ao salvar posição: " + errorMessage, "destructive");
        
        setDevices(prevDevices => 
          prevDevices.map((d: Device) => 
            d.id === device.id ? { ...d, x: device.x, y: device.y } : d
          )
        );
      }
    } else if (mode === 'edit') {
      setHasUnsavedChanges(true);
    }
  };

// 3. Função handleRoomDrag corrigida
const handleRoomDrag = async (room: Room, newX: number, newY: number) => {
  console.log('Movendo sala:', { id: room.id, newX, newY, mode }); // Debug
  
  // Atualiza estado local imediatamente
  setRooms(prevRooms => 
    prevRooms.map((r: Room) => 
      r.id === room.id ? { ...r, x: newX, y: newY } : r
    )
  );

  if (mode === 'move') {
    try {
      console.log('Salvando posição da sala no modo move...'); // Debug
      const updatedRoom = await apiService.updateRoom(room.id, { x: newX, y: newY });
      console.log('Sala salva com sucesso:', updatedRoom); // Debug
    } catch (error: unknown) {
      console.error('Erro ao mover sala:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      showToast("Erro", "Erro ao mover sala: " + errorMessage, "destructive");
      
      // Reverter mudança em caso de erro
      setRooms(prevRooms => 
        prevRooms.map((r: Room) => 
          r.id === room.id ? { ...r, x: room.x, y: room.y } : r
        )
      );
    }
  } else if (mode === 'edit') {
    setHasUnsavedChanges(true);
    console.log('Marcando como alteração não salva no modo edit'); // Debug
  }
};

// 4. Função handleRoomResize corrigida
const handleRoomResize = (room: Room, newWidth: number, newHeight: number) => {
  console.log('Redimensionando sala:', { id: room.id, newWidth, newHeight }); // Debug
  
  setRooms(prevRooms => 
    prevRooms.map((r: Room) => 
      r.id === room.id ? { ...r, width: newWidth, height: newHeight } : r
    )
  );
  setHasUnsavedChanges(true);
};

// 5. Função saveAllChanges corrigida
const saveAllChanges = async () => {
  setIsSaving(true);
  let errors: string[] = [];
  
  console.log('Salvando todas as alterações...', { rooms, devices }); // Debug

  try {
    const roomPromises = rooms.map(async (room) => {
      try {
        console.log('Salvando sala:', room); // Debug
        const updatedRoom = await apiService.updateRoom(room.id, {
          x: room.x,
          y: room.y,
          width: room.width,
          height: room.height
        });
        console.log('Sala salva:', updatedRoom); // Debug
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        errors.push(`Erro ao salvar sala ${room.name}: ${errorMessage}`);
        console.error(`Erro ao salvar sala ${room.name}:`, error);
      }
    });

    const devicePromises = devices
      .filter(device => device.room_id !== null && device.x !== null && device.y !== null)
      .map(async (device) => {
        try {
          await apiService.updateDevicePosition({
            device_id: device.id,
            room_id: device.room_id!,
            x: device.x!,
            y: device.y!
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
          errors.push(`Erro ao salvar dispositivo ${device.name || device.ip}: ${errorMessage}`);
        }
      });

    await Promise.all([...roomPromises, ...devicePromises]);

    if (errors.length === 0) {
      setHasUnsavedChanges(false);
      showToast("Sucesso", "Todas as alterações foram salvas!");
      console.log('Todas as alterações salvas com sucesso'); // Debug
    } else {
      showToast("Aviso", `${errors.length} erro(s) ocorreram ao salvar`, "destructive");
      console.error('Erros durante salvamento:', errors);
    }

  } catch (error) {
    console.error('Erro geral ao salvar:', error);
    showToast("Erro", "Erro ao salvar alterações", "destructive");
  } finally {
    setIsSaving(false);
  }
};

  const discardChanges = () => {
    loadData();
    setHasUnsavedChanges(false);
    setMode('view');
  };

  const sectors = [...new Set(devices.map((d: Device) => d.sector).filter(Boolean))];
  const deviceTypes = [...new Set(devices.map((d: Device) => d.type).filter(Boolean))];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-200 rounded-full animate-spin"></div>
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
          </div>
          <p className="mt-6 text-lg font-medium text-gray-700 dark:text-gray-300">Carregando dispositivos da rede...</p>
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
            onClick={loadData}
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

          <button
            onClick={loadData}
            className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white border border-white border-opacity-30 rounded-lg transition-all"
            title="Atualizar dados"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="grid grid-cols-3 gap-2 mb-4">
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
              onClick={() => setMode('edit')}
              className={`flex items-center justify-center p-2 rounded-lg transition-all ${
                mode === 'edit' 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              <Network className="w-4 h-4 mr-2" />
              Editar
            </button>
            <button
              onClick={() => setShowDeviceLabels(!showDeviceLabels)}
              className={`flex items-center justify-center p-2 rounded-lg transition-all col-span-3 ${
                showDeviceLabels 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              {showDeviceLabels ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
              Labels dos Dispositivos
            </button>
          </div>

          {(mode === 'edit' && hasUnsavedChanges) && (
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-yellow-800 dark:text-yellow-200">Alterações não salvas</span>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={discardChanges}
                    className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                    disabled={isSaving}
                  >
                    Descartar
                  </button>
                  <button
                    onClick={saveAllChanges}
                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                    disabled={isSaving}
                  >
                    {isSaving ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="relative mb-4">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar dispositivos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="">Todos os tipos</option>
              {deviceTypes.map((type: string) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <select
              value={filterSector}
              onChange={(e) => setFilterSector(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="">Todos os setores</option>
              {sectors.map((sector: string) => (
                <option key={sector} value={sector}>{sector}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <CollapsibleSection title="Salas" count={rooms.length}>
            <div className="space-y-3">
              {rooms.map((room: Room) => {
                const devicesInRoom = devices.filter((d: Device) => d.sector === room.name);
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
                          <div>{room.width || 300}x{room.height || 200}px</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CollapsibleSection>

          {devicesWithoutRoom.length > 0 && (
            <CollapsibleSection title="Dispositivos sem Sala" count={devicesWithoutRoom.length}>
              <div className="space-y-2">
                {devicesWithoutRoom.map((device: Device) => (
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
            cursor: mode === 'move' || mode === 'edit' ? 'move' : 'default'
          }}
        >
          {rooms.map((room: Room) => {
            const devicesInRoom = filteredDevices.filter((device: Device) => device.sector === room.name);
            return (
              <div
                key={room.id}
                className={`absolute border-2 rounded-2xl backdrop-blur-sm transition-all duration-200 ${
                  selectedRoom === room.id
                    ? 'border-blue-500 bg-white bg-opacity-90 shadow-2xl scale-105'
                    : 'border-gray-300 bg-white bg-opacity-80 hover:border-blue-400 hover:shadow-xl'
                } ${mode === 'move' || mode === 'edit' ? 'cursor-move' : 'cursor-pointer'}`}
                style={{
                  left: room.x || 100,
                  top: room.y || 100,
                  width: room.width || 300,
                  height: room.height || 200
                }}
                onMouseDown={(e) => {
                  if (mode === 'view') {
                    setSelectedRoom(selectedRoom === room.id ? null : room.id);
                    return;
                  }
                  if (mode !== 'move' && mode !== 'edit') return;
                  e.preventDefault();
                  
                  const rect = mapRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  
                  const startX = e.clientX - rect.left - (room.x || 100);
                  const startY = e.clientY - rect.top - (room.y || 100);
                  
                  const handleMouseMove = (e: MouseEvent) => {
                    const newX = Math.max(0, e.clientX - rect.left - startX);
                    const newY = Math.max(0, e.clientY - rect.top - startY);
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
                      <span>{devicesInRoom.length}</span>
                    </div>
                  </div>
                </div>
                
                <div className="relative p-2" style={{ height: (room.height || 200) - 50 }}>
                  {devicesInRoom
                    .filter(device => device.x !== null && device.y !== null)
                    .map((device: Device) => (
                    <div
                      key={device.id}
                      className={`absolute bg-white dark:bg-gray-800 border-2 border-gray-300 rounded-xl p-3 shadow-lg hover:shadow-2xl transition-all duration-200 transform hover:scale-110 ${
                        mode === 'move' || mode === 'edit' ? 'cursor-move' : 'cursor-pointer'
                      } ${device.status === 1 ? 'border-emerald-300' : 'border-red-300'}`}
                      style={{
                        left: device.x || 50,
                        top: device.y || 50,
                        transform: 'translate(-50%, -50%)',
                        minWidth: '48px',
                        minHeight: '48px'
                      }}
                      onMouseDown={(e) => {
                        if (mode !== 'move' && mode !== 'edit') return;
                        e.stopPropagation();
                        e.preventDefault();
                        
                        const rect = mapRef.current?.getBoundingClientRect();
                        if (!rect) return;
                        
                        const startX = e.clientX - rect.left - (room.x || 100) - (device.x || 50);
                        const startY = e.clientY - rect.top - (room.y || 100) - (device.y || 50);
                        
                        const handleMouseMove = (e: MouseEvent) => {
                          const roomWidth = room.width || 300;
                          const roomHeight = room.height || 200;
                          const newX = Math.max(25, Math.min(roomWidth - 25, e.clientX - rect.left - (room.x || 100) - startX));
                          const newY = Math.max(60, Math.min(roomHeight - 25, e.clientY - rect.top - (room.y || 100) - startY));
                          handleDeviceDrag(device, newX, newY);
                        };
                        
                        const handleMouseUp = () => {
                          document.removeEventListener('mousemove', handleMouseMove);
                          document.removeEventListener('mouseup', handleMouseUp);
                        };
                        
                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                      }}
                      title={`${device.name || device.ip} - ${device.user}`}
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

                {mode === 'edit' && (
                  <>
                    <div
                      className="absolute bottom-0 right-0 w-4 h-4 bg-purple-500 rounded-tl-lg cursor-se-resize opacity-70 hover:opacity-100 transition-opacity"
                      style={{ transform: 'translate(50%, 50%)' }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        
                        const rect = mapRef.current?.getBoundingClientRect();
                        if (!rect) return;
                        
                        const startWidth = room.width || 300;
                        const startHeight = room.height || 200;
                        const startX = e.clientX;
                        const startY = e.clientY;
                        
                        const handleMouseMove = (e: MouseEvent) => {
                          const deltaX = e.clientX - startX;
                          const deltaY = e.clientY - startY;
                          const newWidth = Math.max(200, startWidth + deltaX);
                          const newHeight = Math.max(150, startHeight + deltaY);
                          handleRoomResize(room, newWidth, newHeight);
                        };
                        
                        const handleMouseUp = () => {
                          document.removeEventListener('mousemove', handleMouseMove);
                          document.removeEventListener('mouseup', handleMouseUp);
                        };
                        
                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                      }}
                    />

                    <div
                      className="absolute top-1/2 right-0 w-2 h-8 bg-purple-500 rounded-l-lg cursor-e-resize opacity-70 hover:opacity-100 transition-opacity"
                      style={{ transform: 'translate(50%, -50%)' }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        
                        const startWidth = room.width || 300;
                        const startX = e.clientX;
                        
                        const handleMouseMove = (e: MouseEvent) => {
                          const deltaX = e.clientX - startX;
                          const newWidth = Math.max(200, startWidth + deltaX);
                          handleRoomResize(room, newWidth, room.height || 200);
                        };
                        
                        const handleMouseUp = () => {
                          document.removeEventListener('mousemove', handleMouseMove);
                          document.removeEventListener('mouseup', handleMouseUp);
                        };
                        
                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                      }}
                    />

                    <div
                      className="absolute bottom-0 left-1/2 w-8 h-2 bg-purple-500 rounded-t-lg cursor-s-resize opacity-70 hover:opacity-100 transition-opacity"
                      style={{ transform: 'translate(-50%, 50%)' }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        
                        const startHeight = room.height || 200;
                        const startY = e.clientY;
                        
                        const handleMouseMove = (e: MouseEvent) => {
                          const deltaY = e.clientY - startY;
                          const newHeight = Math.max(150, startHeight + deltaY);
                          handleRoomResize(room, room.width || 300, newHeight);
                        };
                        
                        const handleMouseUp = () => {
                          document.removeEventListener('mousemove', handleMouseMove);
                          document.removeEventListener('mouseup', handleMouseUp);
                        };
                        
                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                      }}
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
        
        <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 backdrop-blur-sm bg-opacity-90">
          <div className="flex justify-between items-center p-4">
            <div className="flex items-center space-x-6 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>
                  {mode === 'move' && 'Arraste salas e dispositivos para reposicioná-los (salvo automaticamente)'}
                  {mode === 'edit' && 'Arraste para mover, redimensione salas e salve as alterações'}
                  {mode === 'view' && 'Modo de visualização - selecione "Mover" ou "Editar" para modificar elementos'}
                </span>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center space-x-1">
                  <Building className="w-4 h-4" />
                  <span>{rooms.length} salas</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Network className="w-4 h-4" />
                  <span>{devices.length} dispositivos</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span>{devices.filter((d: Device) => d.status === 1).length} online</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span>{devices.filter((d: Device) => d.status === 0).length} offline</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}