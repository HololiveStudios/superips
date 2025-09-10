import { useEffect, useState } from "react";
import { Save, X, Monitor } from "lucide-react";
import type { Box } from "../types";
import { apiService } from "../services/api";

interface EditBoxModalProps {
  box: Box;
  onClose: () => void;
  onSave: (updatedBox: Box) => Promise<void> | void;
}

const EditBoxModal: React.FC<EditBoxModalProps> = ({ box, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    ip: "",
    name: "",
    codigo_acesso: "",
    identificacao: "",
    chave: "",
    status: 0 as 0 | 1,
    power_status: 0 as 0 | 1,
  });

  const [availableIPs, setAvailableIPs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAvailableIPs, setShowAvailableIPs] = useState(false);

  useEffect(() => {
    if (box) {
      setFormData({
        ip: box.ip ?? "",
        name: box.name ?? "",
        codigo_acesso: box.codigo_acesso ?? "",
        identificacao: box.identificacao ?? "",
        chave: box.chave ?? "",
        status: box.status ?? 0,
        power_status: box.power_status ?? 0,
      });
    }
  }, [box]);

  useEffect(() => {
    const fetchAvailableIPs = async () => {
      if (!box.ip) return;
      const networkPrefix = box.ip.split(".").slice(0, 3).join(".");
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
  }, [box.ip]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" ? parseInt(value) || 0 : value || "",
    }));
  };

  const handleIPSelect = (selectedIP: string) => {
    setFormData((prev) => ({ ...prev, ip: selectedIP }));
    setShowAvailableIPs(false);
  };

  const handleSave = () => {
    const finalData: Box = { ...box, ...formData };
    onSave(finalData);
    onClose();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50">
      <div className="bg-gray-900 text-gray-100 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Monitor className="w-6 h-6 text-blue-400" />
            <h2 className="text-lg font-semibold">Editar Caixa</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

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
                <p className="text-xs text-gray-400">Verificando IPs disponíveis...</p>
              ) : availableIPs.length === 0 ? (
                <p className="text-xs text-yellow-400">Nenhum IP disponível</p>
              ) : (
                <div className="grid grid-cols-4 gap-1">
                  {availableIPs.map((ip) => (
                    <button
                      key={ip}
                      type="button"
                      onClick={() => handleIPSelect(ip)}
                      className="text-xs p-2 rounded bg-gray-700 hover:bg-green-600 transition-colors border border-gray-600 hover:border-green-500"
                    >
                      {ip}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Nome */}
        <div className="mb-3">
          <label className="block text-sm mb-1">Nome</label>
          <input
            type="text"
            name="name"
            value={formData.name || ""}
            onChange={handleChange}
            className="w-full p-2 rounded-md bg-gray-800 border border-gray-700 text-gray-100"
          />
        </div>

        {/* Código de Acesso */}
        <div className="mb-3">
          <label className="block text-sm mb-1">Código de Acesso</label>
          <input
            type="text"
            name="codigo_acesso"
            value={formData.codigo_acesso || ""}
            onChange={handleChange}
            className="w-full p-2 rounded-md bg-gray-800 border border-gray-700 text-gray-100 font-mono"
          />
        </div>

        {/* Identificação */}
        <div className="mb-3">
          <label className="block text-sm mb-1">Identificação</label>
          <input
            type="text"
            name="identificacao"
            value={formData.identificacao || ""}
            onChange={handleChange}
            className="w-full p-2 rounded-md bg-gray-800 border border-gray-700 text-gray-100"
          />
        </div>

        {/* Chave */}
        <div className="mb-3">
          <label className="block text-sm mb-1">Chave</label>
          <input
            type="text"
            name="chave"
            value={formData.chave || ""}
            onChange={handleChange}
            className="w-full p-2 rounded-md bg-gray-800 border border-gray-700 text-gray-100 font-mono"
          />
        </div>

        {/* Status */}
        <div className="mb-3">
          <label className="block text-sm mb-1">Status</label>
          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="w-full p-2 rounded-md bg-gray-800 border border-gray-700 text-gray-100"
          >
            <option value={0}>Inativo</option>
            <option value={1}>Ativo</option>
          </select>
        </div>

        {/* Power Status */}
        <div className="mb-3">
          <label className="block text-sm mb-1">Status de Energia</label>
          <select
            name="power_status"
            value={formData.power_status}
            onChange={handleChange}
            className="w-full p-2 rounded-md bg-gray-800 border border-gray-700 text-gray-100"
          >
            <option value={0}>Desligado</option>
            <option value={1}>Ligado</option>
          </select>
        </div>

        <div className="flex justify-end gap-3 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> Salvar
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditBoxModal;
