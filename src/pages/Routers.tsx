import { useEffect, useState } from 'react';
import type { Router } from '../types';
import { 
  Activity, 
  Power, 
  Eye, 
  EyeOff, 
  Wifi, 
  Signal, 
  User,
  QrCode
} from 'lucide-react';
import { QRCode } from 'react-qrcode-logo';

export default function Routers() {
  const [isClosing, setIsClosing] = useState(false);
  const [routers, setRouters] = useState<Router[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<Record<number, { login?: boolean; wifi?: boolean }>>({});
  const [qrCodeData, setQrCodeData] = useState<{ ssid: string; password: string; hidden: boolean } | null>(null);

  useEffect(() => {
    const fetchRouters = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_SERVER}:${import.meta.env.VITE_PORT}/api/routers`, {
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch routers');
        }

        const data: Router[] = await response.json();
        setRouters(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Fetch routers error:', error);
        setError(error instanceof Error ? error.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRouters();
  }, []);

  const togglePasswordVisibility = (routerId: number, field: 'login' | 'wifi') => {
    setShowPassword((prev) => ({
      ...prev,
      [routerId]: {
        ...prev[routerId],
        [field]: !(prev[routerId]?.[field] ?? false),
      },
    }));
  };
  
  const generateQrCode = (router: Router) => {
    const { wifi_ssid: ssid, wifi_password: password, hidden } = router;
    setQrCodeData({ ssid: ssid || '', password: password || '', hidden: hidden === 1 });
  };

  const closeQrCodeModal = () => {
    setIsClosing(true);
    setTimeout(() => {
      setQrCodeData(null);
      setIsClosing(false);
    }, 300);
  };  

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 text-red-600 dark:text-red-400">
        Error: {error}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const safeRouters = Array.isArray(routers) ? routers : [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Roteadores</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {safeRouters.map((router) => (
          <div 
            key={router.id} 
            className={` shadow-xl dark:shadow-gray-500/30
              rounded-2xl overflow-hidden transition-all duration-200
              ${router.status === 1 
                ? 'bg-green-50 dark:bg-green-800/20 border-2 border-green-200 dark:border-green-800' 
                : 'bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700'}
            `}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Signal className={`w-5 h-5 ${router.status === 1 ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`} />
                  <h2 className="text-lg font-medium">
                    {router.name || 'Nome não disponível'}
                  </h2>
                </div>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    router.status === 1 
                      ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' 
                      : 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                  }`}
                >
                  {router.status === 1 ? (
                    <Activity className="w-3 h-3 mr-1" />
                  ) : (
                    <Power className="w-3 h-3 mr-1" />
                  )}
                  {router.status === 1 ? 'Online' : 'Offline'}
                </span>
              </div>

              <div className="space-y-4">
                <div className="p-3 bg-white/50 dark:bg-black/20 rounded-2xl">
                  <p className="text-sm text-gray-600 dark:text-gray-400">IP Address</p>
                  <p className="mt-1 text-sm font-medium">{router.ip || 'IP não disponível'}</p>
                </div>

                <div className="p-3 bg-white/50 dark:bg-black/20 rounded-2xl">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    <p className="text-sm text-gray-600 dark:text-gray-400">Login Credentials</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {router.login_username || 'Usuário não disponível'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {showPassword[router.id]?.login
                          ? router.login_password || ''
                          : (router.login_password || '').replace(/./g, '•')}
                      </span>
                      <button
                        onClick={() => togglePasswordVisibility(router.id, 'login')}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                      >
                        {showPassword[router.id]?.login ? 
                          <EyeOff className="w-4 h-4 text-gray-600 dark:text-gray-400" /> : 
                          <Eye className="w-4 h-4 text-gray-600 dark:text-gray-400" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-white/50 dark:bg-black/20 rounded-2xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Wifi className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    <p className="text-sm text-gray-600 dark:text-gray-400">Wi-Fi Settings</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {router.wifi_ssid || 'SSID não disponível'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {showPassword[router.id]?.wifi
                          ? router.wifi_password || ''
                          : (router.wifi_password || '').replace(/./g, '•')}
                      </span>
                      <button
                        onClick={() => togglePasswordVisibility(router.id, 'wifi')}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                      >
                        {showPassword[router.id]?.wifi ? 
                          <EyeOff className="w-4 h-4 text-gray-600 dark:text-gray-400" /> : 
                          <Eye className="w-4 h-4 text-gray-600 dark:text-gray-400" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => generateQrCode(router)}
                className="mt-6 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 
                  bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl
                  transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 
                  focus:ring-indigo-500 dark:focus:ring-offset-gray-800"
              >
                <QrCode className="w-4 h-4" />
                Gerar QR Code do Wi-Fi
              </button>
            </div>
          </div>
        ))}
      </div>

      {qrCodeData && (
        <div 
          className={`fixed inset-0 flex items-center justify-center z-50 transition-all duration-300 ${
            isClosing ? "animate-fadeOutScale" : "animate-fadeInScale"
          }`}
        >
          <div className="absolute inset-0 bg-gray-900/20 backdrop-blur-sm" onClick={closeQrCodeModal} />
          <div className="relative bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-auto">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold mb-3">Aponte a câmera do celular</h2>
              <p className="text-base text-gray-600 dark:text-gray-400">
                Escaneie o QR code para conectar ao Wi-Fi
              </p>
            </div>
            
            <div className="flex justify-center mb-6">
              <div className="p-6 bg-white dark:bg-white rounded-3xl shadow-inner">
                <QRCode
                  value={`WIFI:S:${qrCodeData.ssid};T:WPA;P:${qrCodeData.password};H:${qrCodeData.hidden};;`}
                  size={320}
                  logoWidth={0}
                  removeQrCodeBehindLogo={false}
                  qrStyle="squares"
                  eyeRadius={10}
                  fgColor="#000000"
                  bgColor="#ffffff"
                  ecLevel="L"
                  quietZone={20}
                />
              </div>
            </div>
            
            <div className="text-center mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">Informações da Rede:</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{qrCodeData.ssid}</p>
              {qrCodeData.hidden && (
                <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 font-medium">Rede oculta</p>
              )}
            </div>
            
            <button
              onClick={closeQrCodeModal}
              className="w-full inline-flex items-center justify-center px-6 py-3 text-base font-medium
                text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors duration-200
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}