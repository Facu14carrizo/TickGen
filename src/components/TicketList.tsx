import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Ticket, Calendar, Hash, CheckCircle, Clock, Trash2, RefreshCcw, Square, CheckSquare2, Eye, X, Download } from 'lucide-react';
import { createTicketElement, generateQRCode, TicketOrientation, TicketQRPosition, TicketDesignOptions, downloadTicketAsImage } from '../lib/ticketGenerator';

interface TicketWithEvent {
  id: string;
  event_id: number;
  qr_code: string;
  is_used: boolean;
  used_at: string | null;
  ticket_number: number;
  created_at: string;
  events: {
    name: string;
    event_date: string;
  };
}

interface TicketListProps {
  refreshKey?: number;
}

export default function TicketList({ refreshKey = 0 }: TicketListProps) {
  const [tickets, setTickets] = useState<TicketWithEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'used' | 'unused'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeletingMultiple, setIsDeletingMultiple] = useState(false);
  const [previewTicket, setPreviewTicket] = useState<(TicketWithEvent & { totalTickets?: number }) | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewDesign, setPreviewDesign] = useState<{
    title: string;
    subtitle: string;
    dateText: string;
    qrDataUrl: string;
    backgroundImage?: string;
    orientation: TicketOrientation;
    qrPosition: TicketQRPosition;
    designOptions: TicketDesignOptions;
  } | null>(null);
  const [isDownloadingTicket, setIsDownloadingTicket] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchTickets();
  }, [refreshKey]);

  useEffect(() => {
    const channel = supabase
      .channel('tickets-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
        fetchTickets();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleDelete = async (ticketId: string) => {
    const confirmed = window.confirm('¿Seguro que deseas eliminar esta entrada? Esta acción no se puede deshacer.');
    if (!confirmed) return;

    try {
      setDeletingId(ticketId);
      const { error } = await supabase.from('tickets').delete().eq('id', Number(ticketId));
      if (error) throw error;
      await fetchTickets();
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Error deleting ticket:', error);
      alert('No se pudo eliminar la entrada. Intenta nuevamente.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleSelect = (ticketId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(ticketId)) {
        newSet.delete(ticketId);
      } else {
        newSet.add(ticketId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredTickets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTickets.map(t => t.id)));
    }
  };

  const handleDeleteMultiple = async () => {
    if (selectedIds.size === 0) return;

    const count = selectedIds.size;
    const confirmed = window.confirm(
      `¿Seguro que deseas eliminar ${count} entrada${count > 1 ? 's' : ''}? Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    try {
      setIsDeletingMultiple(true);
      const idsArray = Array.from(selectedIds).map(id => Number(id));
      
      // Borrar en lotes para mejor rendimiento
      const batchSize = 10;
      for (let i = 0; i < idsArray.length; i += batchSize) {
        const batch = idsArray.slice(i, i + batchSize);
        const { error } = await supabase
          .from('tickets')
          .delete()
          .in('id', batch);
        
        if (error) throw error;
      }

      await fetchTickets();
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Error deleting multiple tickets:', error);
      alert('No se pudieron eliminar las entradas. Intenta nuevamente.');
    } finally {
      setIsDeletingMultiple(false);
    }
  };

  const fetchTickets = async () => {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select('*, events(name, event_date)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTickets = tickets.filter((ticket) => {
    if (filter === 'used') return ticket.is_used;
    if (filter === 'unused') return !ticket.is_used;
    return true;
  });

  // Limpiar selección cuando cambia el filtro
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filter]);

  const handleViewTicket = async (ticket: TicketWithEvent) => {
    setPreviewTicket({ ...ticket, totalTickets: undefined });
    setPreviewDesign(null);
    setIsPreviewLoading(true);
    if (previewRef.current) {
      previewRef.current.innerHTML = '';
    }
    try {
      const [{ data: designData }, qrDataUrl, totalCountRes] = await Promise.all([
        supabase
          .from('ticket_designs')
          .select('*')
          .eq('event_id', ticket.event_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        generateQRCode(ticket.qr_code),
        supabase
          .from('tickets')
          .select('ticket_number', { count: 'exact', head: true })
          .eq('event_id', ticket.event_id),
      ]);

      const title = designData?.title || ticket.events.name;
      const subtitle = designData?.subtitle || `Entrada #${ticket.ticket_number}`;
      const dateText = new Date(ticket.events.event_date).toLocaleString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const designOptions: TicketDesignOptions = {
        backgroundColor: '#1f2937',
        accentColor: '#3b82f6',
        textColor: '#ffffff',
        qrSize: 'medium',
        overlayOpacity: designData?.background_image ? 0.55 : 0,
        showTicketNumber: true,
        qrBorderStyle: 'rounded',
      };

      setPreviewTicket({
        ...ticket,
        totalTickets: totalCountRes?.count || undefined,
      });

      setPreviewDesign({
        title,
        subtitle,
        dateText,
        qrDataUrl,
        backgroundImage: designData?.background_image || undefined,
        orientation: 'landscape',
        qrPosition: 'end',
        designOptions,
      });
    } catch (error) {
      console.error('Error loading preview:', error);
      alert('No se pudo cargar la vista previa. Intenta nuevamente.');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewTicket(null);
    if (previewRef.current) {
      previewRef.current.innerHTML = '';
    }
    setPreviewDesign(null);
    setIsPreviewLoading(false);
    setIsDownloadingTicket(false);
  };

  useEffect(() => {
    if (!previewDesign || !previewRef.current || !previewTicket) return;

    const {
      title,
      subtitle,
      dateText,
      qrDataUrl,
      backgroundImage,
      orientation,
      qrPosition,
      designOptions,
    } = previewDesign;

    const element = createTicketElement(
      title,
      subtitle,
      previewTicket.ticket_number,
      dateText,
      qrDataUrl,
      backgroundImage,
      orientation,
      qrPosition,
      designOptions
    );

    const container = previewRef.current;
    container.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.style.display = 'inline-block';
    wrapper.style.transition = 'transform 0.2s ease';

    wrapper.appendChild(element);
    container.appendChild(wrapper);

    const resizeObserver = new ResizeObserver(() => {
      const containerWidth = container.clientWidth || 600;
      const ticketWidth = element.offsetWidth || 600;
      const scale = Math.min(1, containerWidth / ticketWidth);
      wrapper.style.transform = `scale(${scale})`;
      wrapper.style.transformOrigin = 'top center';
    });

    resizeObserver.observe(container);

    setIsPreviewLoading(false);

    return () => {
      resizeObserver.disconnect();
      container.innerHTML = '';
    };
  }, [previewDesign, previewTicket]);

  const handleDownloadTicket = async () => {
    if (!previewTicket || !previewDesign) return;
    setIsDownloadingTicket(true);
    try {
      const element = createTicketElement(
        previewDesign.title,
        previewDesign.subtitle,
        previewTicket.ticket_number,
        previewDesign.dateText,
        previewDesign.qrDataUrl,
        previewDesign.backgroundImage,
        previewDesign.orientation,
        previewDesign.qrPosition,
        previewDesign.designOptions
      );

      await downloadTicketAsImage(
        element,
        `ticket-${previewTicket.ticket_number}.pdf`,
        previewTicket.events.name
      );
    } catch (error) {
      console.error('Error downloading ticket:', error);
      alert('No se pudo descargar la entrada. Intenta nuevamente.');
    } finally {
      setIsDownloadingTicket(false);
    }
  };

  const stats = {
    total: tickets.length,
    used: tickets.filter((t) => t.is_used).length,
    unused: tickets.filter((t) => !t.is_used).length,
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-400 border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
      <div className="bg-gray-800 rounded-2xl shadow-xl p-4 sm:p-8">
        <div className="flex items-center gap-2 sm:gap-3 mb-6 sm:mb-8">
          <div className="p-2 sm:p-3 bg-blue-900 rounded-xl">
            <Ticket className="w-6 h-6 sm:w-8 sm:h-8 text-blue-400" />
          </div>
          <h2 className="text-xl sm:text-3xl font-bold text-white">Gestión de Entradas</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="bg-gradient-to-br from-blue-900 to-blue-800 rounded-xl p-4 sm:p-6 border-2 border-blue-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-300 font-semibold mb-1 text-sm sm:text-base">Total</p>
                <p className="text-2xl sm:text-3xl font-bold text-blue-100">{stats.total}</p>
              </div>
              <Hash className="w-8 h-8 sm:w-12 sm:h-12 text-blue-500" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-900 to-green-800 rounded-xl p-4 sm:p-6 border-2 border-green-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-300 font-semibold mb-1 text-sm sm:text-base">Utilizadas</p>
                <p className="text-2xl sm:text-3xl font-bold text-green-100">{stats.used}</p>
              </div>
              <CheckCircle className="w-8 h-8 sm:w-12 sm:h-12 text-green-500" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-900 to-orange-800 rounded-xl p-4 sm:p-6 border-2 border-orange-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-300 font-semibold mb-1 text-sm sm:text-base">Disponibles</p>
                <p className="text-2xl sm:text-3xl font-bold text-orange-100">{stats.unused}</p>
              </div>
              <Clock className="w-8 h-8 sm:w-12 sm:h-12 text-orange-500" />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
          <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 sm:px-6 py-2 rounded-lg font-semibold transition-all whitespace-nowrap text-sm sm:text-base ${
                filter === 'all'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setFilter('unused')}
              className={`px-4 sm:px-6 py-2 rounded-lg font-semibold transition-all whitespace-nowrap text-sm sm:text-base ${
                filter === 'unused'
                  ? 'bg-orange-600 text-white shadow-lg'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Disponibles
            </button>
            <button
              onClick={() => setFilter('used')}
              className={`px-4 sm:px-6 py-2 rounded-lg font-semibold transition-all whitespace-nowrap text-sm sm:text-base ${
                filter === 'used'
                  ? 'bg-green-600 text-white shadow-lg'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Utilizadas
            </button>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {selectedIds.size > 0 && (
              <button
                onClick={handleDeleteMultiple}
                disabled={isDeletingMultiple}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-all text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                {isDeletingMultiple ? 'Eliminando...' : `Eliminar ${selectedIds.size}`}
              </button>
            )}
            <button
              onClick={fetchTickets}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-700 text-gray-100 bg-gray-800 hover:bg-gray-700 transition-all text-sm sm:text-base"
            >
              <RefreshCcw className="w-4 h-4" />
              Refrescar
            </button>
          </div>
        </div>

        {filteredTickets.length === 0 ? (
          <div className="text-center py-8 sm:py-12">
            <Ticket className="w-12 h-12 sm:w-16 sm:h-16 text-gray-600 mx-auto mb-3 sm:mb-4" />
            <p className="text-gray-400 text-base sm:text-lg">No hay entradas para mostrar</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b-2 border-gray-700">
                    <th className="text-left py-3 sm:py-4 px-2 sm:px-4 font-bold text-gray-300 text-xs sm:text-base w-12">
                      <button
                        onClick={handleSelectAll}
                        className="flex items-center justify-center w-5 h-5 rounded border-2 border-gray-500 hover:border-blue-500 transition-colors"
                        title={selectedIds.size === filteredTickets.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                      >
                        {selectedIds.size === filteredTickets.length && filteredTickets.length > 0 ? (
                          <CheckSquare2 className="w-4 h-4 text-blue-400" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </th>
                    <th className="text-left py-3 sm:py-4 px-2 sm:px-4 font-bold text-gray-300 text-xs sm:text-base">#</th>
                    <th className="text-left py-3 sm:py-4 px-2 sm:px-4 font-bold text-gray-300 text-xs sm:text-base">Evento</th>
                    <th className="text-left py-3 sm:py-4 px-2 sm:px-4 font-bold text-gray-300 text-xs sm:text-base hidden md:table-cell">Fecha Evento</th>
                    <th className="text-left py-3 sm:py-4 px-2 sm:px-4 font-bold text-gray-300 text-xs sm:text-base">Estado</th>
                    <th className="text-left py-3 sm:py-4 px-2 sm:px-4 font-bold text-gray-300 text-xs sm:text-base hidden lg:table-cell">Usado el</th>
                    <th className="text-right py-3 sm:py-4 px-2 sm:px-4 font-bold text-gray-300 text-xs sm:text-base">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      className={`border-b border-gray-700 hover:bg-gray-750 transition-colors ${
                        selectedIds.has(ticket.id) ? 'bg-blue-900/20' : ''
                      }`}
                    >
                      <td className="py-3 sm:py-4 px-2 sm:px-4">
                        <button
                          onClick={() => handleToggleSelect(ticket.id)}
                          className="flex items-center justify-center w-5 h-5 rounded border-2 border-gray-500 hover:border-blue-500 transition-colors"
                          title={selectedIds.has(ticket.id) ? 'Deseleccionar' : 'Seleccionar'}
                        >
                          {selectedIds.has(ticket.id) ? (
                            <CheckSquare2 className="w-4 h-4 text-blue-400" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                      </td>
                      <td className="py-3 sm:py-4 px-2 sm:px-4">
                        <span className="font-semibold text-gray-300 text-xs sm:text-base">
                          #{ticket.ticket_number}
                        </span>
                      </td>
                      <td className="py-3 sm:py-4 px-2 sm:px-4">
                        <div className="flex items-center gap-1 sm:gap-2">
                          <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
                          <span className="font-medium text-gray-200 text-xs sm:text-base">
                            {ticket.events.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 sm:py-4 px-2 sm:px-4 text-gray-400 text-xs sm:text-base hidden md:table-cell">
                        {new Date(ticket.events.event_date).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 sm:py-4 px-2 sm:px-4">
                        {ticket.is_used ? (
                          <span className="inline-flex items-center gap-1 px-2 sm:px-3 py-1 bg-green-900 text-green-300 rounded-full text-xs sm:text-sm font-semibold border border-green-700">
                            <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                            <span className="hidden sm:inline">Utilizada</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 sm:px-3 py-1 bg-orange-900 text-orange-300 rounded-full text-xs sm:text-sm font-semibold border border-orange-700">
                            <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                            <span className="hidden sm:inline">Disponible</span>
                            <span className="sm:hidden">OK</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 sm:py-4 px-2 sm:px-4 text-gray-400 text-xs sm:text-base hidden lg:table-cell">
                        {ticket.used_at
                          ? new Date(ticket.used_at).toLocaleDateString('es-ES', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '-'}
                      </td>
                      <td className="py-3 sm:py-4 px-2 sm:px-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleViewTicket(ticket)}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-blue-900 text-blue-200 rounded-lg border border-blue-700 hover:bg-blue-800 transition-colors text-xs sm:text-sm"
                            title="Ver"
                          >
                            <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                            <span className="hidden sm:inline">Ver</span>
                          </button>
                          <button
                            onClick={() => handleDelete(ticket.id)}
                            disabled={deletingId === ticket.id}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-red-900 text-red-200 rounded-lg border border-red-700 hover:bg-red-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                            <span className="hidden sm:inline">
                              {deletingId === ticket.id ? 'Eliminando...' : 'Eliminar'}
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
    {previewTicket && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
        <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto border border-gray-700">
            <div className="flex items-center justify-between border-b border-gray-700 px-4 sm:px-6 py-3 sm:py-4">
              <div>
                <p className="text-sm text-gray-400">Vista previa de la entrada</p>
                <h3 className="text-xl font-bold text-white">
                  {previewTicket.events.name} — Entrada #{previewTicket.ticket_number}
                  {previewTicket.totalTickets ? (
                    <span className="text-sm text-gray-400 ml-2">
                      ({previewTicket.totalTickets} entradas generadas)
                    </span>
                  ) : null}
                </h3>
              </div>
              <button
                onClick={closePreview}
                className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 px-4 sm:px-6 py-4 sm:py-6">
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 sm:p-6">
                <h4 className="text-lg font-semibold text-white mb-3">Detalles</h4>
                <div className="space-y-3 text-sm text-gray-300">
                  <div>
                    <span className="text-gray-400">Evento:</span>
                    <p className="font-semibold text-white">{previewTicket.events.name}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-gray-400 block">Entrada #</span>
                      <span className="font-semibold text-white">{previewTicket.ticket_number}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Estado</span>
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                          previewTicket.is_used
                            ? 'bg-green-900 text-green-300 border border-green-700'
                            : 'bg-orange-900 text-orange-300 border border-orange-700'
                        }`}
                      >
                        {previewTicket.is_used ? 'Utilizada' : 'Disponible'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Fecha del evento</span>
                    <p className="font-semibold text-white">
                      {new Date(previewTicket.events.event_date).toLocaleString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Último uso</span>
                    <p className="font-semibold text-white">
                      {previewTicket.used_at
                        ? new Date(previewTicket.used_at).toLocaleString('es-ES', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </p>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={handleDownloadTicket}
                      disabled={isDownloadingTicket || !previewDesign}
                      className="hidden sm:inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Download className="w-4 h-4" />
                      {isDownloadingTicket ? 'Descargando...' : 'Descargar entrada'}
                    </button>
                    <button
                      onClick={handleDownloadTicket}
                      disabled={isDownloadingTicket || !previewDesign}
                      className="inline-flex sm:hidden items-center justify-center w-10 h-10 rounded-full bg-blue-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Descargar entrada"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

            <div className="bg-gray-800 rounded-xl border border-gray-700 p-3 sm:p-4 lg:p-6 flex flex-col">
              <h4 className="text-lg font-semibold text-white mb-3">Diseño</h4>
              <div className="flex-1 overflow-auto flex flex-col items-center">
                <div
                  ref={previewRef}
                  className="flex items-center justify-center min-h-[260px] w-full"
                >
                  {isPreviewLoading || !previewDesign ? (
                    <div className="text-gray-400 text-sm">Cargando vista previa...</div>
                  ) : null}
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

