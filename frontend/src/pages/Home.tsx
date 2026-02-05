import { Link } from 'react-router-dom';
import { Swords, ArrowRight, Zap, Shield, Trophy } from 'lucide-react';

const features = [
  {
    icon: Swords,
    title: 'PvP LP Battles',
    description: 'Challenge other liquidity providers to head-to-head battles on Uniswap V4.',
  },
  {
    icon: Zap,
    title: 'Cross-Chain Entry',
    description: 'Enter battles from any EVM chain using LI.FI swaps and Arc USDC bridging.',
  },
  {
    icon: Shield,
    title: 'Autonomous Agent',
    description: 'Battles are automatically settled by our agent when time expires.',
  },
  {
    icon: Trophy,
    title: 'Winner Takes All',
    description: 'Stay in-range longer than your opponent to claim their LP position.',
  },
];

const steps = [
  { number: '01', title: 'Swap', description: 'Convert any token to LP tokens' },
  { number: '02', title: 'Add Liquidity', description: 'Create a V4 LP position' },
  { number: '03', title: 'Battle', description: 'Challenge an opponent' },
  { number: '04', title: 'Win', description: 'Stay in-range to win' },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 px-4 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-accent-blue/10 via-transparent to-transparent" />

        <div className="relative mx-auto max-w-7xl text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-blue/10 border border-accent-blue/20 mb-8">
            <Swords className="h-4 w-4 text-accent-blue" />
            <span className="text-sm text-accent-blue">Built on Uniswap V4</span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6">
            <span className="gradient-text">LP BattleVault</span>
          </h1>

          <p className="text-xl sm:text-2xl text-gray-400 mb-8 max-w-3xl mx-auto">
            PvP battles for Uniswap V4 liquidity providers.
            <br />
            Stake your position. Stay in range. Winner takes all.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/battle" className="btn-primary text-lg px-8 py-3 flex items-center gap-2">
              Enter Battle Arena
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link to="/swap" className="btn-secondary text-lg px-8 py-3">
              Swap Tokens
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-3xl font-bold text-center mb-12">Why LP BattleVault?</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="card hover:border-accent-blue/30 transition-colors">
                  <Icon className="h-10 w-10 text-accent-blue mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-gray-400 text-sm">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 px-4 bg-background-secondary">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div key={step.number} className="relative">
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-full w-full h-0.5 bg-gradient-to-r from-accent-blue/50 to-transparent" />
                )}
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent-blue/10 border border-accent-blue/30 mb-4">
                    <span className="text-2xl font-bold text-accent-blue">{step.number}</span>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                  <p className="text-gray-400 text-sm">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Battle?</h2>
          <p className="text-gray-400 mb-8">
            Connect your wallet and enter the arena. May the best LP win!
          </p>
          <Link to="/battle" className="btn-primary text-lg px-8 py-3 inline-flex items-center gap-2">
            Start Battling
            <Swords className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
