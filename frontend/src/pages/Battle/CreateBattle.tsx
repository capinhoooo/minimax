import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Swords, Zap, Clock, AlertCircle } from 'lucide-react';
import { useAccount } from 'wagmi';
import { DURATION_OPTIONS } from '../../types';

export default function CreateBattle() {
  const { isConnected } = useAccount();
  const [battleType, setBattleType] = useState<'range' | 'fee'>('range');
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [duration, setDuration] = useState(86400);

  // Mock positions - will be replaced with actual position data
  const positions = [
    { id: '42', pool: 'WETH/USDC', value: '$2,450', inRange: true },
    { id: '38', pool: 'WETH/USDC', value: '$1,800', inRange: true },
    { id: '35', pool: 'ARB/ETH', value: '$950', inRange: false },
  ];

  if (!isConnected) {
    return (
      <div className="py-8 px-4">
        <div className="mx-auto max-w-2xl text-center">
          <AlertCircle className="h-16 w-16 text-accent-yellow mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Connect Wallet</h1>
          <p className="text-gray-400 mb-6">Please connect your wallet to create a battle.</p>
          <Link to="/battle" className="btn-secondary">
            Back to Arena
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 px-4">
      <div className="mx-auto max-w-2xl">
        {/* Back Link */}
        <Link to="/battle" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to Arena
        </Link>

        <h1 className="text-3xl font-bold mb-8">Create Battle</h1>

        {/* Step 1: Battle Type */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-4">Step 1: Select Battle Type</h2>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setBattleType('range')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                battleType === 'range'
                  ? 'border-accent-blue bg-accent-blue/10'
                  : 'border-border hover:border-gray-600'
              }`}
            >
              <Zap className={`h-8 w-8 mb-2 ${battleType === 'range' ? 'text-accent-blue' : 'text-gray-400'}`} />
              <h3 className="font-semibold mb-1">Range Battle</h3>
              <p className="text-sm text-gray-400">Win by staying in-range longer</p>
            </button>

            <button
              onClick={() => setBattleType('fee')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                battleType === 'fee'
                  ? 'border-accent-purple bg-accent-purple/10'
                  : 'border-border hover:border-gray-600'
              }`}
            >
              <Swords className={`h-8 w-8 mb-2 ${battleType === 'fee' ? 'text-accent-purple' : 'text-gray-400'}`} />
              <h3 className="font-semibold mb-1">Fee Battle</h3>
              <p className="text-sm text-gray-400">Win by earning more fees</p>
            </button>
          </div>
        </div>

        {/* Step 2: Select Position */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-4">Step 2: Select Your LP Position</h2>
          <div className="space-y-3">
            {positions.map((pos) => (
              <button
                key={pos.id}
                onClick={() => setSelectedPosition(pos.id)}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                  selectedPosition === pos.id
                    ? 'border-accent-blue bg-accent-blue/10'
                    : 'border-border hover:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">Position #{pos.id}</p>
                    <p className="text-sm text-gray-400">{pos.pool}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{pos.value}</p>
                    <p className={`text-sm ${pos.inRange ? 'text-accent-green' : 'text-accent-red'}`}>
                      {pos.inRange ? 'In Range' : 'Out of Range'}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <p className="text-sm text-gray-400 mt-4">
            Don't have a position?{' '}
            <Link to="/swap" className="text-accent-blue hover:underline">
              Add liquidity first
            </Link>
          </p>
        </div>

        {/* Step 3: Duration */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-4">Step 3: Set Battle Duration</h2>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-gray-400" />
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="input flex-1"
            >
              {DURATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Summary */}
        <div className="card mb-6 bg-background-tertiary">
          <h2 className="text-lg font-semibold mb-4">Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Battle Type</span>
              <span className="font-medium capitalize">{battleType} Battle</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Position</span>
              <span className="font-medium">#{selectedPosition || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Duration</span>
              <span className="font-medium">
                {DURATION_OPTIONS.find((o) => o.value === duration)?.label}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Opponent Match Range</span>
              <span className="font-medium">±10% value</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            disabled={!selectedPosition}
            className="btn-secondary flex-1"
          >
            Approve Position
          </button>
          <button
            disabled={!selectedPosition}
            className="btn-primary flex-1"
          >
            Create Battle
          </button>
        </div>
      </div>
    </div>
  );
}
