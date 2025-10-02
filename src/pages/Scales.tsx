// pages/Scales.tsx - CORRIGIDO (remover npat)
import { useEffect, useState } from 'react';
import type { Scale } from '@/types';
import { Scale as ScaleIcon, CheckCircle2, Clock, Edit, Settings, Download, Filter, Plus, AlertTriangle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import EditScaleModal from '@/components/modals/EditScaleModal';
import AddReserveScaleModal from '@/components/modals/AddReserveScaleModal';
import { apiService } from '@/services/api';
import SwapScaleModal from '@/components/modals/SwapScaleModal';

const exportToExcel = (scales: Scale[]) => {
  const headers = [
    'Nome',
    'IP',
    'Modelo',
    'Setor',
    'online',
    'Motivo do Defeito'
  ];

  const csvData = scales.map(scale => [
    scale.name,
    scale.ip || 'RESERVA',
    scale.model || '-',
    scale.sector || '-',
    scale.online === 1 ? 'Funcionando' : 'Com Problema',
    scale.defect_reason || '-'
  ]);

  const csvContent = [headers, ...csvData]
    .map(row => row.map(field => `"${field}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `balancas_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export default function Scales() {
  const [scales, setScales] = useState<Scale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingScales, setUpdatingScales] = useState<Set<number>>(new Set());
  const [editingScale, setEditingScale] = useState<Scale | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'active' | 'reserve' | 'defect'>('all');
  const [showAddReserve, setShowAddReserve] = useState(false);
  const [swappingScale, setSwappingScale] = useState<Scale | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    reserve: 0,
    withDefect: 0,
    online: 0
  });

  const handleSwapScale = async (swapData: any) => {
    try {
      await apiService.swapScale(swapData);
      const data = await apiService.getScales();
      setScales(data);
      setSwappingScale(null);
      loadStats();
    } catch (error) {
      console.error('Error swapping scale:', error);
      throw error;
    }
  };

  const loadStats = async () => {
    try {
      const data = await apiService.getScaleStats();
      setStats(data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  useEffect(() => {
    const fetchScales = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await apiService.getScales();
        setScales(data);
        await loadStats();
      } catch (err: any) {
        console.error('Erro ao buscar balanças:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setIsLoading(false);
      }
    };

    fetchScales();
  }, []);

  const handleScaleonlineChange = async (scaleId: number, currentonline: number) => {
    if (updatingScales.has(scaleId)) return;

    setScales(prevScales =>
      prevScales.map(scale =>
        scale.id === scaleId
          ? { ...scale, online: currentonline as 0 | 1 }
          : scale
      )
    );

    setUpdatingScales(prev => new Set(prev).add(scaleId));

    try {
      await apiService.updateScaleStatus(scaleId, currentonline as 0 | 1);
      await loadStats();
    } catch (error) {
      console.error('Error updating scale online:', error);
      setScales(prevScales =>
        prevScales.map(scale =>
          scale.id === scaleId ? { ...scale, online: currentonline === 1 ? 0 : 1 } : scale
        )
      );
    } finally {
      setUpdatingScales(prev => {
        const next = new Set(prev);
        next.delete(scaleId);
        return next;
      });
    }
  };

  const handleEditScale = (scale: Scale) => {
    setEditingScale(scale);
  };

  const handleSaveScale = async (updatedScale: Scale) => {
    try {
      const savedScale = await apiService.updateScale(updatedScale.id, updatedScale);
      setScales(prevScales =>
        prevScales.map(scale =>
          scale.id === savedScale.id 
            ? { 
                ...savedScale, 
                online: Number(savedScale.online) as 0 | 1
              }
            : scale
        )
      );
      setEditingScale(null);
      await loadStats();
    } catch (error) {
      console.error('Error updating scale:', error);
      setError(error instanceof Error ? error.message : 'Failed to update scale');
    }
  };

  const handleAddReserveScale = async (scaleData: any) => {
    try {
      const newScale = await apiService.createReserveScale(scaleData);
      setScales(prev => [...prev, {
        ...newScale,
        online: Number(newScale.online) as 0 | 1
      }]);
      setShowAddReserve(false);
      await loadStats();
    } catch (error) {
      console.error('Error adding reserve scale:', error);
      throw error;
    }
  };

  const filteredScales = scales.filter(scale => {
    if (filterType === 'all') return true;
    if (filterType === 'active') return scale.sector !== 'Almoxarifado';
    if (filterType === 'reserve') return scale.sector === 'Almoxarifado';
    if (filterType === 'defect') return scale.defect_reason;
    return true;
  }).sort((a, b) => {
    const nameA = String(a.name || a.sector || '');
    const nameB = String(b.name || b.sector || '');
    return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
  });

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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Balanças</h1>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowAddReserve(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition-all duration-200 text-sm font-medium shadow-sm hover:shadow"
            >
              <Plus className="w-4 h-4" />
              Adicionar Reserva
            </button>
            <button
              onClick={() => exportToExcel(scales)}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all duration-200 text-sm font-medium shadow-sm hover:shadow"
            >
              <Download className="w-4 h-4" />
              Exportar
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <Filter className="w-4 h-4" />
            Filtrar
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterType('all')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                filterType === 'all'
                  ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 shadow-md' 
                  : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              Todas <span className="ml-1.5 opacity-75">({stats.total})</span>
            </button>
            <button
              onClick={() => setFilterType('active')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                filterType === 'active'
                  ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 shadow-md' 
                  : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              Ativas <span className="ml-1.5 opacity-75">({stats.active})</span>
            </button>
            <button
              onClick={() => setFilterType('reserve')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                filterType === 'reserve'
                  ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 shadow-md' 
                  : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              Reservas <span className="ml-1.5 opacity-75">({stats.reserve})</span>
            </button>
            <button
              onClick={() => setFilterType('defect')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                filterType === 'defect'
                  ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 shadow-md' 
                  : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              Com Defeito <span className="ml-1.5 opacity-75">({stats.withDefect})</span>
            </button>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 mb-6 shadow-sm">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-blue-50/80 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">Total</p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-300">{stats.total}</p>
            </div>
            <div className="bg-emerald-50/80 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">Ativas</p>
              <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-300">{stats.active}</p>
            </div>
            <div className="bg-purple-50/80 dark:bg-purple-900/40 border border-purple-200 dark:border-purple-800 rounded-xl p-4">
              <p className="text-xs font-medium text-purple-600 dark:text-purple-400 mb-1">Reservas</p>
              <p className="text-2xl font-bold text-purple-900 dark:text-purple-300">{stats.reserve}</p>
            </div>
            <div className="bg-orange-50/80 dark:bg-orange-900/40 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
              <p className="text-xs font-medium text-orange-600 dark:text-orange-400 mb-1">Com Defeito</p>
              <p className="text-2xl font-bold text-orange-900 dark:text-orange-300">{stats.withDefect}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-emerald-100 dark:bg-emerald-900/50 rounded-full border border-emerald-200 dark:border-emerald-800"></div>
            <span className="text-gray-600 dark:text-gray-400 font-medium">Funcionando</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-100 dark:bg-red-900/50 rounded-full border border-red-200 dark:border-red-800"></div>
            <span className="text-gray-600 dark:text-gray-400 font-medium">Com problema</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-100 dark:bg-yellow-900/50 rounded-full border border-yellow-200 dark:border-yellow-800"></div>
            <span className="text-gray-600 dark:text-gray-400 font-medium">Reserva</span>
          </div>
        </div>
      </div>

      <div className="grid gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        {filteredScales.map((scale) => {
          const isReserve = scale.sector === 'Almoxarifado';
          const hasDefect = !!scale.defect_reason;

          return (
            <div
              key={scale.id}
              className={`
                relative overflow-hidden rounded-2xl transition-all duration-200 shadow-sm hover:shadow-md
                ${isReserve
                  ? 'bg-gradient-to-br from-yellow-50 to-yellow-100/50 dark:from-yellow-950/30 dark:to-yellow-900/20 border border-yellow-200 dark:border-yellow-900/50'
                  : hasDefect
                    ? 'bg-gradient-to-br from-red-50 to-orange-50/50 dark:from-red-950/30 dark:to-orange-900/20 border border-red-200 dark:border-red-900/50'
                    : scale.online === 1
                      ? 'bg-gradient-to-br from-emerald-50 to-teal-50/50 dark:from-emerald-950/30 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-900/50'
                      : 'bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-900/50 dark:to-gray-900/30 border border-slate-200 dark:border-slate-700'}
              `}
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <ScaleIcon className={`w-5 h-5 flex-shrink-0 ${
                      isReserve 
                        ? 'text-yellow-600 dark:text-yellow-500'
                        : hasDefect
                          ? 'text-red-600 dark:text-red-500'
                          : scale.online === 1 
                            ? 'text-emerald-600 dark:text-emerald-500' 
                            : 'text-slate-600 dark:text-slate-500'
                    }`} />
                    <h3 className="text-lg font-semibold truncate text-gray-900 dark:text-gray-100">{scale.sector || scale.name || 'Sem setor'}</h3>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                    {!isReserve && (
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                          scale.online === 1
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                        }`}
                      >
                        {scale.online === 1 ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <AlertTriangle className="w-3 h-3" />
                        )}
                        {scale.online === 1 ? 'OK' : 'Problema'}
                      </span>
                    )}
                    <button
                      onClick={() => setSwappingScale(scale)}
                      className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/40 hover:bg-orange-200 dark:hover:bg-orange-900/60 transition-colors duration-200 border border-orange-200 dark:border-orange-800"
                      title="Trocar balança"
                    >
                      <Settings className="w-4 h-4 text-orange-600 dark:text-orange-500" />
                    </button>
                    <button
                      onClick={() => handleEditScale(scale)}
                      className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 hover:bg-indigo-200 dark:hover:bg-indigo-900/60 transition-colors duration-200 border border-indigo-200 dark:border-indigo-800"
                      title="Editar balança"
                    >
                      <Edit className="w-4 h-4 text-indigo-600 dark:text-indigo-500" />
                    </button>
                  </div>
                </div>

                {isReserve && (
                  <div className="mb-4 p-3 bg-yellow-100/80 dark:bg-yellow-900/40 rounded-xl border border-yellow-200 dark:border-yellow-800">
                    <p className="text-sm text-yellow-700 dark:text-yellow-400 font-semibold text-center">
                      Balança Reserva - Almoxarifado
                    </p>
                  </div>
                )}

                {hasDefect && !isReserve && (
                  <div className="mb-4 p-3 bg-red-100/80 dark:bg-red-900/40 rounded-xl border border-red-200 dark:border-red-800">
                    <p className="text-xs text-red-600 dark:text-red-400 font-medium mb-1">Motivo do Defeito:</p>
                    <p className="text-sm text-red-700 dark:text-red-300 font-semibold">{scale.defect_reason}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between px-3 py-2 bg-white/60 dark:bg-black/20 rounded-lg backdrop-blur-sm">
                    <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">IP</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate ml-2">{scale.ip || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 bg-white/60 dark:bg-black/20 rounded-lg backdrop-blur-sm">
                    <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Modelo</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate ml-2">{scale.model || '-'}</span>
                  </div>
                  {scale.user && (
                    <div className="flex items-center justify-between px-3 py-2 bg-white/60 dark:bg-black/20 rounded-lg backdrop-blur-sm">
                      <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Responsável</span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate ml-2">{scale.user}</span>
                    </div>
                  )}
                </div>

                {!isReserve && (
                  <div className="mt-4 flex items-center justify-between pt-4 border-t border-gray-200/50 dark:border-gray-600/50">
                    <div className="flex items-center gap-2">
                      {scale.online === 1 ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
                          <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Funcionando</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-4 h-4 text-slate-600 dark:text-slate-500" />
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-400">Com Problema</span>
                        </>
                      )}
                    </div>
                    <Switch
                      checked={scale.online === 1}
                      onCheckedChange={(checked) => handleScaleonlineChange(scale.id, checked ? 1 : 0)}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {editingScale && (
        <EditScaleModal
          scale={editingScale}
          onClose={() => setEditingScale(null)}
          onSave={handleSaveScale}
        />
      )}
      {swappingScale && (
        <SwapScaleModal
          scale={swappingScale}
          allScales={scales}
          onClose={() => setSwappingScale(null)}
          onSave={handleSwapScale}
        />
      )}
      {showAddReserve && (
        <AddReserveScaleModal
          onClose={() => setShowAddReserve(false)}
          onSave={handleAddReserveScale}
          existingScales={scales}
        />
      )}
    </div>
  );
}