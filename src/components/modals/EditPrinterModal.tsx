import React, { useState } from 'react';
import { X, Save, Printer as PrinterIcon, Building2 } from 'lucide-react';
import type { Printer } from '../../types';

interface EditPrinterModalProps {
  printer: Printer;
  onClose: () => void;
  onSave: (printer: Printer) => Promise<void>;
}

const RENTAL_TYPES = {
  'Propria': { name: 'Própria', color: 'blue', description: 'Impressora da empresa' },
  'ArtCores': { name: 'ArtCores', color: 'green', description: 'Contrato ArtCores' },
  'Mundial': { name: 'Mundial', color: 'purple', description: 'Contrato Mundial' }
};

const EditPrinterModal: React.FC<EditPrinterModalProps> = ({ printer, onClose, onSave }) => {
  const [formData, setFormData] = useState<Printer>({
    ...printer,
    rental_type: printer.rental_type || 'Propria'
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleInputChange = (field: keyof Printer, value: string | number) => {
    setFormData((prev: Printer) => ({
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
            <PrinterIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div>
              <h2 className="text-lg sm:text-xl font-semibold">Editar Impressora</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">{printer.name}</p>
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
          {/* Tipo de Aluguel */}
          <div>
            <label className="block text-sm font-medium mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Tipo de Impressora
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {Object.entries(RENTAL_TYPES).map(([type, config]) => (
                <label
                  key={type}
                  className={`
                    relative flex flex-col p-4 rounded-xl border-2 cursor-pointer transition-all duration-200
                    ${formData.rental_type === type
                      ? `border-${config.color}-500 bg-${config.color}-50 dark:bg-${config.color}-900/20`
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }
                  `}
                >
                  <input
                    type="radio"
                    name="rental_type"
                    value={type}
                    checked={formData.rental_type === type}
                    onChange={(e) => handleInputChange('rental_type', e.target.value)}
                    className="sr-only"
                  />
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{config.name}</span>
                    <div className={`w-4 h-4 rounded-full border-2 ${
                      formData.rental_type === type
                        ? `border-${config.color}-500 bg-${config.color}-500`
                        : 'border-gray-300 dark:border-gray-600'
                    }`}>
                      {formData.rental_type === type && (
                        <div className="w-full h-full rounded-full bg-white transform scale-50"></div>
                      )}
                    </div>
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">{config.description}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Informações Básicas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Nome/Setor</label>
              <input
                type="text"
                value={formData.sector || ''}
                onChange={(e) => handleInputChange('sector', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: Financeiro, RH, TI..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Endereço IP</label>
              <input
                type="text"
                value={formData.ip}
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
                placeholder="HP LaserJet, Brother DCP..."
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

          {/* Leituras do Contador */}
          <div>
            <h3 className="text-lg font-medium mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
              Leituras do Contador
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Leitura Inicial</label>
                <input
                  type="number"
                  min="0"
                  value={formData.li || ''}
                  onChange={(e) => handleInputChange('li', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                />
                <p className="text-xs text-gray-500 mt-1">Contador no início do período</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Leitura Final</label>
                <input
                  type="number"
                  min="0"
                  value={formData.lf || ''}
                  onChange={(e) => handleInputChange('lf', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                />
                <p className="text-xs text-gray-500 mt-1">Contador atual</p>
              </div>
            </div>
            
            {(formData.li !== null && formData.li !== undefined) && 
             (formData.lf !== null && formData.lf !== undefined) && 
             formData.lf > 0 && formData.li > 0 && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>Páginas impressas no período:</strong> {(formData.lf - formData.li).toLocaleString()}
                </p>
              </div>
            )}
          </div>

          {/* Status */}
          <div>
            <h3 className="text-lg font-medium mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
              Status da Impressora
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Status Online</label>
                <select
                  value={formData.online}
                  onChange={(e) => handleInputChange('online', parseInt(e.target.value) as 0 | 1)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={1}>Leitura Concluída</option>
                  <option value={0}>Leitura Pendente</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Status Operacional</label>
                <select
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', parseInt(e.target.value) as 0 | 1)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={1}>Online/Funcionando</option>
                  <option value={0}>Offline/Com Problema</option>
                </select>
              </div>
            </div>
          </div>

          {/* Botões de Ação */}
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

export default EditPrinterModal;