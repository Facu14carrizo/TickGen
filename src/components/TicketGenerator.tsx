import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  generateUniqueCode,
  generateQRCode,
  createTicketElement,
  downloadTicketAsImage,
  TicketOrientation,
  TicketQRPosition,
} from '../lib/ticketGenerator';
import { Ticket, Upload, Download, Loader, Monitor, Smartphone, MoveRight, MoveLeft } from 'lucide-react';

interface TicketGeneratorProps {
  onGenerated?: () => void;
}

export default function TicketGenerator({ onGenerated }: TicketGeneratorProps) {
  const [eventName, setEventName] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [backgroundImage, setBackgroundImage] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [orientation, setOrientation] = useState<TicketOrientation>('landscape');
  const [qrPosition, setQrPosition] = useState<TicketQRPosition>('end');
  const [previewQr, setPreviewQr] = useState<string>('');
  const previewRef = useRef<HTMLDivElement>(null);

  const formatEventDate = (value: string) => {
    if (!value) return 'Fecha por confirmar';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Fecha por confirmar';
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBackgroundImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const qr = await generateQRCode('PREVIEW-TICKET');
        if (isMounted) {
          setPreviewQr(qr);
        }
      } catch (error) {
        console.error('Error preparando QR de vista previa:', error);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!previewQr || !previewRef.current) return;
    const container = previewRef.current;
    const titlePreview = eventName || 'Nombre del evento';
    const subtitlePreview = eventDescription || 'Información adicional del espectáculo';
    const datePreview = formatEventDate(eventDate);
    const ticketElement = createTicketElement(
      titlePreview,
      subtitlePreview,
      Math.max(1, quantity),
      datePreview,
      previewQr,
      backgroundImage || undefined,
      orientation,
      qrPosition
    );
    container.innerHTML = '';
    container.appendChild(ticketElement);
  }, [
    previewQr,
    eventName,
    eventDescription,
    eventDate,
    backgroundImage,
    orientation,
    qrPosition,
    quantity,
  ]);

  const generateTickets = async () => {
    if (!eventName || !eventDate) {
      alert('Por favor completa todos los campos requeridos');
      return;
    }

    setIsGenerating(true);
    setProgress(0);

    try {
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .insert({
          name: eventName,
          description: eventDescription,
          event_date: eventDate,
        })
        .select()
        .single();

      if (eventError) throw eventError;

      const { data: designData, error: designError } = await supabase
        .from('ticket_designs')
        .insert({
          event_id: eventData.id,
          title: eventName,
          subtitle: eventDescription,
          background_image: backgroundImage,
        })
        .select()
        .single();

      if (designError) throw designError;

      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      document.body.appendChild(tempContainer);

      for (let i = 1; i <= quantity; i++) {
        const qrCode = generateUniqueCode();
        const qrDataUrl = await generateQRCode(qrCode);

        const { error: ticketError } = await supabase
          .from('tickets')
          .insert({
            event_id: eventData.id,
            qr_code: qrCode,
            ticket_number: i,
          });

        if (ticketError) throw ticketError;

        const ticketElement = createTicketElement(
          eventName,
          eventDescription || 'Evento especial',
          i,
          formatEventDate(eventDate),
          qrDataUrl,
          backgroundImage || undefined,
          orientation,
          qrPosition
        );

        tempContainer.innerHTML = '';
        tempContainer.appendChild(ticketElement);

        await new Promise(resolve => setTimeout(resolve, 100));

        await downloadTicketAsImage(
          ticketElement,
          `tick${i}.png`,
          eventName
        );

        setProgress(Math.round((i / quantity) * 100));

        await new Promise(resolve => setTimeout(resolve, 200));
      }

      document.body.removeChild(tempContainer);

      alert(`¡${quantity} entrada(s) generada(s) exitosamente!`);

      setEventName('');
      setEventDescription('');
      setEventDate('');
      setBackgroundImage('');
      setQuantity(1);

      if (onGenerated) onGenerated();
    } catch (error) {
      console.error('Error generating tickets:', error);
      alert('Error al generar las entradas. Por favor intenta nuevamente.');
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
      <div className="bg-gray-800 rounded-2xl shadow-xl p-4 sm:p-8">
        <div className="flex items-center gap-2 sm:gap-3 mb-6 sm:mb-8">
          <div className="p-2 sm:p-3 bg-blue-900 rounded-xl">
            <Ticket className="w-6 h-6 sm:w-8 sm:h-8 text-blue-400" />
          </div>
          <h2 className="text-xl sm:text-3xl font-bold text-white">Generar Entradas Digitales</h2>
        </div>

        <div className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Nombre del Evento *
              </label>
              <input
                type="text"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-gray-700 border-2 border-gray-600 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400 transition-all outline-none"
                placeholder="Ej: Romeo y Julieta"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Fecha del Evento *
              </label>
              <input
                type="datetime-local"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-gray-700 border-2 border-gray-600 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500 text-white transition-all outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Descripción del Evento
            </label>
            <textarea
              value={eventDescription}
              onChange={(e) => setEventDescription(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-gray-700 border-2 border-gray-600 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400 transition-all outline-none"
              rows={3}
              placeholder="Descripción breve del evento"
            />
          </div>

          <div className="border-t-2 border-gray-700 pt-4 sm:pt-6">
            <h3 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">Diseño de la Entrada</h3>

            <div className="mt-4 sm:mt-6">
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Orientación del Formato
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setOrientation('landscape')}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
                    orientation === 'landscape'
                      ? 'border-blue-500 bg-blue-900/40 text-blue-200'
                      : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-blue-500/60'
                  }`}
                >
                  <Monitor className="w-5 h-5" />
                  Horizontal
                </button>
                <button
                  type="button"
                  onClick={() => setOrientation('portrait')}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
                    orientation === 'portrait'
                      ? 'border-blue-500 bg-blue-900/40 text-blue-200'
                      : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-blue-500/60'
                  }`}
                >
                  <Smartphone className="w-5 h-5" />
                  Vertical
                </button>
              </div>
            </div>

            <div className="mt-4 sm:mt-6">
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Ubicación del QR
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setQrPosition('start')}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
                    qrPosition === 'start'
                      ? 'border-purple-500 bg-purple-900/40 text-purple-200'
                      : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-purple-500/60'
                  }`}
                >
                  <MoveLeft className="w-5 h-5" />
                  {orientation === 'portrait' ? 'QR arriba' : 'QR izquierda'}
                </button>
                <button
                  type="button"
                  onClick={() => setQrPosition('end')}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
                    qrPosition === 'end'
                      ? 'border-purple-500 bg-purple-900/40 text-purple-200'
                      : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-purple-500/60'
                  }`}
                >
                  <MoveRight className="w-5 h-5" />
                  {orientation === 'portrait' ? 'QR abajo' : 'QR derecha'}
                </button>
              </div>
            </div>

            <div className="mt-4 sm:mt-6">
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Imagen de Fondo (Opcional)
              </label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                <label className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-gray-700 hover:bg-gray-600 rounded-xl cursor-pointer transition-colors w-full sm:w-auto">
                  <Upload className="w-4 h-4 sm:w-5 sm:h-5 text-gray-300" />
                  <span className="font-medium text-gray-300 text-sm sm:text-base">Seleccionar Imagen</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
                {backgroundImage && (
                  <span className="text-sm text-green-400 font-medium">✓ Imagen cargada</span>
                )}
              </div>
            </div>

            <div className="mt-4 sm:mt-6">
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Cantidad de Entradas *
              </label>
              <input
                type="number"
                min="1"
                max="500"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-gray-700 border-2 border-gray-600 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500 text-white transition-all outline-none"
              />
            </div>
          </div>

          <div className="border-2 border-gray-700 rounded-2xl p-4 sm:p-6 bg-gray-900/40">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div>
                <p className="text-sm font-semibold text-gray-300">Vista previa en tiempo real</p>
                <p className="text-xs text-gray-400">Se actualiza con cada cambio de texto, imagen u orientación.</p>
              </div>
              <span className="text-xs font-semibold px-3 py-1 bg-gray-700 rounded-full text-gray-200 uppercase">
                {orientation === 'landscape' ? 'Horizontal' : 'Vertical'}
              </span>
            </div>
            <div className="w-full flex justify-center overflow-auto">
              <div
                ref={previewRef}
                className="min-h-[220px] flex items-center justify-center"
              >
                {!previewQr && (
                  <div className="text-gray-400 text-sm">Generando vista previa...</div>
                )}
              </div>
            </div>
          </div>

          {isGenerating && (
            <div className="bg-blue-900 border-2 border-blue-700 rounded-xl p-4 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                <Loader className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400 animate-spin" />
                <span className="font-semibold text-blue-200 text-sm sm:text-base">
                  Generando entradas... {progress}%
                </span>
              </div>
              <div className="w-full bg-blue-800 rounded-full h-2 sm:h-3 overflow-hidden">
                <div
                  className="bg-blue-500 h-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <button
            onClick={generateTickets}
            disabled={isGenerating}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-3 sm:py-4 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 sm:gap-3 text-sm sm:text-base"
          >
            {isGenerating ? (
              <>
                <Loader className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <Download className="w-5 h-5 sm:w-6 sm:h-6" />
                Generar {quantity} Entrada(s)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
