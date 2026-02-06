import { Link, useLocation } from 'react-router-dom';
import { Wallet } from 'lucide-react';

const navigation = [
  { name: 'DASHBOARD', href: '/' },
  { name: 'BATTLES', href: '/battle', hasBadge: true },
  { name: 'LEADERBOARD', href: '/leaderboard' },
  { name: 'MY POSITIONS', href: '/positions' },
];

export default function Header() {
  const location = useLocation();

  const isActive = (href: string) => {
    if (href === '/') return location.pathname === '/';
    return location.pathname.startsWith(href);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-4 py-4">
      <div
        className="mx-auto max-w-6xl rounded-xl px-4 py-2"
        style={{
          background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.95), rgba(1, 1, 1, 0.98))',
          border: '1px solid rgba(237, 127, 47, 0.2)',
          boxShadow: '0 4px 30px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div className="flex items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 flex-shrink-0">
            {/* Logo Icon */}
            <div
              className="w-9 h-9 flex items-center justify-center rounded-lg"
              style={{
                background: 'linear-gradient(135deg, rgba(66, 199, 230, 0.15), rgba(14, 77, 157, 0.15))',
                border: '1px solid rgba(66, 199, 230, 0.3)',
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#42c7e6"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
            {/* Logo Text */}
            <div className="hidden sm:block">
              <div className="flex items-baseline">
                <span className="text-base font-bold tracking-wide" style={{ color: '#42c7e6' }}>
                  LIQUID
                </span>
                <span className="text-base font-bold tracking-wide text-white">
                  WARS
                </span>
              </div>
              <p className="text-[9px] font-mono tracking-widest text-gray-600 -mt-0.5">
                PVP PROTOCOL
              </p>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
            {navigation.map((item) => {
              const active = isActive(item.href);

              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className="relative px-4 py-1.5 text-xs font-medium tracking-wider transition-all rounded-md"
                  style={{
                    color: active ? 'white' : '#6b7280',
                    background: active
                      ? 'rgba(255, 255, 255, 0.08)'
                      : 'transparent',
                    border: active ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid transparent',
                  }}
                >
                  <span className="flex items-center gap-2">
                    {item.name}
                    {item.hasBadge && (
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: '#ed7f2f' }}
                      />
                    )}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Right Section */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Gas Info */}
            <div className="hidden lg:flex items-center gap-1.5 text-[10px] font-mono">
              <span className="text-gray-600">GAS:</span>
              <span className="text-gray-400">12</span>
              <span className="text-gray-600">GWEI</span>
            </div>

            {/* Divider */}
            <div className="hidden lg:block w-px h-4 bg-gray-800" />

            {/* Version */}
            <div className="hidden lg:flex items-center gap-1.5 text-[10px] font-mono">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: '#22c55e' }}
              />
              <span className="text-gray-600">v2.4.0</span>
            </div>

            {/* Connect Wallet Button */}
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-xs tracking-wider transition-all hover:opacity-90"
              style={{
                background: 'linear-gradient(135deg, rgba(66, 199, 230, 0.15), rgba(14, 77, 157, 0.15))',
                border: '1px solid rgba(66, 199, 230, 0.3)',
                color: '#42c7e6',
              }}
            >
              <Wallet className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">CONNECT WALLET</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation - Below navbar */}
      <div
        className="md:hidden mx-auto max-w-6xl mt-2 rounded-lg px-2 py-1.5 overflow-x-auto"
        style={{
          background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.95), rgba(1, 1, 1, 0.98))',
          border: '1px solid rgba(237, 127, 47, 0.15)',
        }}
      >
        <div className="flex justify-between gap-1 min-w-max">
          {navigation.map((item) => {
            const active = isActive(item.href);

            return (
              <Link
                key={item.name}
                to={item.href}
                className="flex items-center gap-1 px-3 py-1.5 rounded text-[10px] font-medium tracking-wider whitespace-nowrap transition-all"
                style={{
                  color: active ? 'white' : '#6b7280',
                  background: active ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                  border: active ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid transparent',
                }}
              >
                {item.name}
                {item.hasBadge && (
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: '#ed7f2f' }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}
