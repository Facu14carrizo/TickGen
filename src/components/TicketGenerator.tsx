import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { gsap } from 'gsap';
import {
  generateUniqueCode,
  generateQRCode,
  createTicketElement,
  downloadTicketAsImage,
  TicketOrientation,
  TicketQRPosition,
  TicketQRSize,
  TicketDesignOptions,
} from '../lib/ticketGenerator';
import { Ticket, Upload, Download, Loader, Monitor, Smartphone, MoveRight, MoveLeft, Palette, Type, Image as ImageIcon, Eye, EyeOff, CheckCircle, XCircle, Calendar, AlignLeft } from 'lucide-react';

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
  const [orientation, setOrientation] = useState<TicketOrientation>('portrait');
  const [qrPosition, setQrPosition] = useState<TicketQRPosition>('end');
  const [qrSize, setQrSize] = useState<TicketQRSize>('medium');
  const [backgroundColor, setBackgroundColor] = useState('#667eea');
  const [accentColor, setAccentColor] = useState('#764ba2');
  const [textColor, setTextColor] = useState('#ffffff');
  const [titleFontSize, setTitleFontSize] = useState<number | undefined>(undefined);
  const [subtitleFontSize, setSubtitleFontSize] = useState<number | undefined>(undefined);
  const [overlayOpacity, setOverlayOpacity] = useState(0.55);
  const [showTicketNumber, setShowTicketNumber] = useState(true);
  const [qrBorderStyle, setQrBorderStyle] = useState<'none' | 'rounded' | 'square'>('rounded');
  const [previewQr, setPreviewQr] = useState<string>('');
  const [showEventDate, setShowEventDate] = useState(true);
  const [showEventTitle, setShowEventTitle] = useState(true);
  const [showEventDescription, setShowEventDescription] = useState(true);
  const previewRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const feedbackTimeoutRef = useRef<number>();
  const showFeedback = (type: 'success' | 'error', message: string) => {
    if (feedbackTimeoutRef.current) {
      window.clearTimeout(feedbackTimeoutRef.current);
    }
    setFeedback({ type, message });
    feedbackTimeoutRef.current = window.setTimeout(() => {
      setFeedback(null);
    }, 5000);
  };
  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        window.clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

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

  const updatePreviewScale = useCallback(() => {
    if (!previewRef.current) return;
    const container = previewRef.current;
    const previewContent = container.querySelector('[data-preview-content]') as HTMLElement | null;
    const ticketElement = previewContent?.querySelector('[data-preview-ticket-root]') as HTMLElement | null;

    if (!previewContent || !ticketElement) return;

    const containerWidth = container.clientWidth - 24;
    const ticketWidth = ticketElement.offsetWidth;
    const ticketHeight = ticketElement.offsetHeight;

    if (!ticketWidth || !ticketHeight) return;

    const scale = Math.min(1, containerWidth / ticketWidth);
    const scaledHeight = ticketHeight * scale;

    previewContent.style.transform = `scale(${scale})`;
    previewContent.style.transformOrigin = 'top center';
    previewContent.style.width = `${ticketWidth}px`;
    previewContent.style.height = `${scaledHeight}px`;
    previewContent.style.willChange = 'transform';
    container.style.minHeight = `${scaledHeight + 24}px`;
  }, []);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const qr = await generateQRCode('PREVIEW-TICKET', qrSize);
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
  }, [qrSize]);

  useEffect(() => {
    if (!previewQr || !previewRef.current) return;
    const container = previewRef.current;
    const titlePreview = eventName || 'Nombre del evento';
    const subtitlePreview = eventDescription || 'Información adicional del espectáculo';
    const datePreview = formatEventDate(eventDate);
    const designOptions: TicketDesignOptions = {
      backgroundColor,
      accentColor,
      textColor,
      qrSize,
      titleFontSize,
      subtitleFontSize,
      overlayOpacity: backgroundImage ? overlayOpacity : 0,
      showTicketNumber,
      showEventDate,
      showEventTitle,
      showEventDescription,
      qrBorderStyle,
    };
    const ticketElement = createTicketElement(
      titlePreview,
      subtitlePreview,
      Math.max(1, quantity),
      datePreview,
      previewQr,
      backgroundImage || undefined,
      orientation,
      qrPosition,
      designOptions
    );
    container.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.dataset.previewContent = 'true';
    wrapper.style.display = 'inline-block';
    wrapper.style.transition = 'transform 0.2s ease';

    ticketElement.dataset.previewTicketRoot = 'true';

    wrapper.appendChild(ticketElement);
    container.appendChild(wrapper);

    requestAnimationFrame(() => {
      updatePreviewScale();
    });
  }, [
    previewQr,
    eventName,
    eventDescription,
    eventDate,
    backgroundImage,
    orientation,
    qrPosition,
    quantity,
    backgroundColor,
    accentColor,
    textColor,
    qrSize,
    titleFontSize,
    subtitleFontSize,
    overlayOpacity,
    showTicketNumber,
    showEventDate,
    showEventTitle,
    showEventDescription,
    qrBorderStyle,
    updatePreviewScale,
  ]);

  useEffect(() => {
    const handleResize = () => {
      updatePreviewScale();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updatePreviewScale]);

  // Sincronizar vista previa con el scroll usando GSAP
  useEffect(() => {
    if (!previewContainerRef.current) return;

    // Forzar que el contenedor esté en el flujo normal del documento
    gsap.set(previewContainerRef.current, {
      clearProps: 'all'
    });

    gsap.set(previewContainerRef.current, {
      position: 'relative',
      top: 'auto',
      left: 'auto',
      right: 'auto',
      bottom: 'auto',
      transform: 'none',
      willChange: 'auto'
    });

    // Crear una animación que se actualice con el scroll
    const updatePosition = () => {
      if (previewContainerRef.current) {
        // Asegurar que siempre esté en posición relativa
        const computedStyle = window.getComputedStyle(previewContainerRef.current);
        if (computedStyle.position === 'fixed' || computedStyle.position === 'sticky' || computedStyle.position === 'absolute') {
          gsap.set(previewContainerRef.current, {
            position: 'relative',
            top: 'auto',
            left: 'auto'
          });
        }
      }
    };

    // Escuchar eventos de scroll y actualizar
    const handleScroll = () => {
      requestAnimationFrame(updatePosition);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('wheel', handleScroll, { passive: true });
    window.addEventListener('touchmove', handleScroll, { passive: true });

    // Verificar periódicamente
    const interval = setInterval(updatePosition, 100);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('wheel', handleScroll);
      window.removeEventListener('touchmove', handleScroll);
      clearInterval(interval);
    };
  }, []);

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
        const qrDataUrl = await generateQRCode(qrCode, qrSize);

        const { error: ticketError } = await supabase
          .from('tickets')
          .insert({
            event_id: eventData.id,
            qr_code: qrCode,
            ticket_number: i,
          });

        if (ticketError) throw ticketError;

        const designOptions: TicketDesignOptions = {
          backgroundColor,
          accentColor,
          textColor,
          qrSize,
          titleFontSize,
          subtitleFontSize,
          overlayOpacity: backgroundImage ? overlayOpacity : 0,
          showTicketNumber,
          showEventDate,
          showEventTitle,
          showEventDescription,
          qrBorderStyle,
        };

        const ticketElement = createTicketElement(
          eventName,
          eventDescription || 'Evento especial',
          i,
          formatEventDate(eventDate),
          qrDataUrl,
          backgroundImage || undefined,
          orientation,
          qrPosition,
          designOptions
        );

        tempContainer.innerHTML = '';
        tempContainer.appendChild(ticketElement);

        await new Promise(resolve => setTimeout(resolve, 100));

        await downloadTicketAsImage(
          ticketElement,
          `tick${i}.pdf`,
          eventName
        );

        setProgress(Math.round((i / quantity) * 100));

        await new Promise(resolve => setTimeout(resolve, 200));
      }

      document.body.removeChild(tempContainer);

      showFeedback('success', `¡${quantity} entrada${quantity === 1 ? '' : 's'} generada${quantity === 1 ? '' : 's'} exitosamente!`);

      setEventName('');
      setEventDescription('');
      setEventDate('');
      setBackgroundImage('');
      setQuantity(1);

      if (onGenerated) onGenerated();
    } catch (error) {
      console.error('Error generating tickets:', error);
      showFeedback('error', 'Error al generar las entradas. Por favor intenta nuevamente.');
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6" style={{ overflow: 'visible', height: 'auto', maxHeight: 'none' }}>
      <div className="bg-gray-800 rounded-2xl shadow-xl p-4 sm:p-8" style={{ overflow: 'visible', height: 'auto', maxHeight: 'none' }}>
        <div className="flex items-center gap-2 sm:gap-3 mb-6 sm:mb-8">
          <div className="p-2 sm:p-3 bg-blue-900 rounded-xl">
            <Ticket className="w-6 h-6 sm:w-8 sm:h-8 text-blue-400" />
          </div>
          <h2 className="text-xl sm:text-3xl font-bold text-white">Generar Entradas Digitales</h2>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 lg:gap-10 lg:items-start" style={{ position: 'static', overflow: 'visible', height: 'auto', minHeight: 'auto' }}>
          <div className="flex-1 space-y-6" style={{ position: 'static', height: 'auto' }}>
            <div className="bg-gray-900/60 border border-gray-700 rounded-2xl p-4 sm:p-6 space-y-4">
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
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Descripción del Evento
                </label>
                <textarea
                  value={eventDescription}
                  onChange={(e) => setEventDescription(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-gray-700 border-2 border-gray-600 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400 transition-all outline-none resize-y"
                  rows={3}
                  placeholder="Descripción breve del evento"
                />
              </div>
            </div>
            </div>

            <div className="bg-gray-900/60 border border-gray-700 rounded-2xl p-4 sm:p-6 space-y-5">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-white">Diseño de la Entrada</h3>
                <p className="text-sm text-gray-400">Configura orientación, ubicación y tamaño del código QR.</p>
              </div>

              <div>
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

              <div>
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
                        : 'border-gray-600 bg-gray-700 text-gray-300 hover-border-purple-500/60'
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
                        : 'border-gray-600 bg-gray-700 text-gray-300 hover-border-purple-500/60'
                    }`}
                  >
                    <MoveRight className="w-5 h-5" />
                    {orientation === 'portrait' ? 'QR abajo' : 'QR derecha'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Tamaño del QR
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setQrSize('small')}
                    className={`px-4 py-2 rounded-lg border-2 transition-all text-sm ${
                      qrSize === 'small'
                        ? 'border-blue-500 bg-blue-900/40 text-blue-200'
                        : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-blue-500/60'
                    }`}
                  >
                    Pequeño
                  </button>
                  <button
                    type="button"
                    onClick={() => setQrSize('medium')}
                    className={`px-4 py-2 rounded-lg border-2 transition-all text-sm ${
                      qrSize === 'medium'
                        ? 'border-blue-500 bg-blue-900/40 text-blue-200'
                        : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-blue-500/60'
                    }`}
                  >
                    Mediano
                  </button>
                  <button
                    type="button"
                    onClick={() => setQrSize('large')}
                    className={`px-4 py-2 rounded-lg border-2 transition-all text-sm ${
                      qrSize === 'large'
                        ? 'border-blue-500 bg-blue-900/40 text-blue-200'
                        : 'border-gray-600 bg-gray-700 text-gray-300 hover-border-blue-500/60'
                    }`}
                  >
                    Grande
                  </button>
                </div>
              </div>

              <div className="bg-gray-900/60 border border-gray-700 rounded-2xl p-4 sm:p-6 space-y-5">
                <div>
                  <h4 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    Colores
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="min-w-0">
                      <label className="block text-xs font-semibold text-gray-400 mb-2">
                        Color de Fondo
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={backgroundColor}
                          onChange={(e) => setBackgroundColor(e.target.value)}
                          className="w-12 h-12 rounded-lg border-2 border-gray-600 cursor-pointer flex-shrink-0"
                        />
                        <input
                          type="text"
                          value={backgroundColor}
                          onChange={(e) => setBackgroundColor(e.target.value)}
                          className="flex-1 min-w-0 px-3 py-2 bg-gray-700 border-2 border-gray-600 rounded-lg text-white text-sm"
                          placeholder="#667eea"
                        />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <label className="block text-xs font-semibold text-gray-400 mb-2">
                        Color Acento
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={accentColor}
                          onChange={(e) => setAccentColor(e.target.value)}
                          className="w-12 h-12 rounded-lg border-2 border-gray-600 cursor-pointer flex-shrink-0"
                        />
                        <input
                          type="text"
                          value={accentColor}
                          onChange={(e) => setAccentColor(e.target.value)}
                          className="flex-1 min-w-0 px-3 py-2 bg-gray-700 border-2 border-gray-600 rounded-lg text-white text-sm"
                          placeholder="#764ba2"
                        />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <label className="block text-xs font-semibold text-gray-400 mb-2">
                        Color de Texto
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={textColor}
                          onChange={(e) => setTextColor(e.target.value)}
                          className="w-12 h-12 rounded-lg border-2 border-gray-600 cursor-pointer flex-shrink-0"
                        />
                        <input
                          type="text"
                          value={textColor}
                          onChange={(e) => setTextColor(e.target.value)}
                          className="flex-1 min-w-0 px-3 py-2 bg-gray-700 border-2 border-gray-600 rounded-lg text-white text-sm"
                          placeholder="#ffffff"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-800 pt-4">
                  <h4 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
                    <Type className="w-4 h-4" />
                    Tipografía
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-2">
                        Tamaño Título (px)
                      </label>
                      <input
                        type="number"
                        min="20"
                        max="60"
                        value={titleFontSize || ''}
                        onChange={(e) => setTitleFontSize(e.target.value ? parseInt(e.target.value) : undefined)}
                        className="w-full px-3 py-2 bg-gray-700 border-2 border-gray-600 rounded-lg text-white text-sm"
                        placeholder="Auto"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-2">
                        Tamaño Subtítulo (px)
                      </label>
                      <input
                        type="number"
                        min="12"
                        max="30"
                        value={subtitleFontSize || ''}
                        onChange={(e) => setSubtitleFontSize(e.target.value ? parseInt(e.target.value) : undefined)}
                        className="w-full px-3 py-2 bg-gray-700 border-2 border-gray-600 rounded-lg text-white text-sm"
                        placeholder="Auto"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-900/60 border border-gray-700 rounded-2xl p-4 sm:p-6 space-y-4">
                <h4 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  Imágenes
                </h4>
                <p className="text-sm text-gray-400">Sube un fondo y ajusta la superposición para mantener legibilidad.</p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-2">
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
                  {backgroundImage && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-2">
                        Opacidad Overlay: {Math.round(overlayOpacity * 100)}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={overlayOpacity}
                        onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 sm:mt-6 border-t border-gray-700 pt-4">
                <h4 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
                  Opciones Adicionales
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-gray-300 flex items-center gap-2">
                      <Type className="w-4 h-4" />
                      Mostrar nombre del evento
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowEventTitle(!showEventTitle)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        showEventTitle ? 'bg-blue-600' : 'bg-gray-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          showEventTitle ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-gray-300 flex items-center gap-2">
                      <AlignLeft className="w-4 h-4" />
                      Mostrar descripción del evento
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowEventDescription(!showEventDescription)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        showEventDescription ? 'bg-blue-600' : 'bg-gray-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          showEventDescription ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-gray-300 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Mostrar fecha en la entrada
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowEventDate(!showEventDate)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        showEventDate ? 'bg-blue-600' : 'bg-gray-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          showEventDate ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-gray-300 flex items-center gap-2">
                      {showTicketNumber ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      Mostrar número de entrada
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowTicketNumber(!showTicketNumber)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        showTicketNumber ? 'bg-blue-600' : 'bg-gray-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          showTicketNumber ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-2">
                      Estilo Borde QR
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setQrBorderStyle('rounded')}
                        className={`px-3 py-2 rounded-lg border-2 transition-all text-xs ${
                          qrBorderStyle === 'rounded'
                            ? 'border-blue-500 bg-blue-900/40 text-blue-200'
                            : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-blue-500/60'
                        }`}
                      >
                        Redondeado
                      </button>
                      <button
                        type="button"
                        onClick={() => setQrBorderStyle('square')}
                        className={`px-3 py-2 rounded-lg border-2 transition-all text-xs ${
                          qrBorderStyle === 'square'
                            ? 'border-blue-500 bg-blue-900/40 text-blue-200'
                            : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-blue-500/60'
                        }`}
                      >
                        Cuadrado
                      </button>
                    </div>
                  </div>
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

              <div className="space-y-4">
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

                {feedback && (
                  <div
                    className={`rounded-xl border-2 px-4 py-3 sm:py-4 text-sm sm:text-base font-semibold flex items-center gap-3 shadow-lg transition-all ${
                      feedback.type === 'success'
                        ? 'bg-green-900/80 border-green-600 text-green-100'
                        : 'bg-red-900/80 border-red-600 text-red-100'
                    }`}
                  >
                    {feedback.type === 'success' ? (
                      <CheckCircle className="w-5 h-5 text-green-300" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-300" />
                    )}
                    <span>{feedback.message}</span>
                    <button
                      type="button"
                      onClick={() => setFeedback(null)}
                      className="ml-auto text-xs uppercase tracking-wide text-white/80 hover:text-white"
                    >
                      Cerrar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div 
            ref={previewContainerRef}
            className="w-full lg:w-5/12 xl:w-[480px] flex flex-col gap-4 mt-6 lg:mt-0" 
            style={{ 
              position: 'relative', 
              top: 0, 
              left: 0, 
              right: 'auto', 
              bottom: 'auto', 
              zIndex: 'auto',
              transform: 'none',
              willChange: 'auto',
              height: 'auto',
              maxHeight: 'none',
              overflow: 'visible'
            }}
          >
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
              <div className="w-full flex justify-center overflow-auto px-2">
                <div
                  ref={previewRef}
                  className="min-h-[220px] w-full flex items-start justify-center overflow-hidden"
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
          </div>
        </div>
      </div>
    </div>
  );
}
