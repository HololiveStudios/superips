import { useEffect, useState } from 'react';
import { Monitor, CheckCircle2, Clock, Edit } from 'lucide-react';
import { Switch } from '../components/ui/switch';
import type { Box } from '../types';
import EditBoxModal from '../components/EditBoxModal';

export default function Boxes() {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingBox, setEditingBox] = useState<Box | null>(null);

  useEffect(() => {
    const sanitizeBoxes = (arr: Box[]) => {
      const out: Box[] = [];
      const seen = new Set<string>();
      for (let i = 0; i < (arr || []).length; i++) {
        const b = arr[i];
        const key = `${b?.device_id ?? 'no-id'}-${b?.ip ?? 'no-ip'}-${b?.name ?? 'no-name'}`;
        if (seen.has(key)) {
          console.warn('Duplicate box skipped:', key, b);
          continue;
        }
        seen.add(key);
        out.push(b);
      }
      return out;
    };

    const fetchBoxes = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_SERVER}:${import.meta.env.VITE_PORT}/api/boxes`, {
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) throw new Error('Failed to fetch boxes');

        const data: Box[] = await response.json();
        const sanitizedData = sanitizeBoxes(data.map(box => ({
          ...box,
          power_status: Number(box.power_status) as 0 | 1,
          status: Number(box.status) as 0 | 1
        })));
        setBoxes(Array.isArray(data) ? sanitizedData : []);
      } catch (err) {
        console.error('Failed to fetch boxes:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBoxes();
    const interval = setInterval(fetchBoxes, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const togglePowerStatus = async (device_id: number, newPowerStatus: 0 | 1) => {
    setBoxes((prev) =>
      prev.map((box) =>
        box.device_id === device_id
          ? { ...box, power_status: newPowerStatus }
          : box
      )
    );

    try {
      const response = await fetch(`${import.meta.env.VITE_SERVER}:${import.meta.env.VITE_PORT}/api/boxes/${device_id}/power-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ power_status: newPowerStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update box power status');
      }
    } catch (error) {
      console.error('Failed to update box power status:', error);
      setBoxes((prev) =>
        prev.map((box) =>
          box.device_id === device_id
            ? { ...box, power_status: newPowerStatus === 1 ? 0 : 1 }
            : box
        )
      );
    }
  };

  const handleEditBox = (box: Box) => {
    setEditingBox(box);
  };

  const handleSaveBox = async (updatedBox: Box) => {
    try {
      const payload = {
        name: updatedBox.name,
        ip: updatedBox.ip,
        power_status: updatedBox.power_status,
        status: updatedBox.status,
        chave: updatedBox.chave,
        codigo_acesso: updatedBox.codigo_acesso,
        identificacao: updatedBox.identificacao
      };

      const response = await fetch(`${import.meta.env.VITE_SERVER}:${import.meta.env.VITE_PORT}/api/boxes/${updatedBox.device_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update box: ${response.status} - ${errorText}`);
      }

      const savedBox = await response.json();
      
      setBoxes(prevBoxes =>
        prevBoxes.map(box =>
          box.device_id === savedBox.device_id 
            ? { 
                ...savedBox, 
                power_status: Number(savedBox.power_status) as 0 | 1,
                status: Number(savedBox.status) as 0 | 1
              }
            : box
        )
      );
      setEditingBox(null);
    } catch (error) {
      console.error('Error updating box:', error);
      setError(error instanceof Error ? error.message : 'Failed to update box');
    }
  };

  const handleCloseEditModal = () => {
    setEditingBox(null);
  };

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 text-red-600 dark:text-red-400">
        Error: {error}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Caixas</h1>
        <div className="flex gap-4 mt-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-100 dark:bg-green-800 rounded-full"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Concluídas</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-100 dark:bg-gray-700 rounded-full"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Pendentes</span>
          </div>
        </div>
      </div>

      <ul className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {boxes.map((box, idx) => (
          <li
            key={`${box.device_id ?? 'no-id'}-${box.ip ?? 'no-ip'}-${idx}`}
            className={`
              relative overflow-hidden rounded-2xl shadow-sm transition-all duration-200 shadow-xl dark:shadow-gray-500/30
              ${box.power_status === 1 
                ? 'bg-green-50 dark:bg-green-800/20 border-2 border-green-200 dark:border-green-800' 
                : 'bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700'}
            `}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Monitor className={`w-6 h-6 ${box.power_status === 1 ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`} />
                  <div>
                    <h3 className="text-lg font-medium">{box.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{box.ip}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEditBox(box)}
                    className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors duration-200"
                    title="Editar caixa"
                  >
                    <Edit className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </button>
                  <Switch
                    checked={box.power_status === 1}
                    onCheckedChange={(checked) => togglePowerStatus(box.device_id, checked ? 1 : 0)}
                  />
                </div>
              </div>

              {/* Informações detalhadas */}
              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between px-3 py-2 bg-white/50 dark:bg-black/20 rounded-2xl">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Código de Acesso</span>
                  <span className="text-sm font-medium font-mono">{box.codigo_acesso || '-'}</span>
                </div>

                <div className="flex items-center justify-between px-3 py-2 bg-white/50 dark:bg-black/20 rounded-2xl">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Identificação</span>
                  <span className="text-sm font-medium">{box.identificacao || '-'}</span>
                </div>

                <div className="flex items-center justify-between px-3 py-2 bg-white/50 dark:bg-black/20 rounded-2xl">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Chave</span>
                  <span className="text-sm font-medium font-mono">{box.chave || '-'}</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                    box.status === 1
                      ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                      : 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                  }`}
                >
                  {box.status === 1 ? 'Ativo' : 'Inativo'}
                </span>
                <div className="flex items-center gap-2">
                  {box.power_status === 1 ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm font-medium text-green-600 dark:text-green-400">Concluído</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Pendente</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Modal de edição - descomente quando criar o EditBoxModal */}
      {editingBox && (
        <EditBoxModal
          box={editingBox}
          onClose={handleCloseEditModal}
          onSave={handleSaveBox}
        />
      )}
    </div>
  );
}