import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Activity, 
  Power, 
  Monitor,
  Printer,
  Router,
  Smartphone,
  Server,
  Tablet,
  Network,
  Users, Settings, Menu, X, Zap
} from 'lucide-react';
import { apiService } from '@/services/api';
import type { Device, Room, DevicePosition, PositionData } from '@/types';
import { Switch } from '@/components/ui/switch';
import 'tailwindcss/tailwind.css';
import React from 'react';
import NetworkConfigurationPanel, { NetworkConfig } from '@/components/NetworkConfigurationPanel';

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

interface DeviceComponentProps {
  device: Device;
  room: Room;
  mode: string;
  onDeviceDrag: (device: Device, x: number, y: number) => void;
  showLabels: boolean;
}

const DeviceComponent = ({ device, room, mode, onDeviceDrag, showLabels }: DeviceComponentProps) => {
const handleMouseDown = useCallback((e: React.MouseEvent) => {
  if (mode !== 'view' && mode !== 'edit') return;
  e.stopPropagation();
  e.preventDefault();

  const mapEl = document.querySelector('[data-map-ref]') as HTMLElement | null;
  if (!mapEl) return;
  const mapRect = mapEl.getBoundingClientRect();

  const target = e.currentTarget as HTMLElement;
  const elRect = target.getBoundingClientRect();
  const elW = elRect.width;
  const elH = elRect.height;

  const roomX = room?.x ?? 0;
  const roomY = room?.y ?? 0;
  const roomW = room?.width ?? mapRect.width;
  const roomH = room?.height ?? mapRect.height;

  const minAbsX = mapRect.left + roomX;
  const minAbsY = mapRect.top + roomY;
  const maxAbsX = mapRect.left + roomX + Math.max(0, roomW - elW);
  const maxAbsY = mapRect.top + roomY + Math.max(0, roomH - elH);

  const startMouseX = e.clientX;
  const startMouseY = e.clientY;
  const startAbsX = elRect.left;
  const startAbsY = elRect.top;

  const handleMouseMove = (ev: MouseEvent) => {
    const deltaX = ev.clientX - startMouseX;
    const deltaY = ev.clientY - startMouseY;

    let absX = startAbsX + deltaX;
    let absY = startAbsY + deltaY;

    absX = Math.max(minAbsX, Math.min(maxAbsX, absX));
    absY = Math.max(minAbsY, Math.min(maxAbsY, absY));

    const relX = absX - mapRect.left - roomX;
    const relY = absY - mapRect.top - roomY;

    requestAnimationFrame(() => onDeviceDrag(device, relX, relY));
  };

  const handleMouseUp = () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
}, [device, room, mode, onDeviceDrag]);


  return (
    <div
      className={`absolute bg-white border-2 border-gray-300 rounded-xl p-3 shadow-lg hover:shadow-2xl transition-shadow duration-200 ${
        mode === 'view' || mode === 'edit' ? 'cursor-move' : 'cursor-pointer'
      } ${device.status === 1 ? 'border-emerald-300' : 'border-red-300'}`}
      style={{
        left: device.x || 50,
        top: device.y || 50,
        transform: 'translate(-50%, -50%)',
        minWidth: '48px',
        minHeight: '48px',
        willChange: mode === 'view' || mode === 'edit' ? 'transform' : 'auto'
      }}
      onMouseDown={handleMouseDown}
      title={`${device.name || device.ip} - ${device.user}`}
    >
      <div className="flex items-center justify-center">
        {getDeviceIcon(device.type, device.status)}
      </div>
      
      {showLabels && (
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 bg-gray-900 bg-opacity-90 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap z-10 pointer-events-none">
          <div className="font-medium">{device.name || device.ip}</div>
          <div className="text-gray-300">{device.user}</div>
        </div>
      )}
    </div>
  );
};

interface RoomComponentProps {
  room: Room;
  devices: Device[];
  mode: string;
  selectedRoom: number | null;
  onRoomDrag: (room: Room, x: number, y: number) => void;
  onRoomResize: (room: Room, width: number, height: number) => void;
  onRoomClick: (roomId: number) => void;
  onDeviceDrag: (device: Device, x: number, y: number) => void;
  networkConfig: NetworkConfig;
}

const RoomComponent = ({ 
  room, 
  devices, 
  mode, 
  selectedRoom, 
  onRoomDrag, 
  onRoomResize, 
  onRoomClick,
  onDeviceDrag, 
  networkConfig 
}: RoomComponentProps) => {
  const devicesInRoom = useMemo(() => 
    devices.filter((device: Device) => device.sector === room.name && device.x !== null && device.y !== null)
  , [devices, room.name]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (mode === 'view') {
      onRoomClick(room.id);
      return;
    }
    if (mode !== 'view' && mode !== 'edit') return;
    e.preventDefault();
    
    const rect = document.querySelector('[data-map-ref]')?.getBoundingClientRect();
    if (!rect) return;
    
    const startX = e.clientX - rect.left - (room.x || 100);
    const startY = e.clientY - rect.top - (room.y || 100);
    
    const handleMouseMove = (e: MouseEvent) => {
      const newX = Math.max(0, e.clientX - rect.left - startX);
      const newY = Math.max(0, e.clientY - rect.top - startY);
      onRoomDrag(room, newX, newY);
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [room, mode, onRoomDrag, onRoomClick]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, direction: string) => {
    e.stopPropagation();
    e.preventDefault();
    
    const startWidth = room.width || 300;
    const startHeight = room.height || 200;
    const startX = e.clientX;
    const startY = e.clientY;
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      let newWidth = startWidth;
      let newHeight = startHeight;
      
      if (direction.includes('right')) newWidth = Math.max(200, startWidth + deltaX);
      if (direction.includes('bottom')) newHeight = Math.max(150, startHeight + deltaY);
      
      onRoomResize(room, newWidth, newHeight);
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [room, onRoomResize]);

  return (
    <div
      className={`absolute border-2 rounded-2xl backdrop-blur-sm transition-shadow duration-200 ${
        selectedRoom === room.id
          ? 'border-blue-500 bg-white bg-opacity-90 shadow-2xl'
          : 'border-gray-300 bg-white bg-opacity-80 hover:border-blue-400 hover:shadow-xl'
      } ${mode === 'view' || mode === 'edit' ? 'cursor-move' : 'cursor-pointer'}`}
      style={{
        left: room.x || 100,
        top: room.y || 100,
        width: room.width || 300,
        height: room.height || 200,
        willChange: mode === 'view' || mode === 'edit' ? 'transform' : 'auto'
      }}
      onMouseDown={handleMouseDown}
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
        {devicesInRoom.map((device: Device) => (
          <DeviceComponent
            key={device.id}
            device={device}
            room={room}
            mode={mode}
            onDeviceDrag={onDeviceDrag}
            showLabels={networkConfig.showDeviceLabels}
          />
        ))}
      </div>

      {mode === 'edit' && (
        <>
          <div
            className="absolute bottom-0 right-0 w-4 h-4 bg-purple-500 rounded-tl-lg cursor-se-resize opacity-70 hover:opacity-100 transition-opacity"
            style={{ transform: 'translate(50%, 50%)' }}
            onMouseDown={(e) => handleResizeMouseDown(e, 'right-bottom')}
          />
          <div
            className="absolute top-1/2 right-0 w-2 h-8 bg-purple-500 rounded-l-lg cursor-e-resize opacity-70 hover:opacity-100 transition-opacity"
            style={{ transform: 'translate(50%, -50%)' }}
            onMouseDown={(e) => handleResizeMouseDown(e, 'right')}
          />
          <div
            className="absolute bottom-0 left-1/2 w-8 h-2 bg-purple-500 rounded-t-lg cursor-s-resize opacity-70 hover:opacity-100 transition-opacity"
            style={{ transform: 'translate(-50%, 50%)' }}
            onMouseDown={(e) => handleResizeMouseDown(e, 'bottom')}
          />
        </>
      )}
    </div>
  );
};

export default function NetworkMapViewer() {
  // Estados
  const [networkConfig, setNetworkConfig] = useState<NetworkConfig>({
    showDeviceLabels: true,
    showRoomLabels: true,
    showConnectionLines: false,
    gridSize: 20,
    autoRefresh: true,
    refreshInterval: 30,
    theme: 'light',
    colorScheme: 'blue',
    opacity: 0.9,
    animationsEnabled: true,
    networkScanInterval: 60,
    deviceTimeout: 300,
    maxDevicesPerRoom: 50,
    notificationsEnabled: true,
    soundEnabled: false,
    alertOnDeviceDown: true,
    alertOnNewDevice: true,
    debugMode: false,
    logLevel: 'warn',
    cacheEnabled: true
  });

  const [devices, setDevices] = useState<Device[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<number | null>(null);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [searchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [changedRooms, setChangedRooms] = useState<Set<number>>(new Set());
  const [changedDevices, setChangedDevices] = useState<Set<number>>(new Set());
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  const filteredDevices = useMemo(() => 
    devices.filter((device: Device) => {
      const matchesSearch = device.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           device.ip.includes(searchTerm) ||
                           device.user?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    })
  , [devices, searchTerm]);

  // Função generateInitialPositions
  const generateInitialPositions = useCallback((roomDevices: Device[], roomWidth: number = 300): PositionData[] => {
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
  }, []);

  // Função loadData - DECLARAR PRIMEIRO
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const [devicesData, roomsData, positionsData] = await Promise.all([
        apiService.getDevices(),
        apiService.getRooms(),
        apiService.getDevicePositions()
      ]);
      
      const roomsWithPositions = roomsData.map((room: Room) => ({
        ...room,
        x: room.x !== null && room.x !== undefined ? Number(room.x) : 100,
        y: room.y !== null && room.y !== undefined ? Number(room.y) : 100,
        width: room.width !== null && room.width !== undefined ? Number(room.width) : 300,
        height: room.height !== null && room.height !== undefined ? Number(room.height) : 200
      }));
      
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
          x: position?.x ? Number(position.x) : null,
          y: position?.y ? Number(position.y) : null
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
            await apiService.batchUpdatePositions(positionsToCreate);
            
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
      
    } catch (error: unknown) {
      console.error('Erro ao carregar dados:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setError('Erro ao carregar dados: ' + errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [generateInitialPositions]);

  // Auto-refresh functions
  const startAutoRefresh = useCallback((interval: number) => {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
    }
    const newInterval = setInterval(() => {
      loadData();
    }, interval * 1000);
    setAutoRefreshInterval(newInterval);
  }, [autoRefreshInterval, loadData]);

  const stopAutoRefresh = useCallback(() => {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      setAutoRefreshInterval(null);
    }
  }, [autoRefreshInterval]);

  // Aplicar tema
  const applyTheme = useCallback((theme: string) => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else { // auto
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, []);

  // Grid style
  const gridStyle = useMemo(() => `
    [data-map-ref] {
      background: radial-gradient(circle at 1px 1px, rgba(99, 102, 241, 0.15) 1px, transparent 0px) 0% 0% / ${networkConfig.gridSize}px ${networkConfig.gridSize}px, radial-gradient(circle at 10px 10px, rgba(139, 92, 246, 0.1) 1px, transparent 0px) 0% 0% / ${networkConfig.gridSize * 2}px ${networkConfig.gridSize * 2}px !important;
    }
    .dark [data-map-ref] {
      background: radial-gradient(circle at 1px 1px, rgba(99, 102, 241, 0.25) 1px, transparent 0px) 0% 0% / ${networkConfig.gridSize}px ${networkConfig.gridSize}px, radial-gradient(circle at 10px 10px, rgba(139, 92, 246, 0.15) 1px, transparent 0px) 0% 0% / ${networkConfig.gridSize * 2}px ${networkConfig.gridSize * 2}px !important;
    }
  `, [networkConfig.gridSize]);

  // Handle config change - CORRIGIDO
  const handleConfigChange = useCallback((newConfig: NetworkConfig) => {
    setNetworkConfig(newConfig);
    
    // Aplicar auto-refresh
    if (newConfig.autoRefresh !== networkConfig.autoRefresh) {
      if (newConfig.autoRefresh) {
        startAutoRefresh(newConfig.refreshInterval);
      } else {
        stopAutoRefresh();
      }
    }
    
    // Aplicar tema
    if (newConfig.theme !== networkConfig.theme) {
      applyTheme(newConfig.theme);
    }
    
    // Debug mode
    if (newConfig.debugMode) {
      console.log('Debug mode enabled', newConfig);
    }
  }, [networkConfig, startAutoRefresh, stopAutoRefresh, applyTheme]);

  // useEffects
  useEffect(() => {
    loadData();
    const savedConfig = localStorage.getItem('networkMapConfig');
    if (savedConfig) {
      try {
        const parsedConfig = JSON.parse(savedConfig);
        setNetworkConfig(prev => ({ ...prev, ...parsedConfig }));
      } catch (error) {
        console.error('Erro ao carregar configurações:', error);
      }
    }
  }, [loadData]);

  useEffect(() => {
    return () => {
      if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
      }
    };
  }, [autoRefreshInterval]);

  // Outras funções (markRoomAsChanged, handleDeviceDrag, etc.) permanecem iguais...
  const markRoomAsChanged = useCallback((roomId: number) => {
    setChangedRooms(prev => new Set([...prev, roomId]));
    setHasUnsavedChanges(true);
  }, []);

  const markDeviceAsChanged = useCallback((deviceId: number) => {
    setChangedDevices(prev => new Set([...prev, deviceId]));
    setHasUnsavedChanges(true);
  }, []);

  const handleDeviceDrag = useCallback((device: Device, newX: number, newY: number) => {
    const room = rooms.find((room: Room) => room.name === device.sector);
    if (!room) return;

    const x = Number(newX);
    const y = Number(newY);
    
    if (isNaN(x) || isNaN(y)) return;

    setDevices(prevDevices => 
      prevDevices.map((d: Device) => 
        d.id === device.id ? { ...d, x, y } : d
      )
    );

    if (mode === 'view') {
      apiService.updateDevicePosition({
        device_id: device.id,
        room_id: room.id,
        x,
        y
      }).catch((error: unknown) => {
        console.error('Erro ao salvar posição do dispositivo:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        showToast("Erro", "Erro ao salvar posição: " + errorMessage, "destructive");
        
        setDevices(prevDevices => 
          prevDevices.map((d: Device) => 
            d.id === device.id ? { ...d, x: device.x, y: device.y } : d
          )
        );
      });
    } else if (mode === 'edit') {
      markDeviceAsChanged(device.id);
    }
  }, [rooms, mode, markDeviceAsChanged]);

  const handleRoomDrag = useCallback((room: Room, newX: number, newY: number) => {
    const x = Number(newX);
    const y = Number(newY);
    
    if (isNaN(x) || isNaN(y)) return;
    
    setRooms(prevRooms => 
      prevRooms.map((r: Room) => 
        r.id === room.id ? { ...r, x, y } : r
      )
    );

    if (mode === 'view') {
      apiService.updateRoom(room.id, { x, y }).catch((error: unknown) => {
        console.error('Erro ao mover sala:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        showToast("Erro", "Erro ao mover sala: " + errorMessage, "destructive");
        
        setRooms(prevRooms => 
          prevRooms.map((r: Room) => 
            r.id === room.id ? { ...r, x: room.x, y: room.y } : r
          )
        );
      });
    } else if (mode === 'edit') {
      markRoomAsChanged(room.id);
    }
  }, [mode, markRoomAsChanged]);

  const handleRoomResize = useCallback((room: Room, newWidth: number, newHeight: number) => {
    const width = Number(newWidth);
    const height = Number(newHeight);
    
    if (isNaN(width) || isNaN(height)) return;
    
    setRooms(prevRooms => 
      prevRooms.map((r: Room) => 
        r.id === room.id ? { ...r, width, height } : r
      )
    );
    
    markRoomAsChanged(room.id);
  }, [markRoomAsChanged]);

  const handleRoomClick = useCallback((roomId: number) => {
    setSelectedRoom(selectedRoom === roomId ? null : roomId);
  }, [selectedRoom]);

  const saveAllChanges = async () => {
    setIsSaving(true);
    let errors: string[] = [];
    let savedRooms = 0;
    let savedDevices = 0;
    
    const roomsToSave = rooms.filter((room: Room) => changedRooms.has(room.id));
    const devicesToSave = devices.filter((device: Device) => changedDevices.has(device.id) && 
      device.room_id !== null && device.x !== null && device.y !== null
    );

    try {
      if (roomsToSave.length > 0) {
        const roomPromises = roomsToSave.map(async (room: Room) => {
          try {
            const roomData = {
              x: Number(room.x) || 0,
              y: Number(room.y) || 0,
              width: Number(room.width) || 300,
              height: Number(room.height) || 200
            };
            
            await apiService.updateRoom(room.id, roomData);
            savedRooms++;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
            errors.push(`Sala "${room.name}": ${errorMessage}`);
          }
        });

        await Promise.all(roomPromises);
      }

      if (devicesToSave.length > 0) {
        const devicePromises = devicesToSave.map(async (device: Device) => {
          try {
            const positionData = {
              device_id: Number(device.id),
              room_id: Number(device.room_id!),
              x: Number(device.x!),
              y: Number(device.y!)
            };
            
            await apiService.updateDevicePosition(positionData);
            savedDevices++;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
            errors.push(`Dispositivo "${device.name || device.ip}": ${errorMessage}`);
          }
        });

        await Promise.all(devicePromises);
      }

      const totalOperations = savedRooms + savedDevices;
      if (errors.length === 0 && totalOperations > 0) {
        setChangedRooms(new Set());
        setChangedDevices(new Set());
        setHasUnsavedChanges(false);
        
        showToast("Sucesso", 
          `Alterações salvas com sucesso! (${savedRooms} salas, ${savedDevices} dispositivos)`
        );
      } else if (errors.length === 0 && totalOperations === 0) {
        showToast("Info", "Nenhuma alteração para salvar");
      } else {
        const successMessage = totalOperations > 0 
          ? `${totalOperations} item(ns) salvos com sucesso. ` 
          : '';
        
        showToast("Aviso", 
          `${successMessage}${errors.length} erro(s) encontrados`, 
          "destructive"
        );
        
        if (savedRooms === roomsToSave.length && savedDevices === devicesToSave.length) {
          setChangedRooms(new Set());
          setChangedDevices(new Set());
          setHasUnsavedChanges(false);
        }
      }

    } catch (error) {
      console.error('Erro crítico durante salvamento:', error);
      showToast("Erro", "Erro crítico ao salvar alterações", "destructive");
    } finally {
      setIsSaving(false);
    }
  };

  const discardChanges = () => {
    loadData();
    setChangedRooms(new Set());
    setChangedDevices(new Set());
    setHasUnsavedChanges(false)
  };

  const PendingChangesStatus = () => {
    const pendingRoomsCount = changedRooms.size;
    const pendingDevicesCount = changedDevices.size;
    
    if (!hasUnsavedChanges || (pendingRoomsCount === 0 && pendingDevicesCount === 0)) {
      return null;
    }
    
    return (
      <div className="flex items-center space-x-2 px-3 py-1 bg-yellow-100 border border-yellow-300 rounded-lg">
        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
        <span className="text-sm text-yellow-800 font-medium">
          {pendingRoomsCount + pendingDevicesCount} alterações pendentes
        </span>
        <button
          onClick={discardChanges}
          className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
          disabled={isSaving}
        >
          Descartar
        </button>
        <button
          onClick={saveAllChanges}
          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
          disabled={isSaving}
        >
          {isSaving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-200 rounded-full animate-spin"></div>
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
          </div>
          <p className="mt-6 text-lg font-medium text-gray-700">Carregando dispositivos da rede...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-red-50 to-pink-100">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Network className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Erro de Conexão</h2>
          <p className="text-red-600 mb-6">{error}</p>
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
    <div className=" p-4 sm:p-6 mx-auto rounded-tl-2xl rounded-tr-2xl flex flex-col dark:from-gray-900 dark:to-blue-900 h-screen overflow-hidden select-none  h-[calc(92vh-4rem)]">

    <header className="rounded-tl-2xl rounded-tr-2xl relative bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-700/50 shadow-2xl">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-indigo-500/5 to-purple-500/5 dark:from-blue-400/5 dark:via-indigo-400/5 dark:to-purple-400/5"></div>
      
      <div className="relative px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center">
          
          {/* Logo e Título */}
          <div className="flex items-center space-x-3 group">
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-500 dark:via-indigo-500 dark:to-purple-500 rounded-2xl flex items-center justify-center transform transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-lg hover:shadow-xl">
                <Network className="w-7 h-7 text-white animate-pulse" />
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-2xl"></div>
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white dark:border-gray-900 animate-bounce"></div>
            </div>
            
            <div className="hidden sm:block">
              <h1 className="text-3xl font-bold">
                Mapa de Rede
              </h1>
            </div>
          </div>

          {/* Desktop Controls */}
          <div className="hidden md:flex items-center space-x-6">
            <PendingChangesStatus />
            
            <div className="flex items-center space-x-3 bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-3 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50">
              <Activity className={`w-4 h-4 transition-all duration-300 ${mode === 'edit' ? 'text-blue-500 animate-pulse' : 'text-gray-400'}`} />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {mode === 'edit' ? 'Editando' : 'Visualizando'}
              </span>
              <Switch
                checked={mode === 'edit'}
                onCheckedChange={(checked) => setMode(checked ? 'edit' : 'view')}
              />
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-all duration-300 transform hover:scale-105"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? (
              <X className="w-6 h-6 text-gray-600 dark:text-gray-300" />
            ) : (
              <Menu className="w-6 h-6 text-gray-600 dark:text-gray-300" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        <div className={`md:hidden overflow-hidden transition-all duration-500 ease-in-out ${
          isMenuOpen ? 'max-h-96 opacity-100 mt-4' : 'max-h-0 opacity-0'
        }`}>
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-gray-700/50 p-4 space-y-4 shadow-xl">
            
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">Mapa de Rede</span>
              <PendingChangesStatus />
            </div>
            
            <div className="flex items-center justify-between p-4 bg-gray-50/50 dark:bg-gray-700/50 rounded-xl">
              <div className="flex items-center space-x-3">
                <Activity className={`w-5 h-5 transition-all duration-300 ${mode === 'edit' ? 'text-blue-500 animate-pulse' : 'text-gray-400'}`} />
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {mode === 'edit' ? 'Modo Edição' : 'Modo Visualização'}
                </span>
              </div>
              <Switch
                checked={mode === 'edit'}
                onCheckedChange={(checked) => setMode(checked ? 'edit' : 'view')}
              />
            </div>

            <button className="w-full flex items-center space-x-3 p-4 rounded-xl bg-gray-50/50 dark:bg-gray-700/50 hover:bg-gray-100/50 dark:hover:bg-gray-600/50 transition-all duration-300">
              <Settings className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              <span className="font-medium text-gray-700 dark:text-gray-300">Configurações</span>
            </button>

            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl">
              <div className="flex items-center space-x-3">
                <Zap className="w-5 h-5 text-blue-500" />
                <span className="font-medium text-gray-700 dark:text-gray-300">Status da Rede</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-green-600 dark:text-green-400">Ativo</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>
    </header>

      <div className="flex-1 relative overflow-hidden">
        <div
          data-map-ref
          className="w-full h-full relative overflow-auto"
        >
          <style>{gridStyle}</style>
          {rooms.map((room: Room) => (

            <RoomComponent
              key={room.id}
              room={room}
              devices={filteredDevices}
              mode={mode}
              selectedRoom={selectedRoom}
              onRoomDrag={handleRoomDrag}
              onRoomResize={handleRoomResize}
              onRoomClick={handleRoomClick}
              onDeviceDrag={handleDeviceDrag}
              networkConfig={networkConfig} // <- ADICIONE ESTA LINHA
            />
          ))}
        </div>
        
        <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-800 rounded-lg p-3 shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {mode === 'view' && 'Arraste salas e dispositivos (salvo automaticamente)'}
            {mode === 'edit' && 'Arraste e redimensione elementos, depois salve'}
          </div>
        </div>
      </div>
      <NetworkConfigurationPanel/>
    </div>
  );
}