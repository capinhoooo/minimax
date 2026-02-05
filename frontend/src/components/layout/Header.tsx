import { Link, useLocation } from 'react-router-dom';
import { Swords, ArrowLeftRight, Wallet, Bot, Home } from 'lucide-react';
import ConnectButton from '../wallet/ConnectButton';

const navigation = [
  { name: 'Home', href: '/', icon: Home },
  { name: 'Battle', href: '/battle', icon: Swords },
  { name: 'Swap', href: '/swap', icon: ArrowLeftRight },
  { name: 'Bridge', href: '/bridge', icon: Wallet },
  { name: 'Agent', href: '/agent', icon: Bot },
];

export default function Header() {
  const location = useLocation();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <Swords className="h-8 w-8 text-accent-blue" />
            <span className="text-xl font-bold gradient-text">LP BattleVault</span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href ||
                (item.href !== '/' && location.pathname.startsWith(item.href));
              const Icon = item.icon;

              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                    ${isActive
                      ? 'bg-accent-blue/10 text-accent-blue'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }
                  `}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Wallet Connect */}
          <div className="flex items-center gap-4">
            <ConnectButton />
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <nav className="md:hidden border-t border-border px-4 py-2">
        <div className="flex justify-around">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href ||
              (item.href !== '/' && location.pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                to={item.href}
                className={`
                  flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors
                  ${isActive
                    ? 'text-accent-blue'
                    : 'text-gray-400 hover:text-white'
                  }
                `}
              >
                <Icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
