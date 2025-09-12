import React, { useState } from 'react';
import { Device, Room, AvailableDevice, MapData } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { X } from 'lucide-react';

interface DeviceModalProps {
  mode: 'add' | 'edit';
  device?: Device;
  availableDevices?: AvailableDevice[];
  mapData: MapData;
  onClose: () => void;
  onSave: (device: Device) => void;
  onAdd?: (deviceData: any) => void;
}

interface RoomModalProps {
  room?: Room;
  onClose: () => void;
  onSave: (room: Room) => void;
  onDelete?: (roomId: number) => void;
}

export const DeviceModal: React.FC<DeviceModalProps> = ({
  mode,
  device,
  availableDevices = [],
  mapData,
  onClose,
  onSave,
  onAdd
}) => {
  enum DeviceStatus {
  Offline = 0,
  Online = 1
}

const [formData, setFormData] = useState<Device>(
  device || {
    id: 0,
    ip: '',
    name: '',
    type: '',
    user: '',
    sector: '',
    status: DeviceStatus.Offline, // <- usar o enum
    wifi_ssid: '',
    wifi_password: '',
    model: ''
  }
);


  const [selectedIP, setSelectedIP] = useState('');

  const handleSubmit = async () => {
    if (mode === 'add') {
      if (!selectedIP) return;
      onAdd?.({
        ip: selectedIP,
        name: formData.name,
        type: formData.type,
        user: formData.user,
        sector: formData.sector,
        status: 0
      });
    } else {
      onSave(formData);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-96 max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            {mode === 'add' ? 'Adicionar Dispositivo' : 'Editar Dispositivo'}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode === 'add' ? (
            <div>
              <label className="block text-sm font-medium mb-1">IP Disponível</label>
        <Select
          value={selectedIP || undefined}
          onValueChange={setSelectedIP}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione um IP" />
          </SelectTrigger>

          <SelectContent>
            {availableDevices.map((device) => (
              <SelectItem key={device.ip} value={device.ip}>
                {device.ip}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-1">IP</label>
              <Input
                value={formData.ip}
                readOnly
                className="bg-gray-100 cursor-not-allowed"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Nome</label>
            <Input
              value={formData.name || ''}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Tipo</label>
          <Select
            value={formData.type || undefined}
            onValueChange={(value) =>
              setFormData({ ...formData, type: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um tipo" />
            </SelectTrigger>

            <SelectContent>
              {mapData.device_types.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Usuário</label>
            <Input
              value={formData.user || ''}
              onChange={(e) => setFormData({...formData, user: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Setor</label>
            <Select
              value={formData.sector || ''}
              onValueChange={(value) => setFormData({...formData, sector: value})}
            >
              <option value="">Selecione um setor</option>
              {mapData.sectors.map(sector => (
                <option key={sector} value={sector}>{sector}</option>
              ))}
            </Select>
          </div>

          {formData.type === 'Roteador' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">SSID Wi-Fi</label>
                <Input
                  value={formData.wifi_ssid || ''}
                  onChange={(e) => setFormData({...formData, wifi_ssid: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Senha Wi-Fi</label>
                <Input
                  type="password"
                  value={formData.wifi_password || ''}
                  onChange={(e) => setFormData({...formData, wifi_password: e.target.value})}
                />
              </div>
            </>
          )}

          {formData.type === 'Impressora' && (
            <div>
              <label className="block text-sm font-medium mb-1">Modelo</label>
              <Input
                value={formData.model || ''}
                onChange={(e) => setFormData({...formData, model: e.target.value})}
              />
            </div>
          )}

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={mode === 'add' && !selectedIP}
            >
              {mode === 'add' ? 'Adicionar' : 'Salvar'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export const RoomModal: React.FC<RoomModalProps> = ({
  room,
  onClose,
  onSave,
  onDelete
}) => {
  const [formData, setFormData] = useState(
    room || {
      id: 0,
      name: '',
      x: 0,
      y: 0,
      width: 200,
      height: 150,
      floor: 1
    }
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-96">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Editar Sala</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nome</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium mb-1">Largura</label>
              <Input
                type="number"
                value={formData.width}
                onChange={(e) => setFormData({...formData, width: parseInt(e.target.value)})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Altura</label>
              <Input
                type="number"
                value={formData.height}
                onChange={(e) => setFormData({...formData, height: parseInt(e.target.value)})}
              />
            </div>
          </div>

          <div className="flex justify-between">
            {onDelete && room && (
              <Button
                variant="destructive"
                onClick={() => onDelete(room.id)}
              >
                Excluir
              </Button>
            )}
            <div className="flex space-x-2 ml-auto">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button onClick={() => onSave(formData)}>
                Salvar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
  
};