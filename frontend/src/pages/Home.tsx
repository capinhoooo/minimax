import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';

// Chart data for the pool visualization
const chartData = [
  { height: 25 }, { height: 30 }, { height: 28 }, { height: 35 },
  { height: 40 }, { height: 38 }, { height: 45 }, { height: 42 },
  { height: 50 }, { height: 48 }, { height: 55 }, { height: 52 },
  { height: 58 }, { height: 62 }, { height: 60 }, { height: 65 },
  { height: 70 }, { height: 68 }, { height: 75 }, { height: 72 },
  { height: 78 }, { height: 82 }, { height: 80 }, { height: 85 },
];

// Trend line points for SVG path
const trendLinePoints = "M0,75 Q50,70 100,65 T200,55 T300,50 T400,40 T500,35";

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen grid-bg relative overflow-hidden">
      {/* Hero Section */}
      <section className="relative py-24 px-4">
        {/* Background glow effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-accent-magenta/10 blur-[120px] rounded-full" />
        </div>

        <div className="relative mx-auto max-w-7xl text-center">
          {/* Main Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black mb-6 tracking-tight">
            <span className="gradient-text-magenta italic">LIQUIDITY. REINVENTED.</span>
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-base tracking-[0.3em] text-gray-500 mb-16 uppercase">
            The world's first PvP yield battlefield on Uniswap V4.
          </p>

          {/* Terminal Card */}
          <div className="relative max-w-2xl mx-auto">
            {/* Purple sphere - top right */}
            <div
              className="absolute -top-8 -right-12 w-16 h-16 sphere sphere-purple z-10 hidden sm:block"
              style={{
                transform: mounted ? 'translateY(0)' : 'translateY(20px)',
                opacity: mounted ? 1 : 0,
                transition: 'all 0.8s ease-out 0.5s'
              }}
            />

            {/* Cyan sphere - bottom left */}
            <div
              className="absolute -bottom-8 -left-12 w-12 h-12 sphere sphere-cyan z-10 hidden sm:block"
              style={{
                transform: mounted ? 'translateY(0)' : 'translateY(-20px)',
                opacity: mounted ? 1 : 0,
                transition: 'all 0.8s ease-out 0.7s'
              }}
            />

            <div
              className="terminal-card overflow-hidden"
              style={{
                transform: mounted ? 'translateY(0)' : 'translateY(30px)',
                opacity: mounted ? 1 : 0,
                transition: 'all 0.6s ease-out 0.2s'
              }}
            >
              {/* Terminal header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
                <div className="terminal-dot bg-red-500" />
                <div className="terminal-dot bg-yellow-500" />
                <div className="terminal-dot bg-green-500" />
              </div>

              {/* Terminal content */}
              <div className="p-6">
                {/* Pool header */}
                <div className="flex items-center justify-between mb-6">
                  <span className="text-white font-medium">ETH/USDC Pool</span>
                  <span className="text-accent-green font-mono text-sm">+12.4% APY</span>
                </div>

                {/* Chart */}
                <div className="relative h-48 mb-6">
                  {/* Grid lines */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="w-full border-t border-dashed border-gray-700/50"
                        style={{ opacity: 0.3 }}
                      />
                    ))}
                  </div>

                  {/* Bars */}
                  <div className="absolute inset-0 flex items-end justify-between gap-1 px-2">
                    {chartData.map((bar, index) => (
                      <div
                        key={index}
                        className="flex-1 rounded-t chart-bar"
                        style={{
                          background: 'linear-gradient(to top, rgba(66, 199, 230, 0.8), rgba(14, 77, 157, 0.6))',
                          height: `${bar.height}%`,
                          animationDelay: `${index * 50}ms`
                        }}
                      />
                    ))}
                  </div>

                  {/* Trend line */}
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    viewBox="0 0 500 100"
                    preserveAspectRatio="none"
                  >
                    <path
                      d={trendLinePoints}
                      fill="none"
                      stroke="#42c7e6"
                      strokeWidth="2"
                      strokeLinecap="round"
                      className="drop-shadow-lg"
                      style={{
                        filter: 'drop-shadow(0 0 6px rgba(66, 199, 230, 0.8))'
                      }}
                    />
                  </svg>
                </div>

                {/* Action buttons */}
                <div className="flex gap-4">
                  <Link
                    to="/stake"
                    className="flex-1 btn-glow-magenta text-center py-3 text-sm"
                  >
                    Stake &gt;
                  </Link>
                  <Link
                    to="/battle"
                    className="flex-1 btn-glow-magenta text-center py-3 text-sm"
                  >
                    Challenge &gt;
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4">
        <div className="mx-auto max-w-6xl space-y-0">

          {/* Feature 1: Smart Staking Hooks */}
          <div
            className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center py-16"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(20px)',
              transition: 'all 0.6s ease-out 1.1s'
            }}
          >
            {/* Illustration Card */}
            <div className="relative">
              <div className="terminal-card p-6 max-w-md mx-auto lg:mx-0">
                {/* Window controls */}
                <div className="flex items-center gap-1.5 mb-6">
                  <div className="w-2 h-2 rounded-sm bg-gray-600" />
                  <div className="w-2 h-2 rounded-sm bg-gray-600" />
                </div>

                {/* V4 Diamond */}
                <div className="flex justify-center mb-8">
                  <div className="relative w-28 h-28">
                    <div
                      className="absolute inset-0 rotate-45 border-2 border-white/80 rounded-lg"
                      style={{
                        boxShadow: '0 0 20px rgba(255, 255, 255, 0.3), inset 0 0 20px rgba(255, 255, 255, 0.1)'
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-white text-3xl font-bold tracking-wider">V4</span>
                    </div>
                  </div>
                </div>

                {/* Progress bars */}
                <div className="space-y-3">
                  <div className="h-3 bg-gray-800 rounded overflow-hidden">
                    <div
                      className="h-full w-4/5 rounded"
                      style={{ background: 'linear-gradient(90deg, #ed7f2f, #8a3815)' }}
                    />
                  </div>
                  <div className="h-3 bg-gray-800 rounded overflow-hidden">
                    <div
                      className="h-full w-3/5 rounded"
                      style={{ background: 'linear-gradient(90deg, #42c7e6, #0e4d9d)' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Content Card */}
            <div className="feature-content-card p-8 rounded-lg border border-gray-700/50">
              <h3 className="text-2xl sm:text-3xl font-black text-[#42c7e6] italic mb-6 tracking-tight">
                SMART STAKING HOOKS
              </h3>
              <p className="text-gray-400 font-mono text-sm leading-relaxed mb-4">
                Arena utilizes the power of Uniswap V4 Hooks to transform static liquidity into active weaponry. When you create a position, you aren't just earning fees; you are deploying a programmable asset that dynamically adjusts to market volatility.
              </p>
              <p className="text-gray-400 font-mono text-sm leading-relaxed">
                Configure your range logic once, and let the hook manage your tick spacing automatically. If you already use V3, you can migrate your positions to the Arena with a single click using our{' '}
                <Link to="/migrate" className="text-[#42c7e6] underline decoration-dashed underline-offset-4 hover:text-[#5fd4f0]">
                  MIGRATION TOOL
                </Link>.
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-800/50 mx-auto max-w-4xl" />

          {/* Feature 2: Range Dominance Battles */}
          <div
            className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center py-16"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(20px)',
              transition: 'all 0.6s ease-out 1.2s'
            }}
          >
            {/* Illustration Card */}
            <div className="relative order-1 lg:order-1">
              {/* Cyan circle decoration */}
              <div
                className="absolute -top-4 -right-4 lg:right-8 w-16 h-16 rounded-full border-2 hidden sm:block"
                style={{ borderColor: '#42c7e6', boxShadow: '0 0 20px rgba(66, 199, 230, 0.4)' }}
              />

              <div className="terminal-card p-6 max-w-md mx-auto lg:mx-0">
                {/* Live Battle Badge */}
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#ed7f2f' }} />
                  <span className="text-xs font-mono tracking-wider" style={{ color: '#ed7f2f' }}>LIVE BATTLE</span>
                </div>

                {/* VS Display */}
                <div className="flex items-center justify-center gap-4">
                  {/* Orange Player */}
                  <div
                    className="w-24 h-28 rounded border-2"
                    style={{
                      borderColor: 'rgba(237, 127, 47, 0.5)',
                      background: 'linear-gradient(180deg, #ed7f2f 0%, #8a3815 100%)',
                      boxShadow: '0 0 30px rgba(237, 127, 47, 0.4)'
                    }}
                  />

                  {/* VS Text */}
                  <span className="text-white/60 text-xl font-bold">VS</span>

                  {/* Cyan Player */}
                  <div
                    className="w-24 h-28 rounded border-2"
                    style={{
                      borderColor: 'rgba(66, 199, 230, 0.5)',
                      background: 'linear-gradient(180deg, #42c7e6 0%, #0e4d9d 100%)',
                      boxShadow: '0 0 30px rgba(66, 199, 230, 0.4)'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Content Card */}
            <div className="feature-content-card p-8 rounded-lg border border-gray-700/50 order-2 lg:order-2">
              <h3 className="text-2xl sm:text-3xl font-black text-[#42c7e6] italic mb-6 tracking-tight">
                RANGE DOMINANCE BATTLES
              </h3>
              <p className="text-gray-400 font-mono text-sm leading-relaxed mb-4">
                Liquidity provision is no longer passive. In the Arena, you compete against other providers to maintain the tightest, most efficient range. Stay in-range longer than your opponent to capture their yield.
              </p>
              <p className="text-gray-400 font-mono text-sm leading-relaxed">
                The interface provides real-time telemetry on your opponent's tick depth and fee accrual. Adjust your strategy on the fly.{' '}
                <Link to="/leaderboard" className="text-[#42c7e6] underline decoration-dashed underline-offset-4 hover:text-[#5fd4f0]">
                  VIEW THE LEADERBOARD
                </Link>{' '}
                to see the top gladiators in the ETH/USDC pools.
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-800/50 mx-auto max-w-4xl" />

          {/* Feature 3: Winner Takes All */}
          <div
            className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center py-16"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(20px)',
              transition: 'all 0.6s ease-out 1.3s'
            }}
          >
            {/* Illustration Card */}
            <div className="relative">
              {/* Magenta glow effect behind card */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-32 bg-accent-magenta/20 blur-[60px] rounded-full" />
              </div>

              <div className="terminal-card p-6 max-w-md mx-auto lg:mx-0 relative">
                {/* Window control */}
                <div className="flex items-center gap-1.5 mb-6">
                  <div className="w-2 h-2 rounded-sm bg-gray-600" />
                </div>

                {/* Three boxes */}
                <div className="flex items-center justify-center gap-4 py-4">
                  {/* Left dark box */}
                  <div className="w-16 h-20 rounded border border-gray-700 bg-gray-900/80" />

                  {/* Center orange box */}
                  <div
                    className="w-16 h-20 rounded border-2 border-accent-magenta"
                    style={{
                      background: 'linear-gradient(180deg, rgba(237, 127, 47, 0.3) 0%, rgba(138, 56, 21, 0.3) 100%)',
                      boxShadow: '0 0 30px rgba(237, 127, 47, 0.5), inset 0 0 20px rgba(237, 127, 47, 0.2)'
                    }}
                  />

                  {/* Right dark box */}
                  <div className="w-16 h-20 rounded border border-gray-700 bg-gray-900/80" />
                </div>
              </div>
            </div>

            {/* Content Card */}
            <div className="feature-content-card p-8 rounded-lg border border-gray-700/50">
              <h3 className="text-2xl sm:text-3xl font-black text-[#42c7e6] italic mb-6 tracking-tight">
                WINNER TAKES ALL
              </h3>
              <p className="text-gray-400 font-mono text-sm leading-relaxed mb-4">
                To set up your Arena account, you'll need an Ethereum wallet. If the battle ends and your efficiency score exceeds your opponent's by 10%, you claim the accumulated pool fees from the battle duration.
              </p>
              <p className="text-gray-400 font-mono text-sm leading-relaxed">
                It's high stakes, high reward. Make sure you know your impermanent loss risk. To start an account, launch the{' '}
                <Link to="/battle" className="text-[#42c7e6] underline decoration-dashed underline-offset-4 hover:text-[#5fd4f0]">
                  ARENA DAPP
                </Link>
                , select a pool, and click the Battle button in the upper right corner. Sign in and you're ready to go.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div
          className="mx-auto max-w-2xl text-center"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.6s ease-out 1.5s'
          }}
        >
          <h2 className="text-2xl font-bold mb-4 text-white">Ready to Enter the Arena?</h2>
          <p className="text-gray-400 mb-8 text-sm">
            Connect your wallet and start battling. May the best LP win.
          </p>
          <Link
            to="/battle"
            className="btn-glow-magenta inline-block px-8 py-4"
          >
            Launch App &gt;
          </Link>
        </div>
      </section>
    </div>
  );
}
