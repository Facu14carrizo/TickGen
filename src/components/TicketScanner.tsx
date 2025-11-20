import { useState, useRef, useEffect } from 'react';
import { QRScanner } from '../lib/qrScanner';
import { supabase } from '../lib/supabase';
import { Scan, CheckCircle, XCircle, Camera } from 'lucide-react';

type FacingMode = 'environment' | 'user';

interface TicketScannerProps {
  onTicketValidated?: () => void;
}

export default function TicketScanner({ onTicketValidated }: TicketScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanner] = useState(() => new QRScanner());
  const [cameraFacing, setCameraFacing] = useState<FacingMode>('environment');
  const [result, setResult] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);

  useEffect(() => {
    return () => {
      scanner.stopScanning();
    };
  }, [scanner]);

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
  };

  const handleScanSuccess = async (code: string) => {
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
        return;
      }

      if (ticket.is_used) {
        setResult({
          type: 'warning',
          message: `Esta entrada ya fue utilizada el ${new Date(ticket.used_at).toLocaleString('es-ES')}.`,
        });
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
      });
      if (onTicketValidated) {
        onTicketValidated();
      }
    } catch (error) {
      console.error('Validation error:', error);
      setResult({
        type: 'error',
        message: 'Error al validar la entrada. Por favor intenta nuevamente.',
      });
    }
  };

  const handleScanError = (error: string) => {
    setResult({
      type: 'error',
      message: error,
    });
    setIsScanning(false);
  };

  const resetScanner = () => {
    setResult(null);
    if (!isScanning) {
      startScanning();
    }
  };

  const toggleCameraFacing = () => {
    setCameraFacing((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
      <div className="bg-gray-800 rounded-2xl shadow-xl p-4 sm:p-8">
        <div className="flex items-center gap-2 sm:gap-3 mb-6 sm:mb-8">
          <div className="p-2 sm:p-3 bg-green-900 rounded-xl">
            <Scan className="w-6 h-6 sm:w-8 sm:h-8 text-green-400" />
          </div>
          <h2 className="text-xl sm:text-3xl font-bold text-white">Validar Entradas</h2>
        </div>

        <div className="space-y-4 sm:space-y-6">
          <div className="relative bg-black rounded-xl sm:rounded-2xl overflow-hidden aspect-video">
            {isScanning ? (
              <>
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                />
                <div className="absolute inset-0 border-4 border-green-500 pointer-events-none">
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-4 border-green-400 rounded-2xl shadow-lg" />
                </div>
                <div className="absolute top-2 sm:top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-4 sm:px-6 py-1 sm:py-2 rounded-full font-semibold shadow-lg text-sm sm:text-base">
                  Escaneando...
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                <div className="text-center">
                  <Camera className="w-12 h-12 sm:w-20 sm:h-20 text-gray-400 mx-auto mb-2 sm:mb-4" />
                  <p className="text-gray-300 text-base sm:text-lg">Cámara en espera</p>
                </div>
              </div>
            )}
          </div>

          {result && (
            <div
              className={`rounded-xl p-4 sm:p-6 ${
                result.type === 'success'
                  ? 'bg-green-900 border-2 border-green-700'
                  : result.type === 'warning'
                  ? 'bg-yellow-900 border-2 border-yellow-700'
                  : 'bg-red-900 border-2 border-red-700'
              }`}
            >
              <div className="flex items-start gap-2 sm:gap-3">
                {result.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-400 flex-shrink-0 mt-1" />
                ) : (
                  <XCircle
                    className={`w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 mt-1 ${
                      result.type === 'warning' ? 'text-yellow-400' : 'text-red-400'
                    }`}
                  />
                )}
                <div className="flex-1">
                  <p
                    className={`font-semibold text-sm sm:text-lg ${
                      result.type === 'success'
                        ? 'text-green-100'
                        : result.type === 'warning'
                        ? 'text-yellow-100'
                        : 'text-red-100'
                    }`}
                  >
                    {result.message}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            {!isScanning ? (
              <button
                onClick={startScanning}
                className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-3 sm:py-4 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all flex items-center justify-center gap-2 sm:gap-3 text-sm sm:text-base"
              >
                <Camera className="w-5 h-5 sm:w-6 sm:h-6" />
                Iniciar Escaneo
              </button>
            ) : (
              <button
                onClick={stopScanning}
                className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold py-3 sm:py-4 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all flex items-center justify-center gap-2 sm:gap-3 text-sm sm:text-base"
              >
                <XCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                Detener Escaneo
              </button>
            )}

            <button
              onClick={toggleCameraFacing}
              disabled={isScanning}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-100 font-semibold py-3 sm:py-4 rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
            >
              {cameraFacing === 'environment' ? 'Usar cámara frontal' : 'Usar cámara trasera'}
            </button>
          </div>

          {result && !isScanning && (
            <button
              onClick={resetScanner}
              className="w-full bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold py-2 sm:py-3 rounded-xl transition-colors text-sm sm:text-base"
            >
              Escanear Otra Entrada
            </button>
          )}

          <div className="bg-blue-900 border-2 border-blue-700 rounded-xl p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-blue-200 font-medium">
              <strong>Instrucciones:</strong> Apunta la cámara hacia el código QR de la entrada.
              La validación se realizará automáticamente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
