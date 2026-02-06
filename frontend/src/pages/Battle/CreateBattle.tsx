import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';

const poolOptions = [
  { label: 'ETH / USDC (0.05%)', token0: 'ETH', token1: 'USDC', tier: '0.05%' },
  { label: 'WBTC / ETH (0.3%)', token0: 'WBTC', token1: 'ETH', tier: '0.3%' },
  { label: 'DAI / USDC (0.01%)', token0: 'DAI', token1: 'USDC', tier: '0.01%' },
  { label: 'PEPE / ETH (1.0%)', token0: 'PEPE', token1: 'ETH', tier: '1.0%' },
];

const durationOptions = [
  { label: '1 HOUR', value: 3600 },
  { label: '24 HOURS', value: 86400 },
  { label: '7 DAYS', value: 604800 },
  { label: 'ENDLESS', value: 0 },
];

export default function CreateBattle() {
  const [selectedPool, setSelectedPool] = useState(0);
  const [stakeAmount, setStakeAmount] = useState('');
  const [minTick, setMinTick] = useState(195400);
  const [maxTick, setMaxTick] = useState(210200);
  const [duration, setDuration] = useState(86400);
  const [entryFee, setEntryFee] = useState('0.01');

  const pool = poolOptions[selectedPool];

  const concentration = useMemo(() => {
    const range = maxTick - minTick;
    if (range <= 0) return 1;
    return Math.max(1, (50000 / range)).toFixed(1);
  }, [minTick, maxTick]);

  const estimatedApy = useMemo(() => {
    const base = 42.8;
    const conc = parseFloat(concentration);
    return (base * (conc / 3)).toFixed(1);
  }, [concentration]);

  return (
    <div className="min-h-screen grid-bg">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Title */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black mb-3 tracking-tight">
          <span className="gradient-text-magenta italic">INITIALIZE BATTLE</span>
        </h1>
        <p className="text-xs sm:text-sm tracking-[0.2em] text-gray-500 mb-12 uppercase font-mono">
          Configure your position parameters and challenge the market
        </p>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Form */}
          <div
            className="rounded-xl overflow-hidden"
            style={{
              border: '1px solid rgba(237, 127, 47, 0.3)',
              boxShadow: '0 0 30px rgba(237, 127, 47, 0.1)',
            }}
          >
            {/* Purple Header Bar */}
            <div
              className="flex items-center gap-2 px-4 py-2"
              style={{
                background: 'linear-gradient(90deg, #c026d3, #a855f7, #c026d3)',
              }}
            >
              <div className="w-2.5 h-2.5 rounded-sm bg-white/30" />
              <span className="text-xs font-mono font-bold tracking-wider text-white">
                PARAM_INIT_SEQUENCE_V4.02
              </span>
            </div>

            <div
              className="p-6 space-y-6"
              style={{ background: 'rgba(5, 5, 5, 0.95)' }}
            >
              {/* Arena Pool Selection */}
              <div>
                <label className="block text-xs font-mono font-bold tracking-wider mb-2" style={{ color: '#42c7e6' }}>
                  ARENA POOL SELECTION
                </label>
                <div className="relative">
                  <select
                    value={selectedPool}
                    onChange={(e) => setSelectedPool(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-lg text-sm font-mono text-gray-300 appearance-none cursor-pointer outline-none"
                    style={{
                      background: 'rgba(15, 15, 15, 0.9)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                    }}
                  >
                    {poolOptions.map((p, i) => (
                      <option key={i} value={i}>{p.label}</option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
                      <path d="M1 1L6 6L11 1" stroke="#ed7f2f" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Stake Amount */}
              <div>
                <label className="block text-xs font-mono font-bold tracking-wider mb-2" style={{ color: '#42c7e6' }}>
                  STAKE AMOUNT (LIQUIDITY)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 rounded-lg text-sm font-mono text-gray-300 outline-none placeholder-gray-600"
                    style={{
                      background: 'rgba(15, 15, 15, 0.9)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                    }}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-gray-400">
                    {pool.token0}
                  </span>
                </div>
              </div>

              {/* Battle Range (Ticks) */}
              <div>
                <label className="block text-xs font-mono font-bold tracking-wider mb-2" style={{ color: '#42c7e6' }}>
                  BATTLE RANGE (TICKS)
                </label>
                <div
                  className="rounded-lg p-4 space-y-4"
                  style={{
                    border: '1px dashed rgba(255, 255, 255, 0.15)',
                    background: 'rgba(10, 10, 10, 0.5)',
                  }}
                >
                  {/* Min/Max Labels */}
                  <div className="flex justify-between">
                    <span className="text-xs font-mono text-gray-500">
                      MIN: {minTick.toLocaleString()}
                    </span>
                    <span className="text-xs font-mono text-gray-500">
                      MAX: {maxTick.toLocaleString()}
                    </span>
                  </div>

                  {/* Min Tick Slider */}
                  <input
                    type="range"
                    min={180000}
                    max={220000}
                    value={minTick}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (val < maxTick) setMinTick(val);
                    }}
                    className="w-full accent-cyan-400"
                    style={{ accentColor: '#42c7e6' }}
                  />

                  {/* Max Tick Slider */}
                  <input
                    type="range"
                    min={180000}
                    max={220000}
                    value={maxTick}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (val > minTick) setMaxTick(val);
                    }}
                    className="w-full"
                    style={{ accentColor: '#42c7e6' }}
                  />

                  {/* Concentration */}
                  <p className="text-center text-xs font-mono tracking-wider text-gray-400">
                    CONCENTRATION: <span style={{ color: '#42c7e6' }}>{concentration}x</span>
                  </p>
                </div>
              </div>

              {/* Battle Duration */}
              <div>
                <label className="block text-xs font-mono font-bold tracking-wider mb-2" style={{ color: '#42c7e6' }}>
                  BATTLE DURATION
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {durationOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setDuration(opt.value)}
                      className="px-3 py-2.5 rounded-lg text-xs font-mono font-bold tracking-wider transition-all"
                      style={{
                        background: duration === opt.value
                          ? 'rgba(66, 199, 230, 0.15)'
                          : 'rgba(15, 15, 15, 0.9)',
                        border: duration === opt.value
                          ? '1px solid rgba(66, 199, 230, 0.5)'
                          : '1px solid rgba(255, 255, 255, 0.1)',
                        color: duration === opt.value ? '#42c7e6' : '#6b7280',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Arena Entry Fee */}
              <div>
                <label className="block text-xs font-mono font-bold tracking-wider mb-2" style={{ color: '#42c7e6' }}>
                  ARENA ENTRY FEE (BURN)
                </label>
                <input
                  type="number"
                  value={entryFee}
                  onChange={(e) => setEntryFee(e.target.value)}
                  placeholder="0.01"
                  className="w-full px-4 py-3 rounded-lg text-sm font-mono text-gray-300 outline-none placeholder-gray-600"
                  style={{
                    background: 'rgba(15, 15, 15, 0.9)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Right Column - Preview */}
          <div className="space-y-6">
            <p className="text-center text-sm font-mono text-gray-500 tracking-wider">
              Real-time Deployment Preview
            </p>

            {/* Preview Card */}
            <div
              className="rounded-xl overflow-hidden relative"
              style={{
                border: '1px solid rgba(237, 127, 47, 0.3)',
                boxShadow: '0 0 30px rgba(237, 127, 47, 0.1)',
                background: 'rgba(5, 5, 5, 0.95)',
              }}
            >
              {/* Corner Badge */}
              <div
                className="absolute top-0 right-0 overflow-hidden w-24 h-24 pointer-events-none"
              >
                <div
                  className="absolute top-3 -right-6 rotate-45 text-[9px] font-mono font-bold tracking-wider py-1 px-8 text-center"
                  style={{
                    background: 'linear-gradient(90deg, #c026d3, #a855f7)',
                    color: 'white',
                  }}
                >
                  BATTLE_MODE
                </div>
              </div>

              <div className="p-6">
                {/* Pool Name */}
                <h3 className="text-xl font-black text-center mb-1 tracking-wide" style={{ color: '#42c7e6' }}>
                  {pool.token0}/{pool.token1} ARENA
                </h3>
                <div className="w-12 h-0.5 mx-auto mb-6" style={{ background: '#42c7e6' }} />

                {/* Stake & APY */}
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-[10px] font-mono tracking-wider text-gray-500 mb-1">YOUR STAKE</p>
                    <p className="text-lg font-black" style={{ color: '#42c7e6' }}>
                      {stakeAmount || '0.00'} {pool.token0}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-mono tracking-wider text-gray-500 mb-1">EST. APY</p>
                    <p className="text-lg font-black" style={{ color: '#22c55e' }}>
                      {estimatedApy}%
                    </p>
                  </div>
                </div>

                {/* Tick Range Box */}
                <div
                  className="rounded-lg p-4 mb-6"
                  style={{
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    background: 'rgba(10, 10, 10, 0.8)',
                  }}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-mono text-gray-500 tracking-wider">TICK_RANGE_L:</span>
                    <span className="text-sm font-mono text-white">{minTick.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-mono text-gray-500 tracking-wider">TICK_RANGE_H:</span>
                    <span className="text-sm font-mono text-white">{maxTick.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Protocol Fee & Slippage */}
            <div className="grid grid-cols-2 gap-4">
              <div
                className="rounded-lg p-4 text-center"
                style={{
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(5, 5, 5, 0.95)',
                }}
              >
                <p className="text-[10px] font-mono tracking-wider text-gray-500 mb-1">PROTOCOL FEE</p>
                <p className="text-lg font-black text-white">{entryFee || '0.01'} ETH</p>
              </div>
              <div
                className="rounded-lg p-4 text-center"
                style={{
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(5, 5, 5, 0.95)',
                }}
              >
                <p className="text-[10px] font-mono tracking-wider text-gray-500 mb-1">SLIPPAGE TOLERANCE</p>
                <p className="text-lg font-black text-white">0.5%</p>
              </div>
            </div>

            {/* Enter Arena Button */}
            <button
              className="w-full py-4 rounded-lg text-center font-black text-lg tracking-widest transition-all hover:opacity-90"
              style={{
                background: 'transparent',
                border: '2px solid rgba(237, 127, 47, 0.6)',
                color: '#ed7f2f',
                boxShadow: '0 0 20px rgba(237, 127, 47, 0.15)',
              }}
            >
              ENTER ARENA
            </button>

            {/* Warning */}
            <p className="text-center text-[10px] font-mono tracking-wider text-gray-600 leading-relaxed">
              WARNING: HIGH VOLATILITY COMBAT ZONE. ENSURE SUFFICIENT GAS FOR HOOK EXECUTION.
            </p>
          </div>
        </div>

        {/* Terminal Status Footer */}
        <div className="mt-16 text-center">
          <p className="text-xs font-mono text-gray-600 tracking-wider">
            TERMINAL STATUS: <span style={{ color: '#22c55e' }}>ONLINE</span> // BLOCK: 18492031 // BATTLE_INIT_V4
          </p>
        </div>
      </div>
    </div>
  );
}
