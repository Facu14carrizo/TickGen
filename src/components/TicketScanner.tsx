import { useState, useRef, useEffect } from 'react';
import { QRScanner } from '../lib/qrScanner';
import { supabase } from '../lib/supabase';
import { 
  Scan, CheckCircle, XCircle, Camera, RotateCcw, Search, 
  History, TrendingUp, Clock, AlertTriangle, Zap, 
  RefreshCw, Volume2, VolumeX, Hash
} from 'lucide-react';

type FacingMode = 'environment' | 'user';

interface TicketScannerProps {
  onTicketValidated?: () => void;
}

interface ScanHistory {
  id: string;
  ticketNumber: number;
  eventName: string;
  timestamp: Date;
  status: 'success' | 'warning' | 'error';
  qrCode: string;
}

interface TicketInfo {
  id: string;
  ticket_number: number;
  qr_code: string;
  is_used: boolean;
  used_at: string | null;
  events: {
    name: string;
    event_date: string;
  };
}

export default function TicketScanner({ onTicketValidated }: TicketScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanner] = useState(() => new QRScanner());
  const [cameraFacing, setCameraFacing] = useState<FacingMode>('environment');
  const [continuousMode, setContinuousMode] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [manualSearch, setManualSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [scanHistory, setScanHistory] = useState<ScanHistory[]>([]);
  const [stats, setStats] = useState({ total: 0, valid: 0, invalid: 0, used: 0 });
  const [result, setResult] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
    ticket?: TicketInfo;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadStats();
    return () => {
      scanner.stopScanning();
    };
  }, [scanner]);

  const loadStats = async () => {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select('is_used');
      
      if (!error && data) {
        setStats({
          total: data.length,
          valid: data.filter(t => !t.is_used).length,
          invalid: 0,
          used: data.filter(t => t.is_used).length,
        });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const playSound = (type: 'success' | 'error' | 'warning') => {
    if (!soundEnabled) return;
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      if (type === 'success') {
        oscillator.frequency.value = 800;
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
      } else if (type === 'warning') {
        oscillator.frequency.value = 400;
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
      } else {
        oscillator.frequency.value = 200;
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.4);
      }
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  };

  const vibrate = (pattern: number | number[]) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  };

  const addToHistory = (ticket: TicketInfo | null, status: 'success' | 'warning' | 'error', qrCode: string) => {
    if (!ticket) return;
    const historyItem: ScanHistory = {
      id: Date.now().toString(),
      ticketNumber: ticket.ticket_number,
      eventName: ticket.events.name,
      timestamp: new Date(),
      status,
      qrCode,
    };
    setScanHistory(prev => [historyItem, ...prev].slice(0, 20));
  };

  const startScanning = async () => {
    setResult(null);
    setIsScanning(true);

    await new Promise(requestAnimationFrame);

    if (!videoRef.current) {
      setIsScanning(false);
      setResult({
        type: 'error',
        message: 'No se pudo inicializar la cámara. Intenta nuevamente.',
      });
      return;
    }

    await scanner.startScanning(
      videoRef.current,
      handleScanSuccess,
      handleScanError,
      cameraFacing
    );
  };

  const stopScanning = () => {
    scanner.stopScanning();
    setIsScanning(false);
    setContinuousMode(false);
  };

  const validateTicket = async (code: string, shouldStop: boolean = true) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      const { data: ticket, error } = await supabase
        .from('tickets')
        .select('*, events(name, event_date)')
        .eq('qr_code', code)
        .maybeSingle();

      if (error) throw error;

      if (!ticket) {
        setResult({
          type: 'error',
          message: 'Código QR no válido. Esta entrada no existe en el sistema.',
        });
        playSound('error');
        vibrate([100, 50, 100]);
        addToHistory(null, 'error', code);
        if (shouldStop && !continuousMode) {
          setIsScanning(false);
          scanner.stopScanning();
        } else if (continuousMode) {
          // Reanudar el escaneo después de mostrar el error
          setTimeout(() => {
            if (isScanning && videoRef.current) {
              scanner.resumeScanning(handleScanSuccess, handleScanError);
            }
          }, 1500);
        }
        setIsProcessing(false);
        return;
      }

      if (ticket.is_used) {
        setResult({
          type: 'warning',
          message: `Esta entrada ya fue utilizada el ${new Date(ticket.used_at!).toLocaleString('es-ES')}.`,
          ticket,
        });
        playSound('warning');
        vibrate(200);
        addToHistory(ticket, 'warning', code);
        if (shouldStop && !continuousMode) {
          setIsScanning(false);
          scanner.stopScanning();
        } else if (continuousMode) {
          // Reanudar el escaneo después de mostrar la advertencia
          setTimeout(() => {
            if (isScanning && videoRef.current) {
              scanner.resumeScanning(handleScanSuccess, handleScanError);
            }
          }, 1500);
        }
        setIsProcessing(false);
        return;
      }

      const { error: updateError } = await supabase
        .from('tickets')
        .update({
          is_used: true,
          used_at: new Date().toISOString(),
        })
        .eq('id', ticket.id);

      if (updateError) throw updateError;

      setResult({
        type: 'success',
        message: `✓ Entrada válida para "${ticket.events.name}". Entrada #${ticket.ticket_number} registrada correctamente.`,
        ticket,
      });
      playSound('success');
      vibrate([100, 50, 100, 50, 100]);
      addToHistory(ticket, 'success', code);
      await loadStats();
      
      if (onTicketValidated) {
        onTicketValidated();
      }

      if (shouldStop && !continuousMode) {
        setIsScanning(false);
        scanner.stopScanning();
      } else if (continuousMode) {
        // En modo continuo, limpiar el resultado después de un tiempo pero mantener el escaneo activo
        setTimeout(() => {
          setResult(null);
        }, 2000);
        // El escaneo se reanudará en handleScanSuccess
      }
    } catch (error) {
      console.error('Validation error:', error);
      setResult({
        type: 'error',
        message: 'Error al validar la entrada. Por favor intenta nuevamente.',
      });
      playSound('error');
      vibrate([200, 100, 200]);
      
      // Si está en modo continuo, reanudar el escaneo después del error
      if (continuousMode && isScanning && videoRef.current) {
        setTimeout(() => {
          if (isScanning && videoRef.current) {
            scanner.resumeScanning(handleScanSuccess, handleScanError);
          }
        }, 1500);
      } else if (!continuousMode && isScanning) {
        setIsScanning(false);
        scanner.stopScanning();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleScanSuccess = async (code: string) => {
    // Pausar el escaneo temporalmente para procesar el código
    if (continuousMode) {
      scanner.pauseScanning();
    } else {
      scanner.stopScanning();
    }
    
    await validateTicket(code, !continuousMode);
    
    // Si está en modo continuo, reanudar el escaneo después de un breve delay
    if (continuousMode && isScanning && videoRef.current) {
      setTimeout(() => {
        if (isScanning && videoRef.current) {
          scanner.resumeScanning(handleScanSuccess, handleScanError);
        }
      }, 1500); // Esperar 1.5 segundos antes de reanudar
    }
  };

  const handleManualSearch = async () => {
    if (!manualSearch.trim()) return;
    setIsSearching(true);
    setResult(null);
    await validateTicket(manualSearch.trim(), true);
    setIsSearching(false);
  };

  const handleScanError = (error: string) => {
    setResult({
      type: 'error',
      message: error,
    });
    setIsScanning(false);
    playSound('error');
  };

  const resetScanner = () => {
    setResult(null);
    if (!isScanning) {
      startScanning();
    }
  };

  const toggleCameraFacing = () => {
    if (isScanning) {
      scanner.stopScanning();
      setCameraFacing((prev) => {
        const newFacing = prev === 'environment' ? 'user' : 'environment';
        setTimeout(() => {
          startScanning();
        }, 100);
        return newFacing;
      });
    } else {
      setCameraFacing((prev) => (prev === 'environment' ? 'user' : 'environment'));
    }
  };

  const clearHistory = () => {
    setScanHistory([]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Panel Principal */}
          <div className="lg:col-span-2 w-full">
            <div className="bg-gray-800 rounded-2xl shadow-xl p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-6 sm:mb-8">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 sm:p-3 bg-green-900 rounded-xl">
                  <Scan className="w-6 h-6 sm:w-8 sm:h-8 text-green-400" />
                </div>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">Validar Entradas</h2>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`p-2 sm:p-2.5 rounded-lg transition-colors ${
                    soundEnabled ? 'bg-green-900 text-green-400' : 'bg-gray-700 text-gray-400'
                  }`}
                  title={soundEnabled ? 'Desactivar sonido' : 'Activar sonido'}
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" />}
                </button>
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className={`p-2 sm:p-2.5 rounded-lg transition-colors ${
                    showHistory ? 'bg-blue-900 text-blue-400' : 'bg-gray-700 text-gray-400'
                  }`}
                  title="Ver historial"
                >
                  <History className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>

            <div className="space-y-4 sm:space-y-6">
              {/* Estadísticas rápidas */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="bg-gradient-to-br from-blue-900 to-blue-800 rounded-lg sm:rounded-xl p-2 sm:p-3 border-2 border-blue-700">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-blue-300 text-[10px] sm:text-xs font-semibold truncate">Total</p>
                      <p className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-100">{stats.total}</p>
                    </div>
                    <Hash className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-blue-400 flex-shrink-0 ml-1" />
                  </div>
                </div>
                <div className="bg-gradient-to-br from-green-900 to-green-800 rounded-lg sm:rounded-xl p-2 sm:p-3 border-2 border-green-700">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-green-300 text-[10px] sm:text-xs font-semibold truncate">Válidas</p>
                      <p className="text-lg sm:text-xl lg:text-2xl font-bold text-green-100">{stats.valid}</p>
                    </div>
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-green-400 flex-shrink-0 ml-1" />
                  </div>
                </div>
                <div className="bg-gradient-to-br from-orange-900 to-orange-800 rounded-lg sm:rounded-xl p-2 sm:p-3 border-2 border-orange-700">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-orange-300 text-[10px] sm:text-xs font-semibold truncate">Usadas</p>
                      <p className="text-lg sm:text-xl lg:text-2xl font-bold text-orange-100">{stats.used}</p>
                    </div>
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-orange-400 flex-shrink-0 ml-1" />
                  </div>
                </div>
              </div>

              {/* Búsqueda manual */}
              <div className="bg-gray-700 rounded-xl p-3 sm:p-4">
                <label className="block text-xs sm:text-sm font-semibold text-gray-300 mb-2">
                  Búsqueda Manual por Código QR
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualSearch}
                    onChange={(e) => setManualSearch(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleManualSearch()}
                    placeholder="Ingresa el código QR..."
                    className="flex-1 px-3 sm:px-4 py-2 text-sm bg-gray-600 border-2 border-gray-500 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <button
                    onClick={handleManualSearch}
                    disabled={isSearching || !manualSearch.trim()}
                    className="px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 sm:gap-2"
                  >
                    {isSearching ? (
                      <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4 sm:w-5 sm:h-5" />
                    )}
                    <span className="hidden sm:inline">Buscar</span>
                  </button>
                </div>
              </div>

              {/* Vista de cámara */}
              <div className="relative bg-black rounded-xl sm:rounded-2xl overflow-hidden aspect-video w-full mx-auto">
                {isScanning ? (
                  <>
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      playsInline
                    />
                    <div className="absolute inset-0 border-4 border-green-500 pointer-events-none">
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 sm:w-64 sm:h-64 border-4 border-green-400 rounded-2xl shadow-lg animate-pulse" />
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 sm:w-64 sm:h-64 border-2 border-green-300 rounded-2xl opacity-50 animate-ping" />
                    </div>
                    <div className="absolute top-2 sm:top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-3 sm:px-4 lg:px-6 py-1 sm:py-2 rounded-full font-semibold shadow-lg text-xs sm:text-sm lg:text-base flex items-center gap-1 sm:gap-2">
                      <Zap className="w-3 h-3 sm:w-4 sm:h-4 animate-pulse" />
                      <span>Escaneando...</span>
                    </div>
                    {continuousMode && (
                      <div className="absolute bottom-2 sm:bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-semibold">
                        Modo Continuo
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                    <div className="text-center px-4">
                      <Camera className="w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 text-gray-400 mx-auto mb-2 sm:mb-4" />
                      <p className="text-gray-300 text-sm sm:text-base lg:text-lg">Cámara en espera</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Resultado del escaneo */}
              {result && (
                <div
                  className={`rounded-xl p-3 sm:p-4 lg:p-6 border-2 animate-in fade-in slide-in-from-top-2 ${
                    result.type === 'success'
                      ? 'bg-green-900 border-green-700'
                      : result.type === 'warning'
                      ? 'bg-yellow-900 border-yellow-700'
                      : 'bg-red-900 border-red-700'
                  }`}
                >
                  <div className="flex items-start gap-2 sm:gap-3">
                    {result.type === 'success' ? (
                      <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 text-green-400 flex-shrink-0 mt-0.5 sm:mt-1 animate-in zoom-in" />
                    ) : result.type === 'warning' ? (
                      <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 text-yellow-400 flex-shrink-0 mt-0.5 sm:mt-1" />
                    ) : (
                      <XCircle className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 text-red-400 flex-shrink-0 mt-0.5 sm:mt-1" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`font-semibold text-xs sm:text-sm lg:text-lg mb-2 ${
                          result.type === 'success'
                            ? 'text-green-100'
                            : result.type === 'warning'
                            ? 'text-yellow-100'
                            : 'text-red-100'
                        }`}
                      >
                        {result.message}
                      </p>
                      {result.ticket && (
                        <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-white/20">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm">
                            <div>
                              <span className="text-gray-300">Evento:</span>
                              <p className="font-semibold text-white truncate">{result.ticket.events.name}</p>
                            </div>
                            <div>
                              <span className="text-gray-300">Entrada #:</span>
                              <p className="font-semibold text-white">{result.ticket.ticket_number}</p>
                            </div>
                            <div className="col-span-1 sm:col-span-2">
                              <span className="text-gray-300">Fecha del evento:</span>
                              <p className="font-semibold text-white text-xs sm:text-sm">
                                {new Date(result.ticket.events.event_date).toLocaleString('es-ES', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Controles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                {!isScanning ? (
                  <button
                    onClick={startScanning}
                    className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-3 sm:py-4 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all flex items-center justify-center gap-2 text-sm sm:text-base"
                  >
                    <Camera className="w-5 h-5 sm:w-6 sm:h-6" />
                    Iniciar Escaneo
                  </button>
                ) : (
                  <button
                    onClick={stopScanning}
                    className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold py-3 sm:py-4 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all flex items-center justify-center gap-2 text-sm sm:text-base"
                  >
                    <XCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                    Detener Escaneo
                  </button>
                )}

                <button
                  onClick={toggleCameraFacing}
                  disabled={isScanning && !continuousMode}
                  className="bg-gray-700 hover:bg-gray-600 text-gray-100 font-semibold py-3 sm:py-4 rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">{cameraFacing === 'environment' ? 'Cámara Frontal' : 'Cámara Trasera'}</span>
                  <span className="sm:hidden">{cameraFacing === 'environment' ? 'Frontal' : 'Trasera'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                <button
                  onClick={() => setContinuousMode(!continuousMode)}
                  disabled={!isScanning}
                  className={`py-2.5 sm:py-3 px-4 rounded-lg font-semibold transition-all text-xs sm:text-sm ${
                    continuousMode
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  } disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
                >
                  <Zap className="w-4 h-4" />
                  Modo Continuo {continuousMode ? 'ON' : 'OFF'}
                </button>
                {result && !isScanning && (
                  <button
                    onClick={resetScanner}
                    className="bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold py-2.5 sm:py-3 rounded-lg transition-colors text-xs sm:text-sm flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Escanear Otra
                  </button>
                )}
              </div>

              <div className="bg-blue-900 border-2 border-blue-700 rounded-xl p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-blue-200 font-medium leading-relaxed">
                  <strong>💡 Instrucciones:</strong> Apunta la cámara hacia el código QR. 
                  El modo continuo permite escanear múltiples entradas sin detener la cámara.
                </p>
              </div>
            </div>
            </div>
          </div>

          {/* Panel de Historial */}
          {showHistory && (
            <div className="lg:col-span-1 w-full">
              <div className="bg-gray-800 rounded-2xl shadow-xl p-4 sm:p-6 lg:sticky lg:top-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <History className="w-4 h-4 sm:w-5 sm:h-5" />
                    Historial
                  </h3>
                  {scanHistory.length > 0 && (
                    <button
                      onClick={clearHistory}
                      className="text-xs text-gray-400 hover:text-gray-300 transition-colors"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
                <div className="space-y-2 max-h-[400px] sm:max-h-[500px] lg:max-h-[600px] overflow-y-auto">
                  {scanHistory.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-8">
                      No hay escaneos recientes
                    </p>
                  ) : (
                    scanHistory.map((item) => (
                      <div
                        key={item.id}
                        className={`p-2.5 sm:p-3 rounded-lg border-2 ${
                          item.status === 'success'
                            ? 'bg-green-900/30 border-green-700'
                            : item.status === 'warning'
                            ? 'bg-yellow-900/30 border-yellow-700'
                            : 'bg-red-900/30 border-red-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {item.status === 'success' ? (
                                <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-400 flex-shrink-0" />
                              ) : item.status === 'warning' ? (
                                <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-400 flex-shrink-0" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400 flex-shrink-0" />
                              )}
                              <span className="font-semibold text-white text-xs sm:text-sm truncate">
                                Entrada #{item.ticketNumber}
                              </span>
                            </div>
                            <p className="text-xs text-gray-300 mb-1 truncate">{item.eventName}</p>
                            <p className="text-xs text-gray-400">
                              {item.timestamp.toLocaleTimeString('es-ES')}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
