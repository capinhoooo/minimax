import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

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

// Get battle status color
export function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'open':
    case 'waiting_for_opponent':
      return 'text-accent-green';
    case 'ongoing':
    case 'active':
      return 'text-accent-blue';
    case 'ready_to_resolve':
      return 'text-accent-yellow';
    case 'resolved':
    case 'completed':
      return 'text-gray-400';
    default:
      return 'text-gray-400';
  }
}

// Get battle status badge class
export function getStatusBadgeClass(status: string): string {
  switch (status.toLowerCase()) {
    case 'open':
    case 'waiting_for_opponent':
      return 'status-open';
    case 'ongoing':
    case 'active':
      return 'status-ongoing';
    case 'ready_to_resolve':
      return 'status-ready';
    case 'resolved':
    case 'completed':
      return 'status-resolved';
    default:
      return 'status-resolved';
  }
}

// Format status for display
export function formatStatus(status: string): string {
  switch (status.toLowerCase()) {
    case 'waiting_for_opponent':
      return 'Open';
    case 'ready_to_resolve':
      return 'Ready';
    default:
      return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
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

// Get explorer URL
export function getExplorerUrl(hash: string, type: 'tx' | 'address' = 'tx', chainId = 11155111): string {
  const explorers: Record<number, string> = {
    1: 'https://etherscan.io',
    11155111: 'https://sepolia.etherscan.io',
    8453: 'https://basescan.org',
    42161: 'https://arbiscan.io',
    137: 'https://polygonscan.com',
    10: 'https://optimistic.etherscan.io',
  };

  const baseUrl = explorers[chainId] || explorers[11155111];
  return `${baseUrl}/${type}/${hash}`;
}
