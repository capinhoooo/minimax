import { Link, useLocation } from 'react-router-dom';
import logo from '../../assets/logo.png';
import ConnectButton from '../wallet/ConnectButton';

const navigation = [
  { name: 'LOBBY', href: '/lobby' },
  { name: 'BATTLES', href: '/battle', hasBadge: true },
  { name: 'LEADERBOARD', href: '/leaderboard' },
  { name: 'SWAP / BRIDGE', href: '/swap' },
  { name: 'PROFILE', href: '/profile' },
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
          <Link to="/" className="flex items-center flex-shrink-0">
            <img src={logo} alt="Minimax" className="h-12" />
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
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Right Section */}
          <div className="flex items-center gap-3 flex-shrink-0">

            {/* Connect Wallet Button */}
            <ConnectButton />
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
