import { useState } from 'react';
import TicketGenerator from './components/TicketGenerator';
import TicketScanner from './components/TicketScanner';
import TicketList from './components/TicketList';
import { Ticket, Scan, List, Theater } from 'lucide-react';

type View = 'generator' | 'scanner' | 'list';

function App() {
  const [currentView, setCurrentView] = useState<View>('generator');
  const [ticketsVersion, setTicketsVersion] = useState(0);

  const refreshTickets = () => setTicketsVersion((prev) => prev + 1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <nav className="bg-gray-800 shadow-lg border-b-2 border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
                <Theater className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-white">
                  Sistema de Entradas Digitales
                </h1>
                <p className="text-xs sm:text-sm text-gray-400">Gestión profesional de entradas</p>
              </div>
            </div>
          </div>

          <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-6 overflow-x-auto pb-2">
            <button
              onClick={() => setCurrentView('generator')}
              className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-6 py-2 sm:py-3 rounded-xl font-semibold transition-all whitespace-nowrap text-sm sm:text-base ${
                currentView === 'generator'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg scale-105'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:scale-105'
              }`}
            >
              <Ticket className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Generar Entradas</span>
              <span className="sm:hidden">Generar</span>
            </button>

            <button
              onClick={() => setCurrentView('scanner')}
              className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-6 py-2 sm:py-3 rounded-xl font-semibold transition-all whitespace-nowrap text-sm sm:text-base ${
                currentView === 'scanner'
                  ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg scale-105'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:scale-105'
              }`}
            >
              <Scan className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Validar Entradas</span>
              <span className="sm:hidden">Validar</span>
            </button>

            <button
              onClick={() => setCurrentView('list')}
              className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-6 py-2 sm:py-3 rounded-xl font-semibold transition-all whitespace-nowrap text-sm sm:text-base ${
                currentView === 'list'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg scale-105'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:scale-105'
              }`}
            >
              <List className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Registros</span>
              <span className="sm:hidden">Regs</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="py-4 sm:py-8">
        {currentView === 'generator' && <TicketGenerator onGenerated={refreshTickets} />}
        {currentView === 'scanner' && <TicketScanner onTicketValidated={refreshTickets} />}
        {currentView === 'list' && <TicketList refreshKey={ticketsVersion} />}
      </main>

      <footer className="bg-gray-800 border-t-2 border-gray-700 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-gray-400 text-xs sm:text-sm text-center sm:text-left">
            Sistema de Gestión de Entradas Digitales — Seguro, eficiente y profesional
          </p>
          <p className="text-gray-400 text-xs sm:text-sm">
            Desarrollado por{' '}
            <a
              href="https://waveframe.com.ar"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 font-semibold"
            >
              Waveframe Studio
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
