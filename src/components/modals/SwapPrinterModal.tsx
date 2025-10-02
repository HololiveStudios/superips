import React, { useState, useEffect } from 'react';
import { X, Save, RefreshCw, AlertCircle, Download, Search } from 'lucide-react';
import type { Printer } from '../../types';

interface SwapPrinterModalProps {
  printer: Printer;
  allPrinters: Printer[];
  onClose: () => void;
  onSave: (swapData: any) => Promise<void>;
  rentalTypeSettings: any;
}

const SwapPrinterModal: React.FC<SwapPrinterModalProps> = ({ 
  printer, 
  allPrinters,
  onClose, 
  onSave,
  rentalTypeSettings 
}) => {
  const isCurrentPrinterReserve = printer.sector === 'Almoxarifado';

  const [formData, setFormData] = useState({
    replacementPrinterId: null as number | null,
    currentPrinterReading: isCurrentPrinterReserve ? (printer.li || 0) : (printer.lf || 0),
    newFinalReading: 0,
    swapReason: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const availablePrinters = allPrinters.filter(p => {
    if (p.id === printer.id) return false;
    
    if (isCurrentPrinterReserve) {
      return p.sector !== 'Almoxarifado' && p.ip && p.ip !== 'RESERVA';
    } else {
      return p.sector === 'Almoxarifado';
    }
  }).filter(p => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      (p.name?.toLowerCase().includes(search)) ||
      (p.model?.toLowerCase().includes(search)) ||
      (p.npat?.toLowerCase().includes(search)) ||
      (p.sector?.toLowerCase().includes(search))
    );
  });

  const selectedPrinter = formData.replacementPrinterId 
    ? allPrinters.find(p => p.id === formData.replacementPrinterId)
    : null;

  const exportCurrentPrinterData = () => {
    if (isCurrentPrinterReserve) return;

    const hasValidReading = (printer.li || 0) !== 0 && formData.currentPrinterReading !== 0;
    const pagesUsed = hasValidReading ? Math.max(0, formData.currentPrinterReading - (printer.li || 0)) : 0;
    const typeSettings = rentalTypeSettings[printer.rental_type] || rentalTypeSettings['Propria'];
    const includedPages = printer.rental_type === 'Propria' ? pagesUsed : Math.min(pagesUsed, typeSettings.includedPages);
    const excessPages = printer.rental_type === 'Propria' ? 0 : Math.max(0, pagesUsed - typeSettings.includedPages);
    const excessCost = excessPages * typeSettings.excessCostPerPage;
    const totalCost = printer.rental_type === 'Propria' ? 0 : typeSettings.monthlyRental + excessCost;

    const headers = [
      'Data da Troca',
      'Motivo da Troca',
      'IP',
      'Setor',
      'Modelo Anterior',
      'N.PAT Anterior',
      'Leitura Inicial',
      'Leitura Final',
      'Páginas Impressas',
      'Páginas Incluídas',
      'Páginas Excedentes',
      'Custo Excedentes (R$)',
      'Custo Total (R$)',
      'Novo Modelo',
      'Novo N.PAT',
      'Nova Leitura Inicial'
    ];

    const data = [
      new Date().toLocaleDateString('pt-BR'),
      formData.swapReason,
      printer.ip || 'RESERVA',
      printer.sector,
      printer.model || '-',
      printer.npat || '-',
      printer.li || 0,
      formData.currentPrinterReading,
      pagesUsed,
      includedPages,
      excessPages,
      excessCost.toFixed(2),
      totalCost.toFixed(2),
      selectedPrinter?.model || '-',
      selectedPrinter?.npat || '-',
      selectedPrinter?.li || 0
    ];

    const csvContent = [
      headers.map(h => `"${h}"`).join(','),
      data.map(d => `"${d}"`).join(',')
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `troca_impressora_${printer.sector}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.replacementPrinterId) {
      setError('Selecione uma impressora para substituição');
      return;
    }

    if (formData.currentPrinterReading <= 0) {
      setError('Leitura deve ser maior que zero');
      return;
    }

    if (isCurrentPrinterReserve && formData.newFinalReading <= 0) {
      setError('Nova leitura final deve ser maior que zero');
      return;
    }

    if (!formData.swapReason.trim()) {
      setError('Motivo da troca é obrigatório');
      return;
    }

    setIsSaving(true);
    setError(null);
    
    try {
      if (!isCurrentPrinterReserve) {
        exportCurrentPrinterData();
      }

      await onSave({
        currentPrinterId: printer.id,
        replacementPrinterId: formData.replacementPrinterId,
        currentPrinterReading: formData.currentPrinterReading,
        newFinalReading: isCurrentPrinterReserve ? formData.newFinalReading : undefined,
        isCurrentReserve: isCurrentPrinterReserve,
        swapReason: formData.swapReason,
        swapDate: new Date().toISOString()
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
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            <div>
              <h2 className="text-lg sm:text-xl font-semibold">Trocar Impressora</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {printer.sector} - {printer.ip || 'Reserva'}
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
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h3 className="font-medium mb-2 text-blue-900 dark:text-blue-100">
              Impressora Atual {isCurrentPrinterReserve ? '(Reserva)' : '(Em Uso)'}
            </h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-blue-700 dark:text-blue-300">Setor:</span>
                <span className="ml-2 font-medium">{printer.sector}</span>
              </div>
              <div>
                <span className="text-blue-700 dark:text-blue-300">IP:</span>
                <span className="ml-2 font-medium">{printer.ip || 'RESERVA'}</span>
              </div>
              <div>
                <span className="text-blue-700 dark:text-blue-300">Modelo:</span>
                <span className="ml-2 font-medium">{printer.model || '-'}</span>
              </div>
              <div>
                <span className="text-blue-700 dark:text-blue-300">N.PAT:</span>
                <span className="ml-2 font-medium">{printer.npat || '-'}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Motivo da Troca *</label>
            <textarea
              value={formData.swapReason}
              onChange={(e) => setFormData(prev => ({ ...prev, swapReason: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Ex: Defeito na impressora, mau funcionamento, substituição preventiva..."
              rows={3}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              {isCurrentPrinterReserve 
                ? 'Leitura Inicial (Já cadastrada) *' 
                : 'Leitura Final da Impressora Atual *'
              }
            </label>
            <input
              type="number"
              value={formData.currentPrinterReading}
              onChange={(e) => setFormData(prev => ({ ...prev, currentPrinterReading: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder={isCurrentPrinterReserve ? 'Leitura inicial já registrada' : 'Última leitura antes da troca'}
              disabled={isCurrentPrinterReserve}
              required
            />
            {isCurrentPrinterReserve && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Esta é a leitura inicial já cadastrada da impressora reserva
              </p>
            )}
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="font-medium mb-4 text-green-900 dark:text-green-100">
              Selecionar Impressora {isCurrentPrinterReserve ? 'em Uso para Substituir' : 'Reserva para Substituição'}
            </h3>
            
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por modelo, N.PAT, setor..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>

            {availablePrinters.length === 0 ? (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-center">
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Nenhuma impressora {isCurrentPrinterReserve ? 'em uso' : 'reserva'} disponível para troca
                </p>
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2 border border-gray-200 dark:border-gray-700 rounded-lg p-2">
                {availablePrinters.map((p) => (
                  <label
                    key={p.id}
                    className={`
                      flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all duration-200
                      ${formData.replacementPrinterId === p.id
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }
                    `}
                  >
                    <input
                      type="radio"
                      name="replacement"
                      value={p.id}
                      checked={formData.replacementPrinterId === p.id}
                      onChange={() => setFormData(prev => ({ ...prev, replacementPrinterId: p.id }))}
                      className="sr-only"
                    />
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      formData.replacementPrinterId === p.id
                        ? 'border-green-500 bg-green-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}>
                      {formData.replacementPrinterId === p.id && (
                        <div className="w-2 h-2 rounded-full bg-white"></div>
                      )}
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Setor:</span>
                        <span className="ml-1 font-medium">{p.sector}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">IP:</span>
                        <span className="ml-1 font-medium">{p.ip || 'RESERVA'}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Modelo:</span>
                        <span className="ml-1 font-medium">{p.model || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">N.PAT:</span>
                        <span className="ml-1 font-medium">{p.npat || '-'}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-600 dark:text-gray-400">Leitura {isCurrentPrinterReserve ? 'Final' : 'Inicial'}:</span>
                        <span className="ml-1 font-medium">{isCurrentPrinterReserve ? (p.lf || 0).toLocaleString() : (p.li || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

{isCurrentPrinterReserve && selectedPrinter && (
  <>
    <div>
      <label className="block text-sm font-medium mb-2">Nova Leitura Final (Após Instalação) *</label>
      <input
        type="number"
        value={formData.newFinalReading}
        onChange={(e) => setFormData(prev => ({ ...prev, newFinalReading: parseInt(e.target.value) || 0 }))}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-green-500 focus:border-transparent"
        placeholder="Leitura atual após instalação no setor"
        required
      />
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        Informe a leitura final atual da impressora que está sendo instalada
      </p>
    </div>
  </>
)}

{!isCurrentPrinterReserve && selectedPrinter && (
  <div>
    <label className="block text-sm font-medium mb-2">Nova Leitura Inicial da Reserva *</label>
    <input
      type="number"
      value={formData.newFinalReading}
      onChange={(e) => setFormData(prev => ({ ...prev, newFinalReading: parseInt(e.target.value) || 0 }))}
      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-green-500 focus:border-transparent"
      placeholder="Leitura inicial da impressora reserva"
      required
    />
    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
      Informe a leitura inicial da impressora reserva que será usada
    </p>
  </div>
)}

          {selectedPrinter && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <h4 className="font-medium mb-2 text-green-900 dark:text-green-100">Resumo da Troca</h4>
              <div className="text-sm space-y-1">
                <p><span className="text-green-700 dark:text-green-300">Substituir:</span> {printer.model} ({printer.npat})</p>
                <p><span className="text-green-700 dark:text-green-300">Por:</span> {selectedPrinter.model} ({selectedPrinter.npat})</p>
                {isCurrentPrinterReserve ? (
                  <>
                    <p><span className="text-green-700 dark:text-green-300">Leitura final atual:</span> {(selectedPrinter.lf || 0).toLocaleString()}</p>
                    {formData.newFinalReading > 0 && (
                      <p><span className="text-green-700 dark:text-green-300">Nova leitura final:</span> {formData.newFinalReading.toLocaleString()}</p>
                    )}
                  </>
                ) : (
                  <p><span className="text-green-700 dark:text-green-300">Leitura inicial da reserva:</span> {(selectedPrinter.li || 0).toLocaleString()}</p>
                )}
              </div>
            </div>
          )}

          {!isCurrentPrinterReserve && (
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Download className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-700 dark:text-yellow-300">
                  <p className="font-medium mb-1">Backup Automático</p>
                  <p>Ao confirmar a troca, será gerado automaticamente um arquivo Excel com os dados da impressora substituída.</p>
                </div>
              </div>
            </div>
          )}

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
              disabled={isSaving || !formData.replacementPrinterId}
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

export default SwapPrinterModal;