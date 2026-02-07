import { Link, Outlet } from 'react-router-dom';
import Header from './Header';
import logo from '../../assets/logo.png';

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 pt-20 md:pt-16">
        <Outlet />
      </main>
      <footer
        className="px-4 pt-12 pb-6"
        style={{ borderTop: '1px solid rgba(237, 127, 47, 0.15)' }}
      >
        <div className="mx-auto max-w-7xl">
          {/* Top Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            {/* Brand */}
            <div className="sm:col-span-2 lg:col-span-1">
              <Link to="/" className="inline-block mb-4">
                <img src={logo} alt="Minimax" className="h-10" />
              </Link>
              <p className="text-xs font-mono text-gray-600 leading-relaxed tracking-wider">
                THE WORLD'S FIRST PVP YIELD BATTLEFIELD ON UNISWAP V4.
              </p>
            </div>

            {/* Navigate */}
            <div>
              <h4 className="text-[10px] font-mono font-bold tracking-widest mb-4" style={{ color: '#ed7f2f' }}>
                NAVIGATE
              </h4>
              <div className="space-y-2.5">
                {[
                  { label: 'LOBBY', to: '/lobby' },
                  { label: 'BATTLES', to: '/battle' },
                  { label: 'LEADERBOARD', to: '/leaderboard' },
                  { label: 'SWAP / BRIDGE', to: '/swap' },
                ].map((link) => (
                  <Link
                    key={link.label}
                    to={link.to}
                    className="block text-xs font-mono text-gray-500 tracking-wider hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Protocol */}
            <div>
              <h4 className="text-[10px] font-mono font-bold tracking-widest mb-4" style={{ color: '#42c7e6' }}>
                PROTOCOL
              </h4>
              <div className="space-y-2.5">
                {[
                  { label: 'UNISWAP V4', href: 'https://docs.uniswap.org' },
                  { label: 'DOCUMENTATION', href: 'https://github.com' },
                  { label: 'SMART CONTRACTS', href: 'https://github.com' },
                ].map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs font-mono text-gray-500 tracking-wider hover:text-white transition-colors"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>

            {/* Community */}
            <div>
              <h4 className="text-[10px] font-mono font-bold tracking-widest mb-4" style={{ color: '#a855f7' }}>
                COMMUNITY
              </h4>
              <div className="space-y-2.5">
                {[
                  { label: 'GITHUB', href: 'https://github.com' },
                  { label: 'DISCORD', href: 'https://discord.gg' },
                  { label: 'X / TWITTER', href: 'https://x.com' },
                ].map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs font-mono text-gray-500 tracking-wider hover:text-white transition-colors"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px w-full mb-6" style={{ background: 'rgba(255, 255, 255, 0.05)' }} />

          {/* Bottom Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[10px] font-mono text-gray-600 tracking-wider">
              &copy; 2026 MINIMAX ARENA // ALL RIGHTS RESERVED
            </p>
            <p className="text-[10px] font-mono text-gray-700 tracking-wider">
              STATUS: <span style={{ color: '#22c55e' }}>OPERATIONAL</span> // CHAIN: ETHEREUM SEPOLIA
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
