import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  RotateCcw,
  Eye,
  Wifi,
  RefreshCw,
  Grid,
  Layers,
  Palette,
  Monitor,
  Zap,
  Clock,
  Bell,
  Shield,
  X,
  Check,
  AlertTriangle
} from 'lucide-react';

// Tipos para as configurações
export interface NetworkConfig {
  // Configurações de visualização
  showDeviceLabels: boolean;
  showRoomLabels: boolean;
  showConnectionLines: boolean;
  gridSize: number;
  autoRefresh: boolean;
  refreshInterval: number;
  
  // Configurações de aparência
  theme: 'light' | 'dark' | 'auto';
  colorScheme: 'blue' | 'green' | 'purple' | 'orange';
  opacity: number;
  animationsEnabled: boolean;
  
  // Configurações de rede
  networkScanInterval: number;
  deviceTimeout: number;
  maxDevicesPerRoom: number;
  
  // Configurações de notificações
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  alertOnDeviceDown: boolean;
  alertOnNewDevice: boolean;
  
  // Configurações avançadas
  debugMode: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  cacheEnabled: boolean;
}

// Configurações padrão
export const defaultConfig: NetworkConfig = {
  showDeviceLabels: true,
  showRoomLabels: true,
  showConnectionLines: false,
  gridSize: 20,
  autoRefresh: true,
  refreshInterval: 30,
  theme: 'light',
  colorScheme: 'blue',
  opacity: 0.9,
  animationsEnabled: true,
  networkScanInterval: 60,
  deviceTimeout: 300,
  maxDevicesPerRoom: 50,
  notificationsEnabled: true,
  soundEnabled: false,
  alertOnDeviceDown: true,
  alertOnNewDevice: true,
  debugMode: false,
  logLevel: 'warn',
  cacheEnabled: true
};

interface ConfigSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}

const ConfigSection: React.FC<ConfigSectionProps> = ({ title, icon, children, isOpen, onToggle }) => (
  <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
    <button
      onClick={onToggle}
      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between transition-colors"
    >
      <div className="flex items-center space-x-3">
        {icon}
        <span className="font-medium text-gray-900 dark:text-gray-100">{title}</span>
      </div>
      <div className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>
        ⌄
      </div>
    </button>
    <div className={`transition-all duration-300 ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
      <div className="p-4 bg-white dark:bg-gray-900 space-y-4">
        {children}
      </div>
    </div>
  </div>
);

interface ToggleSwitchProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon?: React.ReactNode;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ label, description, checked, onChange, icon }) => (
  <div className="flex items-center justify-between py-2">
    <div className="flex items-center space-x-3">
      {icon && <div className="text-gray-500 dark:text-gray-400">{icon}</div>}
      <div>
        <div className="font-medium text-gray-900 dark:text-gray-100">{label}</div>
        {description && <div className="text-sm text-gray-500 dark:text-gray-400">{description}</div>}
      </div>
    </div>
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
        checked ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  </div>
);

interface SliderProps {
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
  icon?: React.ReactNode;
}

const Slider: React.FC<SliderProps> = ({ 
  label, 
  description, 
  value, 
  min, 
  max, 
  step = 1, 
  suffix = '', 
  onChange, 
  icon 
}) => (
  <div className="py-2">
    <div className="flex items-center space-x-3 mb-2">
      {icon && <div className="text-gray-500 dark:text-gray-400">{icon}</div>}
      <div className="flex-1">
        <div className="flex justify-between items-center">
          <div className="font-medium text-gray-900 dark:text-gray-100">{label}</div>
          <div className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
            {value}{suffix}
          </div>
        </div>
        {description && <div className="text-sm text-gray-500 dark:text-gray-400">{description}</div>}
      </div>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
    />
  </div>
);

interface SelectProps {
  label: string;
  description?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  icon?: React.ReactNode;
}

const Select: React.FC<SelectProps> = ({ label, description, value, options, onChange, icon }) => (
  <div className="py-2">
    <div className="flex items-center space-x-3 mb-2">
      {icon && <div className="text-gray-500 dark:text-gray-400">{icon}</div>}
      <div className="flex-1">
        <div className="font-medium text-gray-900 dark:text-gray-100">{label}</div>
        {description && <div className="text-sm text-gray-500 dark:text-gray-400">{description}</div>}
      </div>
    </div>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </div>
);

export default function NetworkConfigurationPanel() {
  const [config, setConfig] = useState<NetworkConfig>(defaultConfig);
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    display: true,
    appearance: false,
    network: false,
    notifications: false,
    advanced: false
  });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Carrega configurações do localStorage na inicialização
  useEffect(() => {
    const savedConfig = localStorage.getItem('networkMapConfig');
    if (savedConfig) {
      try {
        const parsedConfig = JSON.parse(savedConfig);
        setConfig({ ...defaultConfig, ...parsedConfig });
      } catch (error) {
        console.error('Erro ao carregar configurações:', error);
      }
    }
  }, []);

  // Atualiza uma configuração específica
  const updateConfig = (key: keyof NetworkConfig, value: any) => {
    setConfig(prev => ({
      ...prev,
      [key]: value
    }));
    setHasUnsavedChanges(true);
  };

  // Salva configurações
  const saveConfig = async () => {
    setSaveStatus('saving');
    try {
      localStorage.setItem('networkMapConfig', JSON.stringify(config));
      
      // Simula um delay de API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSaveStatus('saved');
      setHasUnsavedChanges(false);
      
      // Reset status após 2 segundos
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  // Restaura configurações padrão
  const resetConfig = () => {
    setConfig(defaultConfig);
    setHasUnsavedChanges(true);
  };

  // Toggle seção
  const toggleSection = (section: string) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Renderiza o status de salvamento
  const renderSaveStatus = () => {
    switch (saveStatus) {
      case 'saving':
        return (
          <div className="flex items-center space-x-2 text-blue-600">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Salvando...</span>
          </div>
        );
      case 'saved':
        return (
          <div className="flex items-center space-x-2 text-green-600">
            <Check className="w-4 h-4" />
            <span>Salvo!</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center space-x-2 text-red-600">
            <AlertTriangle className="w-4 h-4" />
            <span>Erro ao salvar</span>
          </div>
        );
      default:
        return null;
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110 z-50"
        title="Configurações"
      >
        <Settings className="w-6 h-6" />
        {hasUnsavedChanges && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
        )}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Settings className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Configurações da Rede
            </h2>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="space-y-4">
            
            {/* Seção de Exibição */}
            <ConfigSection
              title="Configurações de Exibição"
              icon={<Eye className="w-5 h-5 text-blue-600" />}
              isOpen={openSections.display}
              onToggle={() => toggleSection('display')}
            >
              <ToggleSwitch
                label="Mostrar rótulos dos dispositivos"
                description="Exibe informações detalhadas ao passar o mouse"
                checked={config.showDeviceLabels}
                onChange={(value) => updateConfig('showDeviceLabels', value)}
                icon={<Monitor className="w-4 h-4" />}
              />
              
              <ToggleSwitch
                label="Mostrar rótulos das salas"
                description="Exibe o nome das salas permanentemente"
                checked={config.showRoomLabels}
                onChange={(value) => updateConfig('showRoomLabels', value)}
                icon={<Layers className="w-4 h-4" />}
              />
              
              <ToggleSwitch
                label="Mostrar linhas de conexão"
                description="Desenha linhas conectando dispositivos relacionados"
                checked={config.showConnectionLines}
                onChange={(value) => updateConfig('showConnectionLines', value)}
                icon={<Wifi className="w-4 h-4" />}
              />
              
              <Slider
                label="Tamanho da grade"
                description="Espaçamento da grade de fundo"
                value={config.gridSize}
                min={10}
                max={50}
                suffix="px"
                onChange={(value) => updateConfig('gridSize', value)}
                icon={<Grid className="w-4 h-4" />}
              />
              
              <ToggleSwitch
                label="Atualização automática"
                description="Atualiza o mapa automaticamente"
                checked={config.autoRefresh}
                onChange={(value) => updateConfig('autoRefresh', value)}
                icon={<RefreshCw className="w-4 h-4" />}
              />
              
              {config.autoRefresh && (
                <Slider
                  label="Intervalo de atualização"
                  description="Frequência de atualização do mapa"
                  value={config.refreshInterval}
                  min={10}
                  max={300}
                  suffix="s"
                  onChange={(value) => updateConfig('refreshInterval', value)}
                  icon={<Clock className="w-4 h-4" />}
                />
              )}
            </ConfigSection>

            {/* Seção de Aparência */}
            <ConfigSection
              title="Configurações de Aparência"
              icon={<Palette className="w-5 h-5 text-purple-600" />}
              isOpen={openSections.appearance}
              onToggle={() => toggleSection('appearance')}
            >
              <Select
                label="Tema"
                description="Aparência geral da interface"
                value={config.theme}
                options={[
                  { value: 'light', label: 'Claro' },
                  { value: 'dark', label: 'Escuro' },
                  { value: 'auto', label: 'Automático' }
                ]}
                onChange={(value) => updateConfig('theme', value)}
                icon={<Monitor className="w-4 h-4" />}
              />
              
              <Select
                label="Esquema de cores"
                description="Cor principal da interface"
                value={config.colorScheme}
                options={[
                  { value: 'blue', label: 'Azul' },
                  { value: 'green', label: 'Verde' },
                  { value: 'purple', label: 'Roxo' },
                  { value: 'orange', label: 'Laranja' }
                ]}
                onChange={(value) => updateConfig('colorScheme', value)}
                icon={<Palette className="w-4 h-4" />}
              />
              
              <Slider
                label="Opacidade do fundo"
                description="Transparência do fundo das salas"
                value={config.opacity}
                min={0.1}
                max={1}
                step={0.1}
                onChange={(value) => updateConfig('opacity', value)}
                icon={<Layers className="w-4 h-4" />}
              />
              
              <ToggleSwitch
                label="Animações"
                description="Habilita animações e transições"
                checked={config.animationsEnabled}
                onChange={(value) => updateConfig('animationsEnabled', value)}
                icon={<Zap className="w-4 h-4" />}
              />
            </ConfigSection>

            {/* Seção de Rede */}
            <ConfigSection
              title="Configurações de Rede"
              icon={<Wifi className="w-5 h-5 text-green-600" />}
              isOpen={openSections.network}
              onToggle={() => toggleSection('network')}
            >
              <Slider
                label="Intervalo de scan da rede"
                description="Frequência de verificação de novos dispositivos"
                value={config.networkScanInterval}
                min={30}
                max={600}
                suffix="s"
                onChange={(value) => updateConfig('networkScanInterval', value)}
                icon={<RefreshCw className="w-4 h-4" />}
              />
              
              <Slider
                label="Timeout de dispositivos"
                description="Tempo para considerar um dispositivo offline"
                value={config.deviceTimeout}
                min={60}
                max={1800}
                suffix="s"
                onChange={(value) => updateConfig('deviceTimeout', value)}
                icon={<Clock className="w-4 h-4" />}
              />
              
              <Slider
                label="Máximo de dispositivos por sala"
                description="Limite de dispositivos exibidos por sala"
                value={config.maxDevicesPerRoom}
                min={10}
                max={100}
                onChange={(value) => updateConfig('maxDevicesPerRoom', value)}
                icon={<Monitor className="w-4 h-4" />}
              />
            </ConfigSection>

            {/* Seção de Notificações */}
            <ConfigSection
              title="Configurações de Notificações"
              icon={<Bell className="w-5 h-5 text-orange-600" />}
              isOpen={openSections.notifications}
              onToggle={() => toggleSection('notifications')}
            >
              <ToggleSwitch
                label="Notificações habilitadas"
                description="Receber alertas do sistema"
                checked={config.notificationsEnabled}
                onChange={(value) => updateConfig('notificationsEnabled', value)}
                icon={<Bell className="w-4 h-4" />}
              />
              
              {config.notificationsEnabled && (
                <>
                  <ToggleSwitch
                    label="Sons de alerta"
                    description="Reproduzir sons para alertas importantes"
                    checked={config.soundEnabled}
                    onChange={(value) => updateConfig('soundEnabled', value)}
                    icon={<Zap className="w-4 h-4" />}
                  />
                  
                  <ToggleSwitch
                    label="Alerta de dispositivo offline"
                    description="Notificar quando um dispositivo sair do ar"
                    checked={config.alertOnDeviceDown}
                    onChange={(value) => updateConfig('alertOnDeviceDown', value)}
                    icon={<AlertTriangle className="w-4 h-4" />}
                  />
                  
                  <ToggleSwitch
                    label="Alerta de novo dispositivo"
                    description="Notificar quando um novo dispositivo for detectado"
                    checked={config.alertOnNewDevice}
                    onChange={(value) => updateConfig('alertOnNewDevice', value)}
                    icon={<Wifi className="w-4 h-4" />}
                  />
                </>
              )}
            </ConfigSection>

            {/* Seção Avançada */}
            <ConfigSection
              title="Configurações Avançadas"
              icon={<Shield className="w-5 h-5 text-red-600" />}
              isOpen={openSections.advanced}
              onToggle={() => toggleSection('advanced')}
            >
              <ToggleSwitch
                label="Modo debug"
                description="Habilita informações detalhadas para desenvolvedores"
                checked={config.debugMode}
                onChange={(value) => updateConfig('debugMode', value)}
                icon={<Settings className="w-4 h-4" />}
              />
              
              <Select
                label="Nível de log"
                description="Detalhamento das mensagens de log"
                value={config.logLevel}
                options={[
                  { value: 'error', label: 'Apenas erros' },
                  { value: 'warn', label: 'Avisos e erros' },
                  { value: 'info', label: 'Informações gerais' },
                  { value: 'debug', label: 'Debug completo' }
                ]}
                onChange={(value) => updateConfig('logLevel', value)}
              />
              
              <ToggleSwitch
                label="Cache habilitado"
                description="Armazena dados em cache para melhor performance"
                checked={config.cacheEnabled}
                onChange={(value) => updateConfig('cacheEnabled', value)}
                icon={<RefreshCw className="w-4 h-4" />}
              />
            </ConfigSection>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-4">
            {renderSaveStatus()}
            {hasUnsavedChanges && (
              <div className="flex items-center space-x-2 text-amber-600">
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                <span className="text-sm">Alterações não salvas</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={resetConfig}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors flex items-center space-x-2"
              disabled={saveStatus === 'saving'}
            >
              <RotateCcw className="w-4 h-4" />
              <span>Restaurar Padrão</span>
            </button>
            
            <button
              onClick={saveConfig}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center space-x-2 disabled:opacity-50"
              disabled={saveStatus === 'saving' || !hasUnsavedChanges}
            >
              <Save className="w-4 h-4" />
              <span>Salvar</span>
            </button>
          </div>
        </div>
      </div>
      
      <style>{`
        .slider {
          background: linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((config.opacity - 0.1) / 0.9) * 100}%, #e5e7eb ${((config.opacity - 0.1) / 0.9) * 100}%, #e5e7eb 100%);
        }
        
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        }
        
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </div>
  );
}