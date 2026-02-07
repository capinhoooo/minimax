import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from './config/wagmi';

// Layout
import Layout from './components/layout/Layout';

// Pages (eager)
import Home from './pages/Home';
import BattleArena from './pages/Battle/BattleArena';
import BattleDetail from './pages/Battle/BattleDetail';
import CreateBattle from './pages/Battle/CreateBattle';
import Agent from './pages/Agent';
import Leaderboard from './pages/Leaderboard';
import Lobby from './pages/Lobby';

// Lazy-loaded (LI.FI widget is large ~2MB)
const Swap = lazy(() => import('./pages/Swap'));

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      refetchInterval: 10000, // Refetch every 10 seconds for live data
    },
  },
});

function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="battle" element={<BattleArena />} />
              <Route path="battle/:id" element={<BattleDetail />} />
              <Route path="battle/create" element={<CreateBattle />} />
              <Route path="leaderboard" element={<Leaderboard />} />
              <Route path="swap" element={<Suspense fallback={<div className="flex items-center justify-center min-h-screen"><span className="text-sm font-mono text-gray-500 tracking-wider">LOADING SWAP ENGINE...</span></div>}><Swap /></Suspense>} />
              <Route path="bridge" element={<Suspense fallback={<div className="flex items-center justify-center min-h-screen"><span className="text-sm font-mono text-gray-500 tracking-wider">LOADING BRIDGE...</span></div>}><Swap /></Suspense>} />
              <Route path="lobby" element={<Lobby />} />
              <Route path="agent" element={<Agent />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;
