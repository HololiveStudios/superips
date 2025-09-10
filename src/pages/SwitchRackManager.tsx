import { useEffect, useState } from 'react';
import { Network, Server, Plus, Trash2, Power, Check, X, Settings, AlertCircle, Download, Edit } from 'lucide-react';
import * as XLSX from 'xlsx';
import { apiService } from '../services/api';

interface Switch {
  id?: number;
  name: string;
  model: string;
  sector: string;
  rack_position: number;
  total_ports: number;
  used_ports: number;
  is_poe: boolean;
  status: 'active' | 'inactive';
  ip_address?: string;
  ports_status?: boolean[];
  created_at?: string;
}

interface Rack {
  id?: number;
  name: string;
  sector: string;
  total_units: number;
  used_units: number;
  location: string;
  status: 'active' | 'inactive';
}

export default function SwitchRackManager() {
  const [switches, setSwitches] = useState<Switch[]>([]);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [activeTab, setActiveTab] = useState<'switches' | 'racks'>('switches');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState<{ type: 'switch' | 'rack', item: Switch | Rack } | null>(null);
  const [showPortsModal, setShowPortsModal] = useState<Switch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newSwitch, setNewSwitch] = useState<Partial<Switch>>({
    name: '',
    model: '',
    sector: '',
    rack_position: 1,
    total_ports: 24,
    used_ports: 0,
    is_poe: false,
    status: 'active',
    ip_address: '',
    ports_status: Array(24).fill(false)
  });

  const [newRack, setNewRack] = useState<Partial<Rack>>({
    name: '',
    sector: '',
    total_units: 42,
    used_units: 0,
    location: '',
    status: 'active'
  });

  const [editSwitch, setEditSwitch] = useState<Partial<Switch>>({});
  const [editRack, setEditRack] = useState<Partial<Rack>>({});

  const sectors = ['TI', 'Administrativo', 'Produção', 'Vendas', 'Financeiro', 'RH', 'Marketing', 'Churrascaria'];

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (activeTab === 'switches') {
        const switchData = await apiService.getSwitches();
        const switchesWithPorts = switchData.map(sw => ({
          ...sw,
          ip_address: sw.ip_address || '',
          ports_status: sw.ports_status || Array(sw.total_ports).fill(false).map((_, i) => i < sw.used_ports)
        }));
        setSwitches(switchesWithPorts);
      } else {
        const rackData = await apiService.getRacks();
        setRacks(rackData);
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      setError('Erro ao carregar dados. Verifique se o servidor está funcionando.');
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    
    if (activeTab === 'switches') {
      const switchData = switches.map(sw => ({
        'Modelo': sw.model,
        'Setor': sw.sector
      }));
      
      const ws = XLSX.utils.json_to_sheet(switchData);
      XLSX.utils.book_append_sheet(wb, ws, "Switches");
    } else {
      const rackData = racks.map(rack => ({
        'Nome': rack.name,
        'Setor': rack.sector,
        'Localização': rack.location,
        'Unidades Total': rack.total_units + 'U',
        'Unidades Usadas': rack.used_units + 'U',
        'Utilização (%)': Math.round((rack.used_units / rack.total_units) * 100),
        'Status': rack.status === 'active' ? 'Ativo' : 'Inativo'
      }));
      
      const ws = XLSX.utils.json_to_sheet(rackData);
      XLSX.utils.book_append_sheet(wb, ws, "Racks");
    }
    
    const fileName = `${activeTab}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const addSwitch = async () => {
    if (newSwitch.name && newSwitch.model && newSwitch.sector) {
      try {
        setError(null);
        const switchToAdd = {
          ...newSwitch,
          ip_address: newSwitch.ip_address || '',
          ports_status: Array(newSwitch.total_ports || 24).fill(false)
        };
        
        const createdSwitch = await apiService.createSwitch(switchToAdd);
        setSwitches([...switches, { 
          ...createdSwitch,
          ip_address: createdSwitch.ip_address || '',
          ports_status: Array(createdSwitch.total_ports).fill(false).map((_, i) => i < createdSwitch.used_ports)
        }]);
        
        setNewSwitch({ 
          name: '', 
          model: '', 
          sector: '', 
          rack_position: 1, 
          total_ports: 24, 
          used_ports: 0, 
          is_poe: false, 
          status: 'active', 
          ip_address: '',
          ports_status: Array(24).fill(false)
        });
        setShowAddForm(false);
      } catch (err) {
        console.error('Erro ao criar switch:', err);
        setError('Erro ao criar switch. Verifique os dados e tente novamente.');
      }
    }
  };

  const addRack = async () => {
    if (newRack.name && newRack.sector && newRack.location) {
      try {
        setError(null);
        const createdRack = await apiService.createRack(newRack);
        setRacks([...racks, createdRack]);
        
        setNewRack({ 
          name: '', 
          sector: '', 
          total_units: 42, 
          used_units: 0, 
          location: '', 
          status: 'active' 
        });
        setShowAddForm(false);
      } catch (err) {
        console.error('Erro ao criar rack:', err);
        setError('Erro ao criar rack. Verifique os dados e tente novamente.');
      }
    }
  };

  const updateSwitch = async () => {
    if (editSwitch.name && editSwitch.model && editSwitch.sector && editSwitch.id) {
      try {
        setError(null);
        const switchToUpdate = {
          ...editSwitch,
          ip_address: editSwitch.ip_address || '',
          ports_status: editSwitch.ports_status || Array(editSwitch.total_ports || 24).fill(false)
        };
        
        const updatedSwitch = await apiService.updateSwitch(editSwitch.id, switchToUpdate);
        setSwitches(switches.map(sw => sw.id === editSwitch.id ? { 
          ...updatedSwitch,
          ip_address: updatedSwitch.ip_address || '',
          ports_status: updatedSwitch.ports_status || Array(updatedSwitch.total_ports).fill(false).map((_, i) => i < updatedSwitch.used_ports)
        } : sw));
        
        setShowEditForm(null);
        setEditSwitch({});
      } catch (err) {
        console.error('Erro ao atualizar switch:', err);
        setError('Erro ao atualizar switch. Verifique os dados e tente novamente.');
      }
    }
  };

  const updateRack = async () => {
    if (editRack.name && editRack.sector && editRack.location && editRack.id) {
      try {
        setError(null);
        const updatedRack = await apiService.updateRack(editRack.id, editRack);
        setRacks(racks.map(rack => rack.id === editRack.id ? updatedRack : rack));
        
        setShowEditForm(null);
        setEditRack({});
      } catch (err) {
        console.error('Erro ao atualizar rack:', err);
        setError('Erro ao atualizar rack. Verifique os dados e tente novamente.');
      }
    }
  };

  const openEditForm = (type: 'switch' | 'rack', item: Switch | Rack) => {
    if (type === 'switch') {
      const switchItem = item as Switch;
      setEditSwitch({
        ...switchItem,
        ports_status: switchItem.ports_status || Array(switchItem.total_ports).fill(false)
      });
    } else {
      setEditRack(item as Rack);
    }
    setShowEditForm({ type, item });
  };

  const deleteSwitch = async (id: number) => {
    if (confirm('Tem certeza que deseja remover este switch?')) {
      try {
        setError(null);
        await apiService.deleteSwitch(id);
        setSwitches(switches.filter(s => s.id !== id));
      } catch (err) {
        console.error('Erro ao remover switch:', err);
        setError('Erro ao remover switch.');
      }
    }
  };

  const deleteRack = async (id: number) => {
    if (confirm('Tem certeza que deseja remover este rack?')) {
      try {
        setError(null);
        await apiService.deleteRack(id);
        setRacks(racks.filter(r => r.id !== id));
      } catch (err) {
        console.error('Erro ao remover rack:', err);
        setError('Erro ao remover rack.');
      }
    }
  };

  const togglePortStatus = async (switchId: number, portIndex: number) => {
    const switchItem = switches.find(s => s.id === switchId);
    if (!switchItem) return;

    const newPortsStatus = [...(switchItem.ports_status || [])];
    newPortsStatus[portIndex] = !newPortsStatus[portIndex];
    const used_ports = newPortsStatus.filter(Boolean).length;

    try {
      await apiService.updateSwitch(switchId, { 
        used_ports,
        ports_status: newPortsStatus 
      });

      setSwitches(switches.map(s => {
        if (s.id === switchId) {
          return { ...s, ports_status: newPortsStatus, used_ports };
        }
        return s;
      }));

      if (showPortsModal?.id === switchId) {
        setShowPortsModal({ ...switchItem, ports_status: newPortsStatus, used_ports });
      }
    } catch (err) {
      console.error('Erro ao atualizar porta:', err);
      setError('Erro ao atualizar status da porta.');
    }
  };

  const getPortUtilization = (used: number, total: number) => {
    const percentage = (used / total) * 100;
    if (percentage >= 90) return 'text-red-600 bg-red-100 dark:bg-red-800/20 dark:text-red-400';
    if (percentage >= 70) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-800/20 dark:text-yellow-400';
    return 'text-green-600 bg-green-100 dark:bg-green-800/20 dark:text-green-400';
  };

  const getUnitUtilization = (used: number, total: number) => {
    const percentage = (used / total) * 100;
    if (percentage >= 90) return 'text-red-600 bg-red-100 dark:bg-red-800/20 dark:text-red-400';
    if (percentage >= 70) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-800/20 dark:text-yellow-400';
    return 'text-green-600 bg-green-100 dark:bg-green-800/20 dark:text-green-400';
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <span className="ml-4 text-gray-600 dark:text-gray-400">Carregando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Switches e Racks</h1>
        
        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-800/20 border border-red-400 text-red-700 dark:text-red-400 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
            <button 
              onClick={() => setError(null)}
              className="ml-auto p-1 hover:bg-red-200 dark:hover:bg-red-700/30 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        
        <div className="flex gap-4 mt-2 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-100 dark:bg-green-800 rounded-full"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Ativo/Utilização Normal</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-100 dark:bg-yellow-800 rounded-full"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Utilização Alta (70-90%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-100 dark:bg-red-800 rounded-full"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Utilização Crítica (90%+)</span>
          </div>
        </div>
        
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('switches')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'switches'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            <Network className="w-4 h-4 inline mr-2" />
            Switches ({switches.length})
          </button>
          <button
            onClick={() => setActiveTab('racks')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'racks'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            <Server className="w-4 h-4 inline mr-2" />
            Racks ({racks.length})
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors shadow-lg"
          >
            <Plus className="w-4 h-4 inline mr-2" />
            Adicionar {activeTab === 'switches' ? 'Switch' : 'Rack'}
          </button>
          <button
            onClick={loadData}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Atualizar
          </button>
          <button
            onClick={exportToExcel}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            disabled={activeTab === 'switches' ? switches.length === 0 : racks.length === 0}
          >
            <Download className="w-4 h-4 inline mr-2" />
            Exportar Excel
          </button>
        </div>
      </div>

      {/* Modal de Adicionar */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-96 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
              Adicionar {activeTab === 'switches' ? 'Switch' : 'Rack'}
            </h2>
            
            {activeTab === 'switches' ? (
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Nome do Switch"
                  value={newSwitch.name}
                  onChange={(e) => setNewSwitch({...newSwitch, name: e.target.value})}
                  className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                  required
                />
                <input
                  type="text"
                  placeholder="Modelo"
                  value={newSwitch.model}
                  onChange={(e) => setNewSwitch({...newSwitch, model: e.target.value})}
                  className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                  required
                />
                <select
                  value={newSwitch.sector}
                  onChange={(e) => setNewSwitch({...newSwitch, sector: e.target.value})}
                  className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                  required
                >
                  <option value="">Selecione o Setor</option>
                  {sectors.map(sector => (
                    <option key={sector} value={sector}>{sector}</option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="Posição no Rack"
                  value={newSwitch.rack_position}
                  onChange={(e) => setNewSwitch({...newSwitch, rack_position: parseInt(e.target.value)})}
                  className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                />
                <input
                  type="number"
                  placeholder="Total de Portas"
                  value={newSwitch.total_ports}
                  onChange={(e) => {
                    const ports = parseInt(e.target.value);
                    setNewSwitch({
                      ...newSwitch, 
                      total_ports: ports,
                      ports_status: Array(ports).fill(false)
                    });
                  }}
                  className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                />
                <input
                  type="text"
                  placeholder="IP Address"
                  value={newSwitch.ip_address || ''}
                  onChange={(e) => setNewSwitch({...newSwitch, ip_address: e.target.value})}
                  className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                />
                <select
                  value={newSwitch.status}
                  onChange={(e) => setNewSwitch({...newSwitch, status: e.target.value as 'active' | 'inactive'})}
                  className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
                <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={newSwitch.is_poe}
                    onChange={(e) => setNewSwitch({...newSwitch, is_poe: e.target.checked})}
                    className="rounded"
                  />
                  PoE (Power over Ethernet)
                </label>
              </div>
            ) : (
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Nome do Rack"
                  value={newRack.name}
                  onChange={(e) => setNewRack({...newRack, name: e.target.value})}
                  className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                  required
                />
                <select
                  value={newRack.sector}
                  onChange={(e) => setNewRack({...newRack, sector: e.target.value})}
                  className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                  required
                >
                  <option value="">Selecione o Setor</option>
                  {sectors.map(sector => (
                    <option key={sector} value={sector}>{sector}</option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="Total de Unidades (U)"
                  value={newRack.total_units}
                  onChange={(e) => setNewRack({...newRack, total_units: parseInt(e.target.value)})}
                  className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                />
                <input
                  type="number"
                  placeholder="Unidades Utilizadas"
                  value={newRack.used_units}
                  onChange={(e) => setNewRack({...newRack, used_units: parseInt(e.target.value)})}
                  className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                />
                <input
                  type="text"
                  placeholder="Localização"
                  value={newRack.location}
                  onChange={(e) => setNewRack({...newRack, location: e.target.value})}
                  className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                  required
                />
                <select
                  value={newRack.status}
                  onChange={(e) => setNewRack({...newRack, status: e.target.value as 'active' | 'inactive'})}
                  className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </div>
            )}
            
            <div className="flex gap-2 mt-6">
              <button
                onClick={activeTab === 'switches' ? addSwitch : addRack}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                <Check className="w-4 h-4 inline mr-2" />
                Salvar
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
              >
                <X className="w-4 h-4 inline mr-2" />
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição */}
      {showEditForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-96 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
              Editar {showEditForm.type === 'switch' ? 'Switch' : 'Rack'}
            </h2>
            
            {showEditForm.type === 'switch' ? (
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Nome do Switch"
                  value={editSwitch.name || ''}
                  onChange={(e) => setEditSwitch({...editSwitch, name: e.target.value})}
                  className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                  required
                />
                <input
                  type="text"
                  placeholder="Modelo"
                  value={editSwitch.model || ''}
                  onChange={(e) => setEditSwitch({...editSwitch, model: e.target.value})}
                  className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                  required
                />
                <select
                  value={editSwitch.sector || ''}
                  onChange={(e) => setEditSwitch({...editSwitch, sector: e.target.value})}
                  className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                  required
                >
                  <option value="">Selecione o Setor</option>
                  {sectors.map(sector => (
                    <option key={sector} value={sector}>{sector}</option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="Posição no Rack"
                  value={editSwitch.rack_position || 1}
                  onChange={(e) => setEditSwitch({...editSwitch, rack_position: parseInt(e.target.value)})}
                  className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                />
                <input
                  type="number"
                  placeholder="Total de Portas"
                  value={editSwitch.total_ports || 24}
                  onChange={(e) => {
                    const ports = parseInt(e.target.value);
                    setEditSwitch({
                      ...editSwitch, 
                      total_ports: ports,
                      ports_status: Array(ports).fill(false).map((_, i) => i < (editSwitch.used_ports || 0))
                    });
                  }}
                  className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                />
                <input
                  type="text"
                  placeholder="IP Address"
                  value={editSwitch.ip_address || ''}
                  onChange={(e) => setEditSwitch({...editSwitch, ip_address: e.target.value})}
                  className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                />
                <select
                  value={editSwitch.status || 'active'}
                  onChange={(e) => setEditSwitch({...editSwitch, status: e.target.value as 'active' | 'inactive'})}
                  className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
                <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={editSwitch.is_poe || false}
                    onChange={(e) => setEditSwitch({...editSwitch, is_poe: e.target.checked})}
                    className="rounded"
                  />
                  PoE (Power over Ethernet)
                </label>
              </div>
            ) : (
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Nome do Rack"
                  value={editRack.name || ''}
                  onChange={(e) => setEditRack({...editRack, name: e.target.value})}
                  className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                  required
                />
                <select
                  value={editRack.sector || ''}
                  onChange={(e) => setEditRack({...editRack, sector: e.target.value})}
                  className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                  required
                >
                  <option value="">Selecione o Setor</option>
                  {sectors.map(sector => (
                    <option key={sector} value={sector}>{sector}</option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="Total de Unidades (U)"
                  value={editRack.total_units || 42}
                  onChange={(e) => setEditRack({...editRack, total_units: parseInt(e.target.value)})}
                  className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                />
                <input
                  type="number"
                  placeholder="Unidades Utilizadas"
                  value={editRack.used_units || 0}
                  onChange={(e) => setEditRack({...editRack, used_units: parseInt(e.target.value)})}
                  className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                />
                <input
                  type="text"
                  placeholder="Localização"
                  value={editRack.location || ''}
                  onChange={(e) => setEditRack({...editRack, location: e.target.value})}
                  className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                  required
                />
                <select
                  value={editRack.status || 'active'}
                  onChange={(e) => setEditRack({...editRack, status: e.target.value as 'active' | 'inactive'})}
                  className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </div>
            )}
            
            <div className="flex gap-2 mt-6">
              <button
                onClick={showEditForm.type === 'switch' ? updateSwitch : updateRack}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                <Check className="w-4 h-4 inline mr-2" />
                Salvar
              </button>
              <button
                onClick={() => {
                  setShowEditForm(null);
                  setEditSwitch({});
                  setEditRack({});
                }}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
              >
                <X className="w-4 h-4 inline mr-2" />
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showPortsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-[600px] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Gerenciar Portas - {showPortsModal.name}
              </h2>
              <button
                onClick={() => setShowPortsModal(null)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Modelo: {showPortsModal.model} | IP: {showPortsModal.ip_address || 'N/A'}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Portas Ativas: {showPortsModal.used_ports}/{showPortsModal.total_ports}
              </p>
            </div>

            <div className="grid grid-cols-6 gap-2">
              {(showPortsModal.ports_status || []).map((isActive, index) => (
                <div key={index} className="text-center">
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                    P{index + 1}
                  </div>
                  <button
                    onClick={() => showPortsModal.id && togglePortStatus(showPortsModal.id, index)}
                    className={`w-12 h-12 rounded-lg border-2 transition-all duration-200 ${
                      isActive
                        ? 'bg-green-100 dark:bg-green-800/20 border-green-400 text-green-700 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-400'
                    } hover:scale-105`}
                  >
                    <Power className="w-4 h-4 mx-auto" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowPortsModal(null)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Concluído
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'switches' ? (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {switches.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Network className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Nenhum switch encontrado</p>
            </div>
          ) : (
            switches.map((switch_item) => (
              <div
                key={switch_item.id}
                className={`
                  relative overflow-hidden rounded-2xl shadow-sm transition-all duration-200 shadow-xl dark:shadow-gray-500/30
                  ${switch_item.status === 'active' 
                    ? 'bg-blue-50 dark:bg-blue-800/20 border-2 border-blue-200 dark:border-blue-800' 
                    : 'bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700'}
                `}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Network className={`w-6 h-6 ${switch_item.status === 'active' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{switch_item.name}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{switch_item.model}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setShowPortsModal(switch_item)}
                        className="p-2 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-800/20 rounded-lg transition-colors"
                        title="Gerenciar Portas"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEditForm('switch', switch_item)}
                        className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800/20 rounded-lg transition-colors"
                        title="Editar Switch"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => switch_item.id && deleteSwitch(switch_item.id)}
                        className="p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-800/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Setor:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{switch_item.sector}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">IP:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{switch_item.ip_address || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Posição Rack:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{switch_item.rack_position}U</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">Portas:</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPortUtilization(switch_item.used_ports, switch_item.total_ports)}`}>
                        {switch_item.used_ports}/{switch_item.total_ports}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">PoE:</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        switch_item.is_poe 
                          ? 'bg-green-100 dark:bg-green-800/20 text-green-600 dark:text-green-400' 
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}>
                        {switch_item.is_poe ? 'Sim' : 'Não'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">Status:</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        switch_item.status === 'active' 
                          ? 'bg-green-100 dark:bg-green-800/20 text-green-600 dark:text-green-400' 
                          : 'bg-red-100 dark:bg-red-800/20 text-red-600 dark:text-red-400'
                      }`}>
                        {switch_item.status === 'active' ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {racks.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Server className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Nenhum rack encontrado</p>
            </div>
          ) : (
            racks.map((rack) => (
              <div
                key={rack.id}
                className={`
                  relative overflow-hidden rounded-2xl shadow-sm transition-all duration-200 shadow-xl dark:shadow-gray-500/30
                  ${rack.status === 'active' 
                    ? 'bg-purple-50 dark:bg-purple-800/20 border-2 border-purple-200 dark:border-purple-800' 
                    : 'bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700'}
                `}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Server className={`w-6 h-6 ${rack.status === 'active' ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400'}`} />
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{rack.name}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{rack.sector}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEditForm('rack', rack)}
                        className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800/20 rounded-lg transition-colors"
                        title="Editar Rack"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => rack.id && deleteRack(rack.id)}
                        className="p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-800/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Localização:</span>
                      <span className="font-medium text-right text-gray-900 dark:text-gray-100">{rack.location}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">Unidades:</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getUnitUtilization(rack.used_units, rack.total_units)}`}>
                        {rack.used_units}/{rack.total_units}U
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">Status:</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        rack.status === 'active' 
                          ? 'bg-green-100 dark:bg-green-800/20 text-green-600 dark:text-green-400' 
                          : 'bg-red-100 dark:bg-red-800/20 text-red-600 dark:text-red-400'
                      }`}>
                        {rack.status === 'active' ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}