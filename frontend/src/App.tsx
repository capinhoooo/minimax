import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from './config/wagmi';

// Layout
import Layout from './components/layout/Layout';

// Pages
import Home from './pages/Home';
import BattleArena from './pages/Battle/BattleArena';
import BattleDetail from './pages/Battle/BattleDetail';
import CreateBattle from './pages/Battle/CreateBattle';
import Swap from './pages/Swap';
import Agent from './pages/Agent';
import Leaderboard from './pages/Leaderboard';
import Lobby from './pages/Lobby';

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
              <Route path="swap" element={<Swap />} />
              <Route path="bridge" element={<Swap />} />
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
