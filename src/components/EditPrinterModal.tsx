import { useEffect, useState } from 'react';
import type { Printer } from '../types';
import { apiService } from '../services/api';

interface EditPrinterModalProps {
  printer: Printer;
  onClose: () => void;
  onSave: (updatedPrinter: Printer) => Promise<void> | void;
}

const EditPrinterModal: React.FC<EditPrinterModalProps> = ({ printer, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    ip: "",
    name: "",
    sector: "",
    model: "",
    user: "",
    online: 0 as 0 | 1,
    status: 0 as 0 | 1,
    npat: 0,  
    li: "",    
    lf: ""     
  });

  const [availableIPs, setAvailableIPs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAvailableIPs, setShowAvailableIPs] = useState(false);

  // Preenche o formulário com os dados da impressora
  useEffect(() => {
    if (printer) {
      setFormData({
        ip: printer.ip ?? "",
        name: printer.name ?? "",
        sector: printer.sector ?? "",
        model: printer.model ?? "",
        user: printer.user ?? "",
        online: printer.online ?? 0,
        status: printer.status ?? 0,
        npat: printer.npat ?? 0,    
        li: printer.li ?? "",        
        lf: printer.lf ?? ""        
      });
    }
  }, [printer]);

  // Busca IPs livres da mesma rede da impressora
  useEffect(() => {
    const fetchAvailableIPs = async () => {
      if (!printer.ip) return;

      // Extrai o prefixo da rede (ex: "10.0.11")
      const networkPrefix = printer.ip.split('.').slice(0, 3).join('.');

      setIsLoading(true);
      try {
        const available = await apiService.getAvailableIPs(networkPrefix);
        setAvailableIPs(available);
      } catch (err) {
        console.error("Erro ao buscar IPs disponíveis:", err);
        setAvailableIPs([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAvailableIPs();
  }, [printer.ip]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "number" ? parseInt(value) || 0 : value || ""  // CORRIGIDO: Fallback para strings vazias
    }));
  };

  const handleIPSelect = (selectedIP: string) => {
    setFormData(prev => ({ ...prev, ip: selectedIP }));
    setShowAvailableIPs(false);
  };

  const handleSave = () => {
    const finalData: Printer = { ...printer, ...formData };
    onSave(finalData);
    onClose();
  };

  const fieldLabels: Record<string, string> = {
    name: "Nome",
    sector: "Setor", 
    model: "Modelo",
    user: "Usuário",
    npat: "N.PAT",
    li: "Leitura Inicial",  
    lf: "Leitura Final",    
    status: "Status",
    online: "Online"
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50">
      <div className="bg-gray-900 text-gray-100 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
        <h2 className="text-xl font-semibold mb-4">Editar Impressora</h2>

        {/* IP */}
        <div className="mb-3">
          <label className="block text-sm mb-1">Endereço IP</label>
          <div className="flex gap-2">
            <input
              type="text"
              name="ip"
              value={formData.ip || ""}
              onChange={handleChange}
              className="flex-1 p-2 rounded-md bg-gray-800 border border-gray-700 text-gray-100"
            />
            <button
              type="button"
              onClick={() => setShowAvailableIPs(!showAvailableIPs)}
              className="px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm"
            >
              {showAvailableIPs ? "Ocultar" : "IPs Livres"}
            </button>
          </div>

          {showAvailableIPs && (
            <div className="mt-2 p-3 bg-gray-800 border border-gray-700 rounded-md max-h-60 overflow-y-auto">
              {isLoading ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="text-xs text-gray-400 mt-2">Verificando dispositivos...</p>
                </div>
              ) : availableIPs.length === 0 ? (
                <p className="text-xs text-yellow-400">Nenhum IP disponível</p>
              ) : (
                <div className="grid grid-cols-4 gap-1">
                  {availableIPs.map(ip => (
                    <button
                      key={ip}
                      type="button"
                      onClick={() => handleIPSelect(ip)}
                      className="text-xs p-2 rounded bg-gray-700 hover:bg-green-600 transition-colors duration-200 border border-gray-600 hover:border-green-500"
                    >
                      {ip}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Campos de texto */}
        {["name", "sector", "model", "user", "npat", "li", "lf"].map(field => (
          <div className="mb-3" key={field}>
            <label className="block text-sm mb-1">{fieldLabels[field] || field}</label>
            <input
              type="text"
              name={field}
              value={(formData as any)[field] || ""}
              onChange={handleChange}
              className="w-full p-2 rounded-md bg-gray-800 border border-gray-700 text-gray-100"
            />
          </div>
        ))}

        {/* Status */}
        <div className="mb-3">
          <label className="block text-sm mb-1">Status</label>
          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="w-full p-2 rounded-md bg-gray-800 border border-gray-700 text-gray-100"
          >
            <option value={0}>Offline</option>
            <option value={1}>Online</option>
          </select>
        </div>

        {/* Online */}
        <div className="mb-3">
          <label className="block text-sm mb-1">Concluído</label>
          <select
            name="online"
            value={formData.online}
            onChange={handleChange}
            className="w-full p-2 rounded-md bg-gray-800 border border-gray-700 text-gray-100"
          >
            <option value={0}>Pendente</option>
            <option value={1}>Concluído</option>
          </select>
        </div>

        {/* Ações */}
        <div className="flex justify-end gap-3 mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditPrinterModal;