// components/EditScaleModal.tsx
import React, { useState } from 'react';
import { X, Save, Scale as ScaleIcon, AlertTriangle } from 'lucide-react';
import type { Scale } from '../../types';

interface EditScaleModalProps {
  scale: Scale;
  onClose: () => void;
  onSave: (scale: Scale) => Promise<void>;
}

const EditScaleModal: React.FC<EditScaleModalProps> = ({ scale, onClose, onSave }) => {
  const [formData, setFormData] = useState<Scale>({
    ...scale
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleInputChange = (field: keyof Scale, value: string | number) => {
    setFormData((prev: Scale) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      await onSave(formData);
    } finally {
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
            <ScaleIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div>
              <h2 className="text-lg sm:text-xl font-semibold">Editar Balança</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">{scale.sector || scale.name}</p>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Nome/Setor</label>
              <input
                type="text"
                value={formData.sector || ''}
                onChange={(e) => handleInputChange('sector', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: Expedição, Recebimento..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Endereço IP</label>
              <input
                type="text"
                value={formData.ip || ''}
                onChange={(e) => handleInputChange('ip', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="192.168.1.100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Modelo</label>
              <input
                type="text"
                value={formData.model || ''}
                onChange={(e) => handleInputChange('model', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Toledo, Filizola, Urano..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">N.PAT (Patrimônio)</label>
              <input
                type="text"
                value={formData.npat || ''}
                onChange={(e) => handleInputChange('npat', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Número do patrimônio"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Usuário Responsável</label>
            <input
              type="text"
              value={formData.user || ''}
              onChange={(e) => handleInputChange('user', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Nome do usuário responsável"
            />
          </div>

          <div>
            <h3 className="text-lg font-medium mb-4 pb-2 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              Informações de Defeito
            </h3>
            <div>
              <label className="block text-sm font-medium mb-2">Motivo do Defeito (se houver)</label>
              <textarea
                value={formData.defect_reason || ''}
                onChange={(e) => handleInputChange('defect_reason', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Descreva o problema com a balança..."
              />
              <p className="text-xs text-gray-500 mt-1">Deixe em branco se a balança estiver funcionando normalmente</p>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
              online da Balança
            </h3>
            <div>
              <label className="block text-sm font-medium mb-2">online Operacional</label>
              <select
                value={formData.online}
                onChange={(e) => handleInputChange('online', parseInt(e.target.value) as 0 | 1)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={1}>Funcionando</option>
                <option value={0}>Com Problema</option>
              </select>
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
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors duration-200"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Salvar Alterações
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditScaleModal;