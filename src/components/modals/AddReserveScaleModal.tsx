// components/AddReserveScaleModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Save, Scale as ScaleIcon, AlertCircle } from 'lucide-react';

interface AddReserveScaleModalProps {
  onClose: () => void;
  onSave: (scale: any) => Promise<void>;
  existingScales: any[];
}

const AddReserveScaleModal: React.FC<AddReserveScaleModalProps> = ({ onClose, onSave, existingScales }) => {
  const [formData, setFormData] = useState({
    ip: null,
    name: '',
    sector: 'Almoxarifado',
    model: '',
    npat: '',
    user: 'TI',
    online: 0,
    defect_reason: null
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const reserveScales = existingScales.filter(s => 
      s.sector === 'Almoxarifado' && /RESERVA/i.test(s.name)
    );
    
    const nextNumber = reserveScales.length + 1;
    
    setFormData(prev => ({
      ...prev,
      name: `RESERVA_${nextNumber}`
    }));
  }, [existingScales]);

  const handleInputChange = (field: string, value: string | number | null) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.npat.trim()) {
      setError('N.PAT é obrigatório');
      return;
    }

    setIsSaving(true);
    setError(null);
    
    try {
      await onSave(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar balança');
      setIsSaving(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <ScaleIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            <div>
              <h2 className="text-lg sm:text-xl font-semibold">Adicionar Balança RESERVA</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Almoxarifado</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              Esta balança será cadastrada como <strong>{formData.name}</strong> no almoxarifado. O IP poderá ser adicionado posteriormente através da edição.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Nome/Identificação</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="RESERVA_1, RESERVA_2..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">N.PAT (Patrimônio) *</label>
              <input
                type="text"
                value={formData.npat}
                onChange={(e) => handleInputChange('npat', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Número do patrimônio"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Modelo</label>
              <input
                type="text"
                value={formData.model}
                onChange={(e) => handleInputChange('model', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Toledo, Filizola, Urano..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Responsável</label>
              <input
                type="text"
                value={formData.user}
                onChange={(e) => handleInputChange('user', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Nome do responsável"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg transition-colors duration-200"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Adicionar RESERVA
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddReserveScaleModal;