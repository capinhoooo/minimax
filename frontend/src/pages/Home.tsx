import { Link } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import uniswapSvg from '../assets/uniswap.svg';
import priceSvg from '../assets/price.svg';
import feesSvg from '../assets/fees.svg';

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
                    Add Liquidity &gt;
                  </Link>
                  <Link
                    to="/battle"
                    className="flex-1 btn-glow-magenta text-center py-3 text-sm"
                  >
                    Find Battle &gt;
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
                  className="absolute inset-0 transition-all duration-500 flex items-center justify-center"
                  style={{
                    opacity: activeFeature === 0 ? 1 : 0,
                    transform: activeFeature === 0 ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
                    pointerEvents: activeFeature === 0 ? 'auto' : 'none',
                  }}
                >
                  <img src={uniswapSvg} alt="Uniswap V4 Hooks" className="max-h-[300px] w-auto" />
                </div>

                {/* Feature 2 Illustration: Range Dominance Battles */}
                <div
                  className="absolute inset-0 transition-all duration-500 flex items-center justify-center"
                  style={{
                    opacity: activeFeature === 1 ? 1 : 0,
                    transform: activeFeature === 1 ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
                    pointerEvents: activeFeature === 1 ? 'auto' : 'none',
                  }}
                >
                  <img src={priceSvg} alt="Range Dominance Battles" className="max-h-[300px] w-auto" />
                </div>

                {/* Feature 3 Illustration: Winner Takes All */}
                <div
                  className="absolute inset-0 transition-all duration-500 flex items-center justify-center"
                  style={{
                    opacity: activeFeature === 2 ? 1 : 0,
                    transform: activeFeature === 2 ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
                    pointerEvents: activeFeature === 2 ? 'auto' : 'none',
                  }}
                >
                  <img src={feesSvg} alt="Winner Takes All" className="max-h-[300px] w-auto" />
                </div>

              </div>
            </div>

            {/* Right Column - Scrolling Content */}
            <div>
              {/* Feature 1 Content */}
              <div ref={feature1Ref} className="">
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
              <div ref={feature3Ref}>
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
              <div className="flex justify-center">
                <img src={uniswapSvg} alt="Uniswap V4 Hooks" className="max-h-[200px] w-auto" />
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
              <div className="flex justify-center">
                <img src={priceSvg} alt="Range Dominance Battles" className="max-h-[200px] w-auto" />
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
              <div className="flex justify-center">
                <img src={feesSvg} alt="Winner Takes All" className="max-h-[200px] w-auto" />
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
      <section className="py-24 px-4 relative">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-accent-magenta/5 blur-[120px] rounded-full" />
        </div>

        <div className="relative mx-auto max-w-5xl">
          {/* Main CTA Card */}
          <div
            className="rounded-xl overflow-hidden"
            style={{
              border: '1px solid rgba(237, 127, 47, 0.3)',
              boxShadow: '0 0 60px rgba(237, 127, 47, 0.08)',
              background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.95), rgba(1, 1, 1, 0.98))',
            }}
          >
            {/* Terminal Header Bar */}
            <div
              className="flex items-center justify-between px-5 py-3"
              style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}
            >
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
              </div>
              <span className="text-[10px] font-mono tracking-widest text-gray-600">ARENA_PROTOCOL_V4 // MAINNET</span>
            </div>

            <div className="p-8 sm:p-12">
              {/* Title */}
              <div className="text-center mb-10">
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4 tracking-tight">
                  <span className="gradient-text-magenta italic">ENTER THE ARENA</span>
                </h2>
                <p className="text-xs sm:text-sm tracking-[0.3em] text-gray-500 uppercase font-mono">
                  Deploy your liquidity. Challenge opponents. Claim victory.
                </p>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-10">
                {[
                  { label: 'TOTAL BATTLES', value: '1,247', color: '#ed7f2f' },
                  { label: 'ACTIVE ARENAS', value: '89', color: '#22c55e' },
                  { label: 'TVL LOCKED', value: '$2.4M', color: '#42c7e6' },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-lg p-4 text-center"
                    style={{
                      background: 'rgba(15, 15, 15, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <p className="text-xl sm:text-2xl font-black font-mono" style={{ color: stat.color }}>
                      {stat.value}
                    </p>
                    <p className="text-[9px] font-mono tracking-widest text-gray-600 mt-1">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 max-w-lg mx-auto">
                <Link
                  to="/battle"
                  className="flex-1 py-4 rounded-lg text-center font-black text-sm tracking-widest transition-all hover:opacity-90"
                  style={{
                    background: 'linear-gradient(135deg, rgba(237, 127, 47, 0.2), rgba(138, 56, 21, 0.2))',
                    border: '2px solid rgba(237, 127, 47, 0.6)',
                    color: '#ed7f2f',
                    boxShadow: '0 0 25px rgba(237, 127, 47, 0.15)',
                  }}
                >
                  START BATTLE
                </Link>
                <Link
                  to="/lobby"
                  className="flex-1 py-4 rounded-lg text-center font-black text-sm tracking-widest transition-all hover:opacity-90"
                  style={{
                    background: 'rgba(15, 15, 15, 0.8)',
                    border: '2px solid rgba(66, 199, 230, 0.4)',
                    color: '#42c7e6',
                    boxShadow: '0 0 25px rgba(66, 199, 230, 0.1)',
                  }}
                >
                  VIEW LOBBY
                </Link>
              </div>

              {/* Bottom Terminal Line */}
              <div className="mt-10 text-center">
                <p className="text-[10px] font-mono text-gray-600 tracking-wider">
                  STATUS: <span style={{ color: '#22c55e' }}>ONLINE</span> // CHAIN: ETHEREUM // PROTOCOL: UNISWAP V4 // BUILD: STABLE
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
