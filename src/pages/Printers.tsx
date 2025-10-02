import { useEffect, useState } from 'react';
import type { Printer } from '../types';
import { Activity, Power, Printer as PrinterIcon, CheckCircle2, Clock, RefreshCcw, Edit, Settings, Download, Calculator, Filter, Building2, Save, Plus, RefreshCw } from 'lucide-react';
import { Switch } from '../components/ui/switch';
import EditPrinterModal from '../components/modals/EditPrinterModal';
import AddReservePrinterModal from '../components/modals/AddReservePrinterModal';
import { apiService } from '../services/api';
import SwapPrinterModal from '../components/modals/SwapPrinterModal';

interface CostSettings {
  monthlyRental: number;
  includedPages: number;
  excessCostPerPage: number;
}

interface RentalTypeSettings {
  [key: string]: CostSettings;
}

const RENTAL_TYPES: { [key: string]: { name: string; color: 'blue' | 'green' | 'purple' } } = {
  'Propria': { name: 'Própria', color: 'blue' },
  'ArtCores': { name: 'ArtCores', color: 'green' },
  'Mundial': { name: 'Mundial', color: 'purple' }
};

const colorClasses: Record<'blue' | 'green' | 'purple', { bg: string; border: string; text: string; textBold: string }> = {
  blue: {
    bg: 'bg-blue-50/50 dark:bg-blue-950/30',
    border: 'border-blue-100 dark:border-blue-900/50',
    text: 'text-blue-600 dark:text-blue-400',
    textBold: 'text-blue-700 dark:text-blue-300'
  },
  green: {
    bg: 'bg-emerald-50/50 dark:bg-emerald-950/30',
    border: 'border-emerald-100 dark:border-emerald-900/50',
    text: 'text-emerald-600 dark:text-emerald-400',
    textBold: 'text-emerald-700 dark:text-emerald-300'
  },
  purple: {
    bg: 'bg-purple-50/50 dark:bg-purple-950/30',
    border: 'border-purple-100 dark:border-purple-900/50',
    text: 'text-purple-600 dark:text-purple-400',
    textBold: 'text-purple-700 dark:text-purple-300'
  }
};

const exportToExcel = (printers: Printer[], settings: RentalTypeSettings, rentalType?: string) => {
  const filteredPrinters = rentalType ? printers.filter(p => p.rental_type === rentalType) : printers;
  
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

  let totalPagesUsed = 0;
  let totalIncludedPages = 0;
  let totalExcessPages = 0;
  let totalExcessCost = 0;
  let totalCost = 0;
  let totalRentalCost = 0;

  const csvData = filteredPrinters.map(printer => {
    const hasValidReading = (printer.li || 0) !== 0 && (printer.lf || 0) !== 0;
    const pagesUsed = hasValidReading ? Math.max(0, (printer.lf || 0) - (printer.li || 0)) : 0;
    const typeSettings = settings[printer.rental_type] || settings['Propria'];
    const includedPages = printer.rental_type === 'Propria' ? pagesUsed : (hasValidReading ? Math.min(pagesUsed, typeSettings.includedPages) : 0);
    const excessPages = printer.rental_type === 'Propria' ? 0 : (hasValidReading ? Math.max(0, pagesUsed - typeSettings.includedPages) : 0);
    const excessCost = excessPages * typeSettings.excessCostPerPage;
    const printerTotalCost = printer.rental_type === 'Propria' ? 0 : typeSettings.monthlyRental + excessCost;
    
    totalPagesUsed += pagesUsed;
    totalIncludedPages += includedPages;
    totalExcessPages += excessPages;
    totalExcessCost += excessCost;
    totalCost += printerTotalCost;
    totalRentalCost += printer.rental_type === 'Propria' ? 0 : typeSettings.monthlyRental;
    
    return [
      printer.name,
      printer.ip || 'RESERVA',
      printer.model || '-',
      printer.sector || '-',
      printer.npat || '-',
      RENTAL_TYPES[printer.rental_type]?.name || printer.rental_type,
      printer.li || 0,
      printer.lf || 0,
      pagesUsed,
      includedPages,
      excessPages,
      excessCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00',
      printerTotalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00',
    ];
  });

  const emptyRow = new Array(headers.length).fill('');
  const totalsRow = [
    'TOTAIS GERAIS',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    totalPagesUsed,
    totalIncludedPages,
    totalExcessPages,
    totalExcessCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00',
    totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'
  ];

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
    '',
    totalRentalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'
  ];

  const csvContent = [
    headers, 
    ...csvData,
    emptyRow,
    totalsRow,
    rentalInfoRow
  ]
    .map(row => row.map(field => `"${field}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  const typeFilter = rentalType ? `_${RENTAL_TYPES[rentalType]?.name || rentalType}` : '_completo';
  link.setAttribute('download', `impressoras_aluguel${typeFilter}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const calculatePrinterCosts = (printer: Printer, settings: RentalTypeSettings) => {
  const hasValidReading = (printer.li || 0) !== 0 && (printer.lf || 0) !== 0;
  const pagesUsed = hasValidReading ? Math.max(0, (printer.lf || 0) - (printer.li || 0)) : 0;
  
  if (printer.rental_type === 'Propria') {
    return {
      pagesUsed,
      includedPages: pagesUsed,
      excessPages: 0,
      monthlyRental: 0,
      excessCost: 0,
      totalCost: 0,
      hasValidReading
    };
  }

  let typeSettings = settings[printer.rental_type];
  
  if (!typeSettings) {
    typeSettings = settings['ArtCores'];
  }
  
  if (!typeSettings) {
    typeSettings = {
      monthlyRental: 150.00,
      includedPages: 3000,
      excessCostPerPage: 0.05
    };
  }

  if (!hasValidReading) {
    return {
      pagesUsed: 0,
      includedPages: 0,
      excessPages: 0,
      monthlyRental: typeSettings.monthlyRental,
      excessCost: 0,
      totalCost: typeSettings.monthlyRental,
      hasValidReading
    };
  }

  const includedPages = Math.min(pagesUsed, typeSettings.includedPages);
  const excessPages = Math.max(0, pagesUsed - typeSettings.includedPages);
  const excessCost = excessPages * typeSettings.excessCostPerPage;
  const totalCost = typeSettings.monthlyRental + excessCost;

  return {
    pagesUsed,
    includedPages,
    excessPages,
    monthlyRental: typeSettings.monthlyRental,
    excessCost,
    totalCost,
    hasValidReading
  };
};


export default function Printers() {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingPrinters, setUpdatingPrinters] = useState<Set<number>>(new Set());
  const [editingPrinter, setEditingPrinter] = useState<Printer | null>(null);
  const [selectedRentalType, setSelectedRentalType] = useState<string>('ArtCores');
  const [showSettings, setShowSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [showAddReserve, setShowAddReserve] = useState(false);
  const [swappingPrinter, setSwappingPrinter] = useState<Printer | null>(null);

  const [rentalTypeSettings, setRentalTypeSettings] = useState<RentalTypeSettings>({
    'Propria': {
      monthlyRental: 0,
      includedPages: 0,
      excessCostPerPage: 0
    },
    'ArtCores': {
      monthlyRental: 160,
      includedPages: 3000,
      excessCostPerPage: 0.05
    },
    'Mundial': {
      monthlyRental: 180,
      includedPages: 2500,
      excessCostPerPage: 0.06
    }
  });

  const handleSwapPrinter = async (swapData: any) => {
  try {
    await apiService.swapPrinter(swapData);
    
    const data = await apiService.getPrinters();
    const convertedData: Printer[] = data.map((printer: any) => ({
      ...printer,
      online: printer.online ? 1 : 0,
      status: printer.status ? 1 : 0,
      rental_type: printer.rental_type || 'Propria'
    }));
    setPrinters(convertedData);
    setSwappingPrinter(null);
  } catch (error) {
    console.error('Error swapping printer:', error);
    throw error;
  }
};

  const loadSettingsFromDatabase = async () => {
    try {
      const data = await apiService.getRentalSettings();
      
      const settings: RentalTypeSettings = {};
      
      Object.keys(RENTAL_TYPES).forEach(type => {
        settings[type] = {
          monthlyRental: type === 'Propria' ? 0 : 160,
          includedPages: type === 'Propria' ? 0 : 3000,
          excessCostPerPage: type === 'Propria' ? 0 : 0.05
        };
      });

      data.forEach((setting: any) => {
        settings[setting.rental_type] = {
          monthlyRental: parseFloat(setting.monthly_rental) || 0,
          includedPages: parseInt(setting.included_pages) || 0,
          excessCostPerPage: parseFloat(setting.excess_cost_per_page) || 0
        };
      });

      setRentalTypeSettings(settings);
    } catch (error) {
      console.error('Error loading settings from database:', error);
    }
  };

  const saveSettingsToDatabase = async () => {
    setIsSavingSettings(true);
    try {
      await apiService.updateRentalSettings(rentalTypeSettings);
      console.log('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings to database:', error);
      setError(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  useEffect(() => {
    loadSettingsFromDatabase();
  }, []);

useEffect(() => {
  const fetchPrinters = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiService.getPrinters();

      if (!Array.isArray(data)) {
        throw new Error('Dados inválidos recebidos da API');
      }

      const convertedData: Printer[] = data.map((printer: any) => ({
        ...printer,
        online: printer.online ? 1 : 0,
        status: printer.status ? 1 : 0,
        rental_type: printer.rental_type || 'Propria'
      }));

      setPrinters(convertedData);
    } catch (err: any) {
      console.error('Erro ao buscar impressoras:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  };

  fetchPrinters();
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
      await apiService.updatePrinterOnlineStatus(printerId, currentOnline as 0 | 1);
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
      const savedPrinter = await apiService.updatePrinter(updatedPrinter.id, updatedPrinter);
      
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

  const handleAddReservePrinter = async (printerData: any) => {
    try {
      const newPrinter = await apiService.createReservePrinter(printerData);
      setPrinters(prev => [...prev, {
        ...newPrinter,
        online: Number(newPrinter.online) as 0 | 1,
        status: Number(newPrinter.status) as 0 | 1
      }]);
      setShowAddReserve(false);
    } catch (error) {
      console.error('Error adding reserve printer:', error);
      throw error;
    }
  };

  
  const handleSettingsChange = (rentalType: string, field: keyof CostSettings, value: number) => {
    setRentalTypeSettings(prev => ({
      ...prev,
      [rentalType]: {
        ...prev[rentalType],
        [field]: value
      }
    }));
  };

  const filteredPrinters = selectedRentalType 
    ? printers.filter(printer => printer.rental_type === selectedRentalType).sort((a, b) => {
        const npatA = String(a.npat || '');
        const npatB = String(b.npat || '');
        return npatA.localeCompare(npatB, undefined, { numeric: true, sensitivity: 'base' });
      })
    : printers.sort((a, b) => {
        const npatA = String(a.npat || '');
        const npatB = String(b.npat || '');
        return npatA.localeCompare(npatB, undefined, { numeric: true, sensitivity: 'base' });
      });

  const globalTotalsByType = Object.keys(RENTAL_TYPES).reduce((acc, type) => {
    const typePrinters = printers.filter(p => p.rental_type === type);
    const totals = typePrinters.reduce((totals, printer) => {
      const costs = calculatePrinterCosts(printer, rentalTypeSettings);
      return {
        count: totals.count + 1,
        totalPagesUsed: totals.totalPagesUsed + costs.pagesUsed,
        totalIncludedPages: totals.totalIncludedPages + costs.includedPages,
        totalExcessPages: totals.totalExcessPages + costs.excessPages,
        totalRentalFees: totals.totalRentalFees + costs.monthlyRental,
        totalExcessCost: totals.totalExcessCost + costs.excessCost,
        totalCost: totals.totalCost + costs.totalCost
      };
    }, {
      count: 0,
      totalPagesUsed: 0,
      totalIncludedPages: 0,
      totalExcessPages: 0,
      totalRentalFees: 0,
      totalExcessCost: 0,
      totalCost: 0
    });
    acc[type] = totals;
    return acc;
  }, {} as Record<string, any>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50/50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl p-4 text-red-600 dark:text-red-400">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 mx-auto">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Impressoras</h1>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowAddReserve(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition-all duration-200 text-sm font-medium shadow-sm hover:shadow"
            >
              <Plus className="w-4 h-4" />
              Adicionar Reserva
            </button>
            <button
              onClick={() => exportToExcel(printers, rentalTypeSettings)}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all duration-200 text-sm font-medium shadow-sm hover:shadow"
            >
              <Download className="w-4 h-4" />
              Exportar
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium shadow-sm ${
                showSettings 
                  ? 'bg-indigo-600 text-white shadow' 
                  : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              <Settings className="w-4 h-4" />
              Configurações
            </button>
          </div>
        </div>

        {showSettings && (
          <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-gray-700 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <Calculator className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Configurações de Custo
              </h3>
              <button
                onClick={saveSettingsToDatabase}
                disabled={isSavingSettings}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 shadow-sm ${
                  isSavingSettings
                    ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed text-gray-500'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow'
                }`}
              >
                {isSavingSettings ? (
                  <RefreshCcw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {isSavingSettings ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {Object.entries(RENTAL_TYPES).map(([type, config]) => (
                <div key={type} className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                  <h4 className="font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                    <Building2 className="w-4 h-4 text-gray-500" />
                    {config.name}
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium mb-1.5 text-gray-600 dark:text-gray-400">Aluguel Mensal (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        disabled={type === 'Propria'}
                        value={rentalTypeSettings[type]?.monthlyRental || 0}
                        onChange={(e) => handleSettingsChange(type, 'monthlyRental', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 disabled:bg-gray-50 dark:disabled:bg-gray-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5 text-gray-600 dark:text-gray-400">Páginas Incluídas</label>
                      <input
                        type="number"
                        min="0"
                        disabled={type === 'Propria'}
                        value={rentalTypeSettings[type]?.includedPages || 0}
                        onChange={(e) => handleSettingsChange(type, 'includedPages', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 disabled:bg-gray-50 dark:disabled:bg-gray-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5 text-gray-600 dark:text-gray-400">Custo Excedente (R$/pág)</label>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        disabled={type === 'Propria'}
                        value={rentalTypeSettings[type]?.excessCostPerPage || 0}
                        onChange={(e) => handleSettingsChange(type, 'excessCostPerPage', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 disabled:bg-gray-50 dark:disabled:bg-gray-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <Filter className="w-4 h-4" />
            Filtrar por tipo
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedRentalType('')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                !selectedRentalType 
                  ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 shadow-md' 
                  : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              Todos <span className="ml-1.5 opacity-75">({printers.length})</span>
            </button>
            {Object.entries(RENTAL_TYPES).map(([type, config]) => (
              <button
                key={type}
                onClick={() => setSelectedRentalType(type)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  selectedRentalType === type
                    ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 shadow-md' 
                    : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                {config.name} <span className="ml-1.5 opacity-75">({globalTotalsByType[type]?.count || 0})</span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 mb-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="grid grid-cols-3 gap-3 flex-1">
              {Object.entries(RENTAL_TYPES).map(([type, config]) => {
                const totals = globalTotalsByType[type] || {};
                const isSelected = !selectedRentalType || selectedRentalType === type;
                
                if (!isSelected) return null;

                const colors = colorClasses[config.color];

                return (
                  <div key={type} className={`${colors.bg} border ${colors.border} rounded-xl p-4 shadow-sm`}>
                    <div className="text-center">
                      <p className={`text-xs font-medium ${colors.text} mb-1.5`}>{config.name}</p>
                      <p className={`text-xl font-bold ${colors.textBold} mb-0.5`}>
                        {type === 'Propria'
                          ? totals.totalPagesUsed?.toLocaleString('pt-BR') || '0'
                          : totals.totalCost?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'}
                      </p>
                      <p className={`text-xs ${colors.text} opacity-75`}>
                        {totals.count || 0} {totals.count === 1 ? 'impressora' : 'impressoras'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {selectedRentalType && (
              <button
                onClick={() => exportToExcel(printers, rentalTypeSettings, selectedRentalType)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all duration-200 text-sm font-medium shadow-sm hover:shadow whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                Exportar {RENTAL_TYPES[selectedRentalType]?.name}
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-emerald-100 dark:bg-emerald-900/50 rounded-full border border-emerald-200 dark:border-emerald-800"></div>
            <span className="text-gray-600 dark:text-gray-400 font-medium">Dentro do limite</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-amber-100 dark:bg-amber-900/50 rounded-full border border-amber-200 dark:border-amber-800"></div>
            <span className="text-gray-600 dark:text-gray-400 font-medium">Com excesso</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-slate-100 dark:bg-slate-800/50 rounded-full border border-slate-200 dark:border-slate-700"></div>
            <span className="text-gray-600 dark:text-gray-400 font-medium">Leitura pendente</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-100 dark:bg-yellow-900/50 rounded-full border border-yellow-200 dark:border-yellow-800"></div>
            <span className="text-gray-600 dark:text-gray-400 font-medium">Reserva</span>
          </div>
        </div>
      </div>

      <div className="grid gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {filteredPrinters.map((printer) => {
          const costs = calculatePrinterCosts(printer, rentalTypeSettings);
          const hasExcess = costs.excessPages > 0;
          const isReserve = printer.sector === 'Almoxarifado';

          return (
            <div
              key={printer.id}
              className={`
                relative overflow-hidden rounded-2xl transition-all duration-200 shadow-sm hover:shadow-md
                ${isReserve
                  ? 'bg-gradient-to-br from-yellow-50 to-yellow-100/50 dark:from-yellow-950/30 dark:to-yellow-900/20 border border-yellow-200 dark:border-yellow-900/50'
                  : printer.online === 1
                    ? hasExcess 
                      ? 'bg-gradient-to-br from-amber-50 to-orange-50/50 dark:from-amber-950/30 dark:to-orange-900/20 border border-amber-200 dark:border-amber-900/50'
                      : 'bg-gradient-to-br from-emerald-50 to-teal-50/50 dark:from-emerald-950/30 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-900/50'
                    : 'bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-900/50 dark:to-gray-900/30 border border-slate-200 dark:border-slate-700'}
              `}
            >
              {updatingPrinters.has(printer.id) && (
                <div className="absolute inset-0 bg-white/60 dark:bg-black/40 backdrop-blur-sm flex items-center justify-center z-10">
                  <RefreshCcw className="w-6 h-6 animate-spin text-indigo-600 dark:text-indigo-400" />
                </div>
              )}
              
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <PrinterIcon className={`w-5 h-5 flex-shrink-0 ${
                      isReserve 
                        ? 'text-yellow-600 dark:text-yellow-500'
                        : printer.online === 1 
                          ? 'text-emerald-600 dark:text-emerald-500' 
                          : 'text-slate-600 dark:text-slate-500'
                    }`} />
                    <h3 className="text-lg font-semibold truncate text-gray-900 dark:text-gray-100">{printer.sector || 'Reserva'}</h3>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                    {!isReserve && (
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                          printer.status === 1
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                        }`}
                      >
                        {printer.status === 1 ? (
                          <Activity className="w-3 h-3" />
                        ) : (
                          <Power className="w-3 h-3" />
                        )}
                        {printer.status === 1 ? 'Online' : 'Offline'}
                      </span>
                    )}
                    <button
                      onClick={() => setSwappingPrinter(printer)}
                      className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/40 hover:bg-orange-200 dark:hover:bg-orange-900/60 transition-colors duration-200 border border-orange-200 dark:border-orange-800"
                      title="Trocar impressora"
                    >
                      <RefreshCw className="w-4 h-4 text-orange-600 dark:text-orange-500" />
                    </button>
                    <button
                      onClick={() => handleEditPrinter(printer)}
                      className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 hover:bg-indigo-200 dark:hover:bg-indigo-900/60 transition-colors duration-200 border border-indigo-200 dark:border-indigo-800"
                      title="Editar impressora"
                    >
                      <Edit className="w-4 h-4 text-indigo-600 dark:text-indigo-500" />
                    </button>
                  </div>
                </div>

                {isReserve && (
                  <div className="mb-4 p-3 bg-yellow-100/80 dark:bg-yellow-900/40 rounded-xl border border-yellow-200 dark:border-yellow-800">
                    <p className="text-sm text-yellow-700 dark:text-yellow-400 font-semibold text-center">
                      Impressora Reserva - Almoxarifado
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between px-3 py-2 bg-white/60 dark:bg-black/20 rounded-lg backdrop-blur-sm">
                    <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">IP</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate ml-2">{printer.ip || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 bg-white/60 dark:bg-black/20 rounded-lg backdrop-blur-sm">
                    <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">N.PAT</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate ml-2">{printer.npat || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 bg-white/60 dark:bg-black/20 rounded-lg backdrop-blur-sm">
                    <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Modelo</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate ml-2">{printer.model || '-'}</span>
                  </div>
                  {!isReserve && (
                    <>
                      <div className="flex items-center justify-between px-3 py-2 bg-white/60 dark:bg-black/20 rounded-lg backdrop-blur-sm">
                        <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Leitura Inicial</span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{(printer.li || 0).toLocaleString()}</span>
                      </div>

                      <div className="flex items-center justify-between px-3 py-2 bg-white/60 dark:bg-black/20 rounded-lg backdrop-blur-sm">
                        <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Leitura Final</span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{(printer.lf || 0).toLocaleString()}</span>
                      </div>

                      {!costs.hasValidReading && printer.rental_type !== 'Propria' ? (
                        <>
                          <div className="flex items-center justify-center px-3 py-3 bg-amber-50/80 dark:bg-amber-900/40 rounded-lg border border-amber-200 dark:border-amber-800">
                            <span className="text-sm text-amber-700 dark:text-amber-400 font-medium text-center">
                              Aguardando leitura - Cobrando taxa de aluguel
                            </span>
                          </div>

                          <div className="space-y-2 pt-2 border-t border-gray-200/50 dark:border-gray-600/50">
                            <div className="flex items-center justify-between px-3 py-2 bg-violet-50/80 dark:bg-violet-900/40 rounded-lg border border-violet-200 dark:border-violet-800">
                              <span className="text-sm text-violet-700 dark:text-violet-400 font-semibold">Aluguel Mensal</span>
                              <span className="text-sm font-bold text-violet-900 dark:text-violet-300">R$ {costs.monthlyRental.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'}</span>
                            </div>

                            <div className="flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-800 rounded-lg border-2 border-gray-300 dark:border-gray-600">
                              <span className="text-sm text-gray-800 dark:text-gray-200 font-bold">Custo Total</span>
                              <span className="text-lg font-black text-gray-900 dark:text-gray-100">R$ {costs.totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'}</span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between px-3 py-2 bg-sky-50/80 dark:bg-sky-900/40 rounded-lg border border-sky-200 dark:border-sky-800">
                            <span className="text-sm text-sky-700 dark:text-sky-400 font-semibold">Total de Páginas</span>
                            <span className="text-sm font-bold text-sky-900 dark:text-sky-300">{costs.pagesUsed.toLocaleString()}</span>
                          </div>

                          {printer.rental_type !== 'Propria' && (
                            <>
                              <div className="flex items-center justify-between px-3 py-2 bg-teal-50/80 dark:bg-teal-900/40 rounded-lg border border-teal-200 dark:border-teal-800">
                                <span className="text-sm text-teal-700 dark:text-teal-400 font-semibold">Incluídas no Aluguel</span>
                                <span className="text-sm font-bold text-teal-900 dark:text-teal-300">{costs.includedPages.toLocaleString()}</span>
                              </div>

                              {costs.excessPages > 0 && (
                                <div className="flex items-center justify-between px-3 py-2 bg-orange-50/80 dark:bg-orange-900/40 rounded-lg border border-orange-200 dark:border-orange-800">
                                  <span className="text-sm text-orange-700 dark:text-orange-400 font-semibold">Páginas Excedentes</span>
                                  <span className="text-sm font-bold text-orange-900 dark:text-orange-300">{costs.excessPages.toLocaleString()}</span>
                                </div>
                              )}

                              <div className="space-y-2 pt-2 border-t border-gray-200/50 dark:border-gray-600/50">
                                <div className="flex items-center justify-between px-3 py-2 bg-violet-50/80 dark:bg-violet-900/40 rounded-lg border border-violet-200 dark:border-violet-800">
                                  <span className="text-sm text-violet-700 dark:text-violet-400 font-semibold">Aluguel Mensal</span>
                                  <span className="text-sm font-bold text-violet-900 dark:text-violet-300">R$ {costs.monthlyRental.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'}</span>
                                </div>

                                {costs.excessCost > 0 && (
                                  <div className="flex items-center justify-between px-3 py-2 bg-rose-50/80 dark:bg-rose-900/40 rounded-lg border border-rose-200 dark:border-rose-800">
                                    <span className="text-sm text-rose-700 dark:text-rose-400 font-semibold">Custo Excedentes</span>
                                    <span className="text-sm font-bold text-rose-900 dark:text-rose-300">R$ {costs.excessCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'}</span>
                                  </div>
                                )}

                                <div className="flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-800 rounded-lg border-2 border-gray-300 dark:border-gray-600">
                                  <span className="text-sm text-gray-800 dark:text-gray-200 font-bold">Custo Total</span>
                                  <span className="text-lg font-black text-gray-900 dark:text-gray-100">R$ {costs.totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'}</span>
                                </div>
                              </div>
                            </>
                          )}

                          {printer.rental_type === 'Propria' && (
                            <div className="flex items-center justify-center px-3 py-3 bg-indigo-50/80 dark:bg-indigo-900/40 rounded-lg border border-indigo-200 dark:border-indigo-800">
                              <span className="text-sm text-indigo-700 dark:text-indigo-400 font-medium text-center">
                                Impressora própria - sem custos de aluguel
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>

                {!isReserve && (
                  <div className="mt-4 flex items-center justify-between pt-4 border-t border-gray-200/50 dark:border-gray-600/50">
                    <div className="flex items-center gap-2">
                      {printer.online === 1 ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
                          <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Leitura Concluída</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-4 h-4 text-slate-600 dark:text-slate-500" />
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-400">Leitura Pendente</span>
                        </>
                      )}
                    </div>
                    <Switch
                      checked={printer.online === 1}
                      onCheckedChange={(checked) => handlePrinterOnlineChange(printer.id, checked ? 1 : 0)}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {editingPrinter && (
        <EditPrinterModal
          printer={editingPrinter}
          onClose={() => setEditingPrinter(null)}
          onSave={handleSavePrinter}
        />
      )}
      {swappingPrinter && (
        <SwapPrinterModal
          printer={swappingPrinter}
          allPrinters={printers}
          onClose={() => setSwappingPrinter(null)}
          onSave={handleSwapPrinter}
          rentalTypeSettings={rentalTypeSettings}
        />
      )}
      {showAddReserve && (
        <AddReservePrinterModal
          onClose={() => setShowAddReserve(false)}
          onSave={handleAddReservePrinter}
          existingPrinters={printers}
        />
      )}
    </div>
  );
}