import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Ticket, Calendar, Hash, CheckCircle, Clock, Trash2 } from 'lucide-react';

interface TicketWithEvent {
  id: string;
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
      const { error } = await supabase.from('tickets').delete().eq('id', ticketId);
      if (error) throw error;
      setTickets((prev) => prev.filter((ticket) => ticket.id !== ticketId));
    } catch (error) {
      console.error('Error deleting ticket:', error);
      alert('No se pudo eliminar la entrada. Intenta nuevamente.');
    } finally {
      setDeletingId(null);
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

        <div className="flex gap-2 sm:gap-3 mb-4 sm:mb-6 overflow-x-auto pb-2">
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
                      className="border-b border-gray-700 hover:bg-gray-750 transition-colors"
                    >
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
                            <span className="sm:hidden">OK</span>
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
                        <button
                          onClick={() => handleDelete(ticket.id)}
                          disabled={deletingId === ticket.id}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-red-900 text-red-200 rounded-lg border border-red-700 hover:bg-red-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
                        >
                          <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                          {deletingId === ticket.id ? 'Eliminando...' : 'Eliminar'}
                        </button>
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
  );
}
