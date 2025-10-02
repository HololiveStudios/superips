// components/SwapScaleModal.tsx
import React, { useState } from 'react';
import { X, Save, RefreshCw, AlertTriangle } from 'lucide-react';
import type { Scale } from '../../types';

interface SwapScaleModalProps {
  scale: Scale;
  allScales: Scale[];
  onClose: () => void;
  onSave: (swapData: any) => Promise<void>;
}

const SwapScaleModal: React.FC<SwapScaleModalProps> = ({ scale, allScales, onClose, onSave }) => {
  const isReserve = scale.sector === 'Almoxarifado';
  
  const availableScales = isReserve
    ? allScales.filter(s => s.id !== scale.id && s.sector !== 'Almoxarifado')
    : allScales.filter(s => s.id !== scale.id && s.sector === 'Almoxarifado');

  const [formData, setFormData] = useState({
    replacementScaleId: '',
    swapReason: '',
    swapDate: new Date().toISOString().split('T')[0]
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.replacementScaleId) {
      setError('Selecione uma balança para troca');
      return;
    }

    if (!formData.swapReason.trim()) {
      setError('Informe o motivo da troca');
      return;
    }

    setIsSaving(true);
    setError(null);
    
    try {
      await onSave({
        currentScaleId: scale.id,
        replacementScaleId: parseInt(formData.replacementScaleId),
        isCurrentReserve: isReserve,
        swapReason: formData.swapReason,
        swapDate: formData.swapDate
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao realizar troca');
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
            <RefreshCw className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            <div>
              <h2 className="text-lg sm:text-xl font-semibold">Trocar Balança</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {isReserve ? 'Ativar balança reserva' : 'Substituir por reserva'}
              </p>
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
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h3 className="font-medium mb-2">Balança Atual</h3>
            <div className="space-y-1 text-sm">
              <p><strong>Setor:</strong> {scale.sector || '-'}</p>
              <p><strong>N.PAT:</strong> {scale.npat || '-'}</p>
              <p><strong>Modelo:</strong> {scale.model || '-'}</p>
              <p><strong>IP:</strong> {scale.ip || 'RESERVA'}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Selecionar Balança para {isReserve ? 'Ativação' : 'Substituição'}
            </label>
            <select
              value={formData.replacementScaleId}
              onChange={(e) => setFormData(prev => ({ ...prev, replacementScaleId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              required
            >
              <option value="">Selecione uma balança...</option>
              {availableScales.map(s => (
                <option key={s.id} value={s.id}>
                  {s.sector || s.name} - {s.npat} - {s.model || 'Sem modelo'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Motivo da Troca *</label>
            <textarea
              value={formData.swapReason}
              onChange={(e) => setFormData(prev => ({ ...prev, swapReason: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
              placeholder="Ex: Defeito na célula de carga, calibração incorreta, display com problema..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Data da Troca</label>
            <input
              type="date"
              value={formData.swapDate}
              onChange={(e) => setFormData(prev => ({ ...prev, swapDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p className="text-sm text-amber-700 dark:text-amber-300">
              <strong>Atenção:</strong> {isReserve 
                ? 'A balança reserva assumirá o IP e o setor da balança ativa. A balança ativa retornará ao almoxarifado.'
                : 'A balança atual será substituída pela reserva e retornará ao almoxarifado com o motivo da troca registrado.'}
            </p>
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
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white rounded-lg transition-colors duration-200"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Realizando Troca...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Confirmar Troca
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SwapScaleModal;