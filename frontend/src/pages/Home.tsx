import { Link } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';

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
  const [activeFeature, setActiveFeature] = useState(0);
  const [showIllustration, setShowIllustration] = useState(false);
  const featuresRef = useRef<HTMLDivElement>(null);
  const feature1Ref = useRef<HTMLDivElement>(null);
  const feature2Ref = useRef<HTMLDivElement>(null);
  const feature3Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Track if any feature is in center to show/hide illustration
  useEffect(() => {
    const refs = [feature1Ref, feature2Ref, feature3Ref];
    const visibleSet = new Set<Element>();

    const visibilityObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            visibleSet.add(entry.target);
          } else {
            visibleSet.delete(entry.target);
          }
        });
        setShowIllustration(visibleSet.size > 0);
      },
      {
        root: null,
        rootMargin: '-35% 0px -35% 0px', // Only show when feature is near center (middle 30%)
        threshold: 0,
      }
    );

    refs.forEach((ref) => {
      if (ref.current) {
        visibilityObserver.observe(ref.current);
      }
    });

    return () => {
      refs.forEach((ref) => {
        if (ref.current) {
          visibilityObserver.unobserve(ref.current);
        }
      });
    };
  }, []);

  // Scroll-based feature detection using IntersectionObserver
  useEffect(() => {
    const refs = [feature1Ref, feature2Ref, feature3Ref];

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = refs.findIndex((ref) => ref.current === entry.target);
            if (index !== -1) {
              setActiveFeature(index);
            }
          }
        });
      },
      {
        root: null,
        rootMargin: '-45% 0px -45% 0px', // Trigger when element is in the middle 10% of viewport
        threshold: 0,
      }
    );

    refs.forEach((ref) => {
      if (ref.current) {
        observer.observe(ref.current);
      }
    });

    return () => {
      refs.forEach((ref) => {
        if (ref.current) {
          observer.unobserve(ref.current);
        }
      });
    };
  }, []);

  return (
    <div className="min-h-screen grid-bg relative">
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

      {/* Features Section - Scroll-based sticky effect */}
      <section className="py-16 px-4" ref={featuresRef}>
        <div className="mx-auto max-w-6xl">
          <div className="hidden lg:grid lg:grid-cols-2 gap-12">
            {/* Left Column - Sticky Illustration */}
            <div>
              <div
                className="sticky top-[calc(50vh-150px)] h-[350px] relative transition-opacity duration-300"
                style={{ opacity: showIllustration ? 1 : 0 }}
              >
                {/* Feature 1 Illustration: Smart Staking Hooks */}
                <div
                  className="absolute inset-0 transition-all duration-500"
                  style={{
                    opacity: activeFeature === 0 ? 1 : 0,
                    transform: activeFeature === 0 ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
                    pointerEvents: activeFeature === 0 ? 'auto' : 'none',
                  }}
                >
                  <div className="terminal-card p-6 max-w-md">
                    <div className="flex items-center gap-1.5 mb-6">
                      <div className="w-2 h-2 rounded-sm bg-gray-600" />
                      <div className="w-2 h-2 rounded-sm bg-gray-600" />
                    </div>
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
                    <div className="space-y-3">
                      <div className="h-3 bg-gray-800 rounded overflow-hidden">
                        <div
                          className="h-full w-4/5 rounded transition-all duration-1000"
                          style={{ background: 'linear-gradient(90deg, #ed7f2f, #8a3815)' }}
                        />
                      </div>
                      <div className="h-3 bg-gray-800 rounded overflow-hidden">
                        <div
                          className="h-full w-3/5 rounded transition-all duration-1000"
                          style={{ background: 'linear-gradient(90deg, #42c7e6, #0e4d9d)' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Feature 2 Illustration: Range Dominance Battles */}
                <div
                  className="absolute inset-0 transition-all duration-500"
                  style={{
                    opacity: activeFeature === 1 ? 1 : 0,
                    transform: activeFeature === 1 ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
                    pointerEvents: activeFeature === 1 ? 'auto' : 'none',
                  }}
                >
                  <div className="relative">
                    <div
                      className="absolute -top-4 right-8 w-16 h-16 rounded-full border-2"
                      style={{ borderColor: '#42c7e6', boxShadow: '0 0 20px rgba(66, 199, 230, 0.4)' }}
                    />
                    <div className="terminal-card p-6 max-w-md">
                      <div className="flex items-center gap-2 mb-6">
                        <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#ed7f2f' }} />
                        <span className="text-xs font-mono tracking-wider" style={{ color: '#ed7f2f' }}>LIVE BATTLE</span>
                      </div>
                      <div className="flex items-center justify-center gap-4">
                        <div
                          className="w-24 h-28 rounded border-2"
                          style={{
                            borderColor: 'rgba(237, 127, 47, 0.5)',
                            background: 'linear-gradient(180deg, #ed7f2f 0%, #8a3815 100%)',
                            boxShadow: '0 0 30px rgba(237, 127, 47, 0.4)'
                          }}
                        />
                        <span className="text-white/60 text-xl font-bold">VS</span>
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
                </div>

                {/* Feature 3 Illustration: Winner Takes All */}
                <div
                  className="absolute inset-0 transition-all duration-500"
                  style={{
                    opacity: activeFeature === 2 ? 1 : 0,
                    transform: activeFeature === 2 ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
                    pointerEvents: activeFeature === 2 ? 'auto' : 'none',
                  }}
                >
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-48 h-32 bg-accent-magenta/20 blur-[60px] rounded-full" />
                    </div>
                    <div className="terminal-card p-6 max-w-md relative">
                      <div className="flex items-center gap-1.5 mb-6">
                        <div className="w-2 h-2 rounded-sm bg-gray-600" />
                      </div>
                      <div className="flex items-center justify-center gap-4 py-4">
                        <div className="w-16 h-20 rounded border border-gray-700 bg-gray-900/80" />
                        <div
                          className="w-16 h-20 rounded border-2 border-accent-magenta"
                          style={{
                            background: 'linear-gradient(180deg, rgba(237, 127, 47, 0.3) 0%, rgba(138, 56, 21, 0.3) 100%)',
                            boxShadow: '0 0 30px rgba(237, 127, 47, 0.5), inset 0 0 20px rgba(237, 127, 47, 0.2)'
                          }}
                        />
                        <div className="w-16 h-20 rounded border border-gray-700 bg-gray-900/80" />
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Right Column - Scrolling Content */}
            <div>
              {/* Feature 1 Content */}
              <div ref={feature1Ref} className="pt-[calc(50vh-150px)] pb-24">
                <div className="feature-content-card p-8 rounded-lg border border-gray-700/50 w-full">
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

              {/* Feature 2 Content */}
              <div ref={feature2Ref} className="py-24">
                <div className="feature-content-card p-8 rounded-lg border border-gray-700/50 w-full">
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

              {/* Feature 3 Content */}
              <div ref={feature3Ref} className="py-24">
                <div className="feature-content-card p-8 rounded-lg border border-gray-700/50 w-full">
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
          </div>

          {/* Mobile Layout - Stacked (original layout) */}
          <div className="lg:hidden space-y-12">
            {/* Feature 1 */}
            <div className="space-y-6">
              <div className="terminal-card p-6 max-w-md mx-auto">
                <div className="flex items-center gap-1.5 mb-6">
                  <div className="w-2 h-2 rounded-sm bg-gray-600" />
                  <div className="w-2 h-2 rounded-sm bg-gray-600" />
                </div>
                <div className="flex justify-center mb-8">
                  <div className="relative w-28 h-28">
                    <div
                      className="absolute inset-0 rotate-45 border-2 border-white/80 rounded-lg"
                      style={{ boxShadow: '0 0 20px rgba(255, 255, 255, 0.3)' }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-white text-3xl font-bold">V4</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="h-3 bg-gray-800 rounded overflow-hidden">
                    <div className="h-full w-4/5 rounded" style={{ background: 'linear-gradient(90deg, #ed7f2f, #8a3815)' }} />
                  </div>
                  <div className="h-3 bg-gray-800 rounded overflow-hidden">
                    <div className="h-full w-3/5 rounded" style={{ background: 'linear-gradient(90deg, #42c7e6, #0e4d9d)' }} />
                  </div>
                </div>
              </div>
              <div className="feature-content-card p-6 rounded-lg border border-gray-700/50">
                <h3 className="text-xl font-black text-[#42c7e6] italic mb-4">SMART STAKING HOOKS</h3>
                <p className="text-gray-400 font-mono text-sm leading-relaxed">
                  Arena utilizes the power of Uniswap V4 Hooks to transform static liquidity into active weaponry.
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="space-y-6">
              <div className="terminal-card p-6 max-w-md mx-auto">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#ed7f2f' }} />
                  <span className="text-xs font-mono" style={{ color: '#ed7f2f' }}>LIVE BATTLE</span>
                </div>
                <div className="flex items-center justify-center gap-4">
                  <div className="w-20 h-24 rounded border-2" style={{ borderColor: 'rgba(237, 127, 47, 0.5)', background: 'linear-gradient(180deg, #ed7f2f, #8a3815)' }} />
                  <span className="text-white/60 font-bold">VS</span>
                  <div className="w-20 h-24 rounded border-2" style={{ borderColor: 'rgba(66, 199, 230, 0.5)', background: 'linear-gradient(180deg, #42c7e6, #0e4d9d)' }} />
                </div>
              </div>
              <div className="feature-content-card p-6 rounded-lg border border-gray-700/50">
                <h3 className="text-xl font-black text-[#42c7e6] italic mb-4">RANGE DOMINANCE BATTLES</h3>
                <p className="text-gray-400 font-mono text-sm leading-relaxed">
                  Liquidity provision is no longer passive. Compete against other providers to maintain the tightest range.
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="space-y-6">
              <div className="terminal-card p-6 max-w-md mx-auto">
                <div className="flex items-center gap-1.5 mb-6">
                  <div className="w-2 h-2 rounded-sm bg-gray-600" />
                </div>
                <div className="flex items-center justify-center gap-4 py-4">
                  <div className="w-14 h-18 rounded border border-gray-700 bg-gray-900/80" />
                  <div className="w-14 h-18 rounded border-2 border-accent-magenta" style={{ background: 'linear-gradient(180deg, rgba(237, 127, 47, 0.3), rgba(138, 56, 21, 0.3))' }} />
                  <div className="w-14 h-18 rounded border border-gray-700 bg-gray-900/80" />
                </div>
              </div>
              <div className="feature-content-card p-6 rounded-lg border border-gray-700/50">
                <h3 className="text-xl font-black text-[#42c7e6] italic mb-4">WINNER TAKES ALL</h3>
                <p className="text-gray-400 font-mono text-sm leading-relaxed">
                  High stakes, high reward. If your efficiency score exceeds your opponent's by 10%, you claim the accumulated pool fees.
                </p>
              </div>
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
