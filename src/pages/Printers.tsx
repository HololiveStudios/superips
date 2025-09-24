import { useEffect, useState } from 'react';
import type { Printer } from '../types';
import { Activity, Power, Printer as PrinterIcon, CheckCircle2, Clock, RefreshCcw, Edit, Settings, Download, Calculator, AlertTriangle } from 'lucide-react';
import { Switch } from '../components/ui/switch';
import EditPrinterModal from '../components/EditPrinterModal';

// Configurações de custo
interface CostSettings {
  monthlyRental: number;
  includedPages: number;
  excessCostPerPage: number;
}

// Função para exportar para Excel (simulação usando CSV) com linha de totais
const exportToExcel = (printers: Printer[], settings: CostSettings) => {
  const headers = [
    'Nome',
    'IP',
    'Modelo',
    'Setor',
    'N.PAT',
    'Leitura Inicial',
    'Leitura Final',
    'Páginas Impressas',
    'Páginas Incluídas no Aluguel',
    'Páginas Excedentes',
    'Custo Páginas Excedentes (R$)',
    'Custo Total (R$)'
  ];

  // Variáveis para calcular totais
  let totalPagesUsed = 0;
  let totalIncludedPages = 0;
  let totalExcessPages = 0;
  let totalExcessCost = 0;
  let totalCost = 0;
  let totalRentalCost = 0;

  const csvData = printers.map(printer => {
    const pagesUsed = Math.max(0, (printer.lf || 0) - (printer.li || 0));
    const includedPages = Math.min(pagesUsed, settings.includedPages);
    const excessPages = Math.max(0, pagesUsed - settings.includedPages);
    const excessCost = excessPages * settings.excessCostPerPage;
    const printerTotalCost = settings.monthlyRental + excessCost;
    
    // Acumular totais
    totalPagesUsed += pagesUsed;
    totalIncludedPages += includedPages;
    totalExcessPages += excessPages;
    totalExcessCost += excessCost;
    totalCost += printerTotalCost;
    totalRentalCost += settings.monthlyRental;
    
    return [
      printer.name,
      printer.ip,
      printer.model || '-',
      printer.sector || '-',
      printer.npat || '-',
      printer.li || 0,
      printer.lf || 0,
      pagesUsed,
      includedPages,
      excessPages,
      excessCost.toFixed(2),
      printerTotalCost.toFixed(2),
    ];
  });

  // Linha vazia para separação
  const emptyRow = new Array(headers.length).fill('');
  
  // Linha de totais
  const totalsRow = [
    'TOTAIS GERAIS',
    '',
    '',
    '',
    '',
    '',
    '',
    totalPagesUsed,
    totalIncludedPages,
    totalExcessPages,
    totalExcessCost.toFixed(2),
    totalCost.toFixed(2)
  ];

  // Linha adicional com informações do aluguel
  const rentalInfoRow = [
    'Aluguel Total Mensal',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    totalRentalCost.toFixed(2)
  ];

  // Linha com custo apenas de excedentes
  const excessOnlyRow = [
    'Custo Total Excedentes',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    totalExcessPages,
    totalExcessCost.toFixed(2),
    ''
  ];

  const csvContent = [
    headers, 
    ...csvData,
    emptyRow,
    totalsRow,
    rentalInfoRow,
    excessOnlyRow
  ]
    .map(row => row.map(field => `"${field}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `impressoras_aluguel_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Função para calcular custos de uma impressora
const calculatePrinterCosts = (printer: Printer, settings: CostSettings) => {
  const pagesUsed = Math.max(0, (printer.lf || 0) - (printer.li || 0));
  const includedPages = Math.min(pagesUsed, settings.includedPages);
  const excessPages = Math.max(0, pagesUsed - settings.includedPages);
  const excessCost = excessPages * settings.excessCostPerPage;
  const totalCost = settings.monthlyRental + excessCost;

  return {
    pagesUsed,
    includedPages,
    excessPages,
    monthlyRental: settings.monthlyRental,
    excessCost,
    totalCost
  };
};

export default function Printers() {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingPrinters, setUpdatingPrinters] = useState<Set<number>>(new Set());
  const [editingPrinter, setEditingPrinter] = useState<Printer | null>(null);
  
  // Estados para configuração de custos
  const [showSettings, setShowSettings] = useState(false);
  const [costSettings, setCostSettings] = useState<CostSettings>(() => {
    const saved = localStorage.getItem('printerCostSettings');
    return saved ? JSON.parse(saved) : {
      monthlyRental: 150.00, // Aluguel mensal fixo por impressora
      includedPages: 3000, // Páginas incluídas no aluguel
      excessCostPerPage: 0.05 // R$ 0,05 por página excedente
    };
  });

  // Salvar configurações no localStorage
  useEffect(() => {
    localStorage.setItem('printerCostSettings', JSON.stringify(costSettings));
  }, [costSettings]);

  useEffect(() => {
    const fetchPrinters = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_SERVER}:${import.meta.env.VITE_PORT}/api/printers`, {
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch printers');
        }

        const data: Printer[] = await response.json();
        const convertedData = data.map(printer => ({
          ...printer,
          online: Number(printer.online) as 0 | 1,
          status: Number(printer.status) as 0 | 1
        }));
        setPrinters(Array.isArray(data) ? convertedData : []);
      } catch (error) {
        console.error('Fetch printers error:', error);
        setError(error instanceof Error ? error.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPrinters();
    const interval = setInterval(fetchPrinters, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const handlePrinterOnlineChange = async (printerId: number, currentOnline: number) => {
    if (updatingPrinters.has(printerId)) return;

    setPrinters(prevPrinters =>
      prevPrinters.map(printer =>
        printer.id === printerId
          ? { ...printer, online: currentOnline as 0 | 1 }
          : printer
      )
    );

    setUpdatingPrinters(prev => new Set(prev).add(printerId));

    try {
      const response = await fetch(`${import.meta.env.VITE_SERVER}:${import.meta.env.VITE_PORT}/api/printers/${printerId}/online`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ online: currentOnline }),
      });

      if (!response.ok) {
        throw new Error('Failed to update printer status');
      }
    } catch (error) {
      console.error('Error updating printer online status:', error);
      setPrinters(prevPrinters =>
        prevPrinters.map(printer =>
          printer.id === printerId ? { ...printer, online: currentOnline === 1 ? 0 : 1 } : printer
        )
      );
    } finally {
      setUpdatingPrinters(prev => {
        const next = new Set(prev);
        next.delete(printerId);
        return next;
      });
    }
  };

  const handleEditPrinter = (printer: Printer) => {
    setEditingPrinter(printer);
  };

  const handleSavePrinter = async (updatedPrinter: Printer) => {
    try {
      const payload = {
        name: updatedPrinter.name,
        ip: updatedPrinter.ip,
        online: updatedPrinter.online,
        status: updatedPrinter.status,
        sector: updatedPrinter.sector,
        model: updatedPrinter.model,
        user: updatedPrinter.user,
        npat: updatedPrinter.npat,
        li: updatedPrinter.li,
        lf: updatedPrinter.lf
      };

      const response = await fetch(`${import.meta.env.VITE_SERVER}:${import.meta.env.VITE_PORT}/api/printers/${updatedPrinter.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update printer: ${response.status} - ${errorText}`);
      }

      const savedPrinter = await response.json();
      
      setPrinters(prevPrinters =>
        prevPrinters.map(printer =>
          printer.id === savedPrinter.id 
            ? { 
                ...savedPrinter, 
                online: Number(savedPrinter.online) as 0 | 1,
                status: Number(savedPrinter.status) as 0 | 1
              }
            : printer
        )
      );
      setEditingPrinter(null);
    } catch (error) {
      console.error('Error updating printer:', error);
      setError(error instanceof Error ? error.message : 'Failed to update printer');
    }
  };

  const handleCloseEditModal = () => {
    setEditingPrinter(null);
  };

  const handleSettingsChange = (field: keyof CostSettings, value: number) => {
    setCostSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Calcular totais globais
  const globalTotals = printers.reduce((totals, printer) => {
    const costs = calculatePrinterCosts(printer, costSettings);
    return {
      totalPagesUsed: totals.totalPagesUsed + costs.pagesUsed,
      totalIncludedPages: totals.totalIncludedPages + costs.includedPages,
      totalExcessPages: totals.totalExcessPages + costs.excessPages,
      totalRentalFees: totals.totalRentalFees + costs.monthlyRental,
      totalExcessCost: totals.totalExcessCost + costs.excessCost,
      totalCost: totals.totalCost + costs.totalCost
    };
  }, {
    totalPagesUsed: 0,
    totalIncludedPages: 0,
    totalExcessPages: 0,
    totalRentalFees: 0,
    totalExcessCost: 0,
    totalCost: 0
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 text-red-600 dark:text-red-400">
        Error: {error}
      </div>
    );
  }

  return (
    <div>
      {/* Header com configurações e exportação */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold">Impressoras - Gestão de Aluguel</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => exportToExcel(printers, costSettings)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors duration-200"
            >
              <Download className="w-4 h-4" />
              Exportar Relatório
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors duration-200 ${
                showSettings 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <Settings className="w-4 h-4" />
              Configurações de Aluguel
            </button>
          </div>
        </div>

        {/* Painel de configurações */}
        {showSettings && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 mb-6">
            <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              Configurações de Aluguel por Impressora
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Aluguel Mensal (R$):</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={costSettings.monthlyRental}
                  onChange={(e) => handleSettingsChange('monthlyRental', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                />
                <p className="text-xs text-gray-500 mt-1">Valor fixo mensal por impressora</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Páginas Incluídas no Aluguel:</label>
                <input
                  type="number"
                  min="0"
                  value={costSettings.includedPages}
                  onChange={(e) => handleSettingsChange('includedPages', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                />
                <p className="text-xs text-gray-500 mt-1">Páginas incluídas sem custo adicional</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Custo por Página Excedente (R$):</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={costSettings.excessCostPerPage}
                  onChange={(e) => handleSettingsChange('excessCostPerPage', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                />
                <p className="text-xs text-gray-500 mt-1">Custo adicional por página acima do limite</p>
              </div>
            </div>
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Como funciona o sistema de aluguel:</h4>
              <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <li>• <strong>Aluguel fixo:</strong> R$ {costSettings.monthlyRental.toFixed(2)} por impressora/mês</li>
                <li>• <strong>Inclui:</strong> Até {costSettings.includedPages.toLocaleString()} páginas sem custo adicional</li>
                <li>• <strong>Excedente:</strong> R$ {costSettings.excessCostPerPage.toFixed(3)} por página acima de {costSettings.includedPages.toLocaleString()}</li>
                <li>• <strong>Fórmula:</strong> Custo Total = Aluguel Fixo + (Páginas Excedentes × R$ {costSettings.excessCostPerPage.toFixed(3)})</li>
              </ul>
            </div>
          </div>
        )}

        {/* Resumo geral */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 dark:text-blue-400">Total Páginas</p>
                <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{globalTotals.totalPagesUsed.toLocaleString()}</p>
              </div>
              <PrinterIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 dark:text-green-400">Páginas Incluídas</p>
                <p className="text-xl font-bold text-green-700 dark:text-green-300">{globalTotals.totalIncludedPages.toLocaleString()}</p>
              </div>
              <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>

          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 dark:text-orange-400">Páginas Excedentes</p>
                <p className="text-xl font-bold text-orange-700 dark:text-orange-300">{globalTotals.totalExcessPages.toLocaleString()}</p>
              </div>
              <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
          </div>

          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 dark:text-purple-400">Total Aluguéis</p>
                <p className="text-xl font-bold text-purple-700 dark:text-purple-300">R$ {globalTotals.totalRentalFees.toFixed(2)}</p>
              </div>
              <Settings className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>

          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 dark:text-red-400">Custo Excedentes</p>
                <p className="text-xl font-bold text-red-700 dark:text-red-300">R$ {globalTotals.totalExcessCost.toFixed(2)}</p>
              </div>
              <Calculator className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Custo Total Mensal</p>
                <p className="text-xl font-bold text-gray-700 dark:text-gray-300">R$ {globalTotals.totalCost.toFixed(2)}</p>
              </div>
              <Calculator className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </div>
          </div>
        </div>

        {/* Legenda */}
        <div className="flex gap-4 mt-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-100 dark:bg-green-800 rounded-full"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Dentro do limite</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-orange-100 dark:bg-orange-700 rounded-full"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Com excesso</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-100 dark:bg-gray-700 rounded-full"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Leitura pendente</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {printers.map((printer) => {
          const costs = calculatePrinterCosts(printer, costSettings);
          const hasExcess = costs.excessPages > 0;

          return (
            <div
              key={printer.id}
              className={`
                relative overflow-hidden rounded-2xl transition-all duration-200 shadow-xl dark:shadow-gray-500/30
                ${printer.online === 1 
                  ? hasExcess 
                    ? 'bg-orange-50 dark:bg-orange-800/20 border-2 border-orange-200 dark:border-orange-800'
                    : 'bg-green-50 dark:bg-green-800/20 border-2 border-green-200 dark:border-green-800'
                  : 'bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700'}
              `}
            >
              {updatingPrinters.has(printer.id) && (
                <div className="absolute inset-0 bg-black/5 dark:bg-white/5 flex items-center justify-center">
                  <RefreshCcw className="w-6 h-6 animate-spin text-indigo-600 dark:text-indigo-400" />
                </div>
              )}
              
              {hasExcess && (
                <div className="absolute top-2 right-2 bg-orange-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Excesso
                </div>
              )}
              
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <PrinterIcon className={`w-5 h-5 ${printer.online === 1 ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`} />
                    <h3 className="text-lg font-medium">{printer.sector}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEditPrinter(printer)}
                      className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors duration-200"
                      title="Editar impressora"
                    >
                      <Edit className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </button>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        printer.status === 1
                          ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                          : 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                      }`}
                    >
                      {printer.status === 1 ? (
                        <Activity className="w-3 h-3 mr-1" />
                      ) : (
                        <Power className="w-3 h-3 mr-1" />
                      )}
                      {printer.status === 1 ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Informações básicas */}
                  <div className="flex items-center justify-between px-3 py-2 bg-white/50 dark:bg-black/20 rounded-2xl">
                    <span className="text-sm text-gray-600 dark:text-gray-400">IP Address</span>
                    <span className="text-sm font-medium">{printer.ip}</span>
                  </div>

                  <div className="flex items-center justify-between px-3 py-2 bg-white/50 dark:bg-black/20 rounded-2xl">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Modelo</span>
                    <span className="text-sm font-medium">{printer.model || '-'}</span>
                  </div>

                  <div className="flex items-center justify-between px-3 py-2 bg-white/50 dark:bg-black/20 rounded-2xl">
                    <span className="text-sm text-gray-600 dark:text-gray-400">N.PAT</span>
                    <span className="text-sm font-medium">{printer.npat || '-'}</span>
                  </div>

                  {/* Leituras */}
                  <div className="flex items-center justify-between px-3 py-2 bg-white/50 dark:bg-black/20 rounded-2xl">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Leitura Inicial</span>
                    <span className="text-sm font-medium">{(printer.li || 0).toLocaleString()}</span>
                  </div>

                  <div className="flex items-center justify-between px-3 py-2 bg-white/50 dark:bg-black/20 rounded-2xl">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Leitura Final</span>
                    <span className="text-sm font-medium">{(printer.lf || 0).toLocaleString()}</span>
                  </div>

                  {/* Informações de consumo */}
                  <div className="flex items-center justify-between px-3 py-2 bg-blue-50 dark:bg-blue-900/30 rounded-2xl border border-blue-200 dark:border-blue-800">
                    <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">Total de Páginas</span>
                    <span className="text-sm font-bold text-blue-700 dark:text-blue-300">{costs.pagesUsed.toLocaleString()}</span>
                  </div>

                  <div className="flex items-center justify-between px-3 py-2 bg-green-50 dark:bg-green-900/30 rounded-2xl border border-green-200 dark:border-green-800">
                    <span className="text-sm text-green-600 dark:text-green-400 font-medium">Incluídas no Aluguel</span>
                    <span className="text-sm font-bold text-green-700 dark:text-green-300">{costs.includedPages.toLocaleString()}</span>
                  </div>

                  {costs.excessPages > 0 && (
                    <div className="flex items-center justify-between px-3 py-2 bg-orange-50 dark:bg-orange-900/30 rounded-2xl border border-orange-200 dark:border-orange-800">
                      <span className="text-sm text-orange-600 dark:text-orange-400 font-medium">Páginas Excedentes</span>
                      <span className="text-sm font-bold text-orange-700 dark:text-orange-300">{costs.excessPages.toLocaleString()}</span>
                    </div>
                  )}

                  {/* Custos */}
                  <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                    <div className="flex items-center justify-between px-3 py-2 bg-purple-50 dark:bg-purple-900/30 rounded-2xl border border-purple-200 dark:border-purple-800">
                      <span className="text-sm text-purple-600 dark:text-purple-400 font-medium">Aluguel Mensal</span>
                      <span className="text-sm font-bold text-purple-700 dark:text-purple-300">R$ {costs.monthlyRental.toFixed(2)}</span>
                    </div>

                    {costs.excessCost > 0 && (
                      <div className="flex items-center justify-between px-3 py-2 bg-red-50 dark:bg-red-900/30 rounded-2xl border border-red-200 dark:border-red-800">
                        <span className="text-sm text-red-600 dark:text-red-400 font-medium">Custo Excedentes</span>
                        <span className="text-sm font-bold text-red-700 dark:text-red-300">R$ {costs.excessCost.toFixed(2)}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-2xl border-2 border-gray-300 dark:border-gray-600">
                      <span className="text-sm text-gray-700 dark:text-gray-300 font-bold">Custo Total</span>
                      <span className="text-lg font-black text-gray-900 dark:text-gray-100">R$ {costs.totalCost.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    {printer.online === 1 ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                        <span className="text-sm font-medium text-green-600 dark:text-green-400">Leitura Concluída</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Leitura Pendente</span>
                      </>
                    )}
                  </div>
                  <Switch
                    checked={printer.online === 1}
                    onCheckedChange={(checked) => handlePrinterOnlineChange(printer.id, checked ? 1 : 0)}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {editingPrinter && (
        <EditPrinterModal
          printer={editingPrinter}
          onClose={handleCloseEditModal}
          onSave={handleSavePrinter}
        />
      )}
    </div>
  );
}