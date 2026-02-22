import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { BattleStatus } from '../types';

// Merge Tailwind classes
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format address for display
export function formatAddress(address: string, chars = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

// Format USD value (8 decimals from contract)
export function formatUSD(value: bigint, decimals = 8): string {
  const num = Number(value) / Math.pow(10, decimals);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

// Format token amount
export function formatTokenAmount(value: bigint, decimals = 18, displayDecimals = 4): string {
  const num = Number(value) / Math.pow(10, decimals);
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: displayDecimals,
  });
}

// Format time remaining
export function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return 'Ended';

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

// Format duration for display
export function formatDuration(seconds: number): string {
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)} minutes`;
  } else if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)} hours`;
  } else {
    return `${Math.floor(seconds / 86400)} days`;
  }
}

// Get battle status color (numeric status)
export function getStatusColor(status: number): string {
  switch (status) {
    case BattleStatus.PENDING:
      return 'text-accent-green';
    case BattleStatus.ACTIVE:
      return 'text-accent-blue';
    case BattleStatus.EXPIRED:
      return 'text-accent-yellow';
    case BattleStatus.RESOLVED:
      return 'text-gray-400';
    default:
      return 'text-gray-400';
  }
}

// Get battle status badge class (numeric status)
export function getStatusBadgeClass(status: number): string {
  switch (status) {
    case BattleStatus.PENDING:
      return 'status-open';
    case BattleStatus.ACTIVE:
      return 'status-ongoing';
    case BattleStatus.EXPIRED:
      return 'status-ready';
    case BattleStatus.RESOLVED:
      return 'status-resolved';
    default:
      return 'status-resolved';
  }
}

// Format status for display (numeric status)
export function formatStatus(status: number): string {
  switch (status) {
    case BattleStatus.PENDING: return 'Open';
    case BattleStatus.ACTIVE: return 'Active';
    case BattleStatus.EXPIRED: return 'Expired';
    case BattleStatus.RESOLVED: return 'Resolved';
    default: return 'Unknown';
  }
}

// Calculate percentage
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

// Copy to clipboard
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Get explorer URL (default: Arbitrum Sepolia)
export function getExplorerUrl(hash: string, type: 'tx' | 'address' = 'tx', chainId = 421614): string {
  const explorers: Record<number, string> = {
    421614: 'https://sepolia.arbiscan.io',
    42161: 'https://arbiscan.io',
  };

  const baseUrl = explorers[chainId] || explorers[421614];
  return `${baseUrl}/${type}/${hash}`;
}
