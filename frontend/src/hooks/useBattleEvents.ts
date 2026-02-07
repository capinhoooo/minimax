import { useState, useEffect, useCallback } from 'react';
import { usePublicClient } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { type Log } from 'viem';
import { RANGE_VAULT_ABI, FEE_VAULT_ABI, getVaultAddress } from '../lib/contracts';
import { formatAddress } from '../lib/utils';
import type { VaultType } from '../types';

export interface BattleEvent {
  timestamp: number;
  blockNumber: bigint;
  txHash: string;
  eventName: string;
  message: string;
  type: 'system' | 'creator' | 'opponent' | 'info';
}

function getAbi(vaultType: VaultType) {
  return vaultType === 'range' ? RANGE_VAULT_ABI : FEE_VAULT_ABI;
}

// Lookback ~50k blocks (~7 days on Sepolia at ~12s/block)
const BLOCK_LOOKBACK = 50000n;

export function useBattleEvents(battleId: bigint | undefined, vaultType: VaultType) {
  const client = usePublicClient({ chainId: sepolia.id });
  const [events, setEvents] = useState<BattleEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchEvents = useCallback(async () => {
    if (!client || battleId === undefined) return;

    setIsLoading(true);
    try {
      const address = getVaultAddress(vaultType);
      const abi = getAbi(vaultType);

      // Get current block and calculate a safe lookback range
      const currentBlock = await client.getBlockNumber();
      const fromBlock = currentBlock > BLOCK_LOOKBACK ? currentBlock - BLOCK_LOOKBACK : 0n;

      // Fetch all three event types for this battleId
      const [createdLogs, joinedLogs, resolvedLogs] = await Promise.all([
        client.getContractEvents({
          address,
          abi,
          eventName: 'BattleCreated',
          args: { battleId },
          fromBlock,
        }).catch((e) => { console.warn('BattleCreated fetch failed:', e); return [] as Log[]; }),
        client.getContractEvents({
          address,
          abi,
          eventName: 'BattleJoined',
          args: { battleId },
          fromBlock,
        }).catch((e) => { console.warn('BattleJoined fetch failed:', e); return [] as Log[]; }),
        client.getContractEvents({
          address,
          abi,
          eventName: 'BattleResolved',
          args: { battleId },
          fromBlock,
        }).catch((e) => { console.warn('BattleResolved fetch failed:', e); return [] as Log[]; }),
      ]);

      // Collect unique block numbers
      const allLogs = [...createdLogs, ...joinedLogs, ...resolvedLogs];
      const blockNumbers = [...new Set(allLogs.map((l) => l.blockNumber!))];

      // Fetch block timestamps
      const blocks = await Promise.all(
        blockNumbers.map((bn) => client.getBlock({ blockNumber: bn }))
      );
      const blockTimestamps = new Map<bigint, number>();
      for (const block of blocks) {
        blockTimestamps.set(block.number, Number(block.timestamp));
      }

      const parsedEvents: BattleEvent[] = [];

      // Parse BattleCreated
      for (const log of createdLogs) {
        const args = (log as any).args;
        const ts = blockTimestamps.get(log.blockNumber!) || 0;
        parsedEvents.push({
          timestamp: ts,
          blockNumber: log.blockNumber!,
          txHash: log.transactionHash!,
          eventName: 'BattleCreated',
          message: `Battle created by ${formatAddress(args.creator, 6)} with position #${args.tokenId?.toString()}`,
          type: 'system',
        });
      }

      // Parse BattleJoined
      for (const log of joinedLogs) {
        const args = (log as any).args;
        const ts = blockTimestamps.get(log.blockNumber!) || 0;
        parsedEvents.push({
          timestamp: ts,
          blockNumber: log.blockNumber!,
          txHash: log.transactionHash!,
          eventName: 'BattleJoined',
          message: `${formatAddress(args.opponent, 6)} joined with position #${args.tokenId?.toString()}`,
          type: 'opponent',
        });
      }

      // Parse BattleResolved
      for (const log of resolvedLogs) {
        const args = (log as any).args;
        const ts = blockTimestamps.get(log.blockNumber!) || 0;
        parsedEvents.push({
          timestamp: ts,
          blockNumber: log.blockNumber!,
          txHash: log.transactionHash!,
          eventName: 'BattleResolved',
          message: `Battle resolved — winner: ${formatAddress(args.winner, 6)}`,
          type: 'system',
        });
      }

      // Sort by timestamp ascending
      parsedEvents.sort((a, b) => a.timestamp - b.timestamp);
      setEvents(parsedEvents);
    } catch (err) {
      console.error('Failed to fetch battle events:', err);
    } finally {
      setIsLoading(false);
    }
  }, [client, battleId, vaultType]);

  // Initial fetch
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Auto-refetch every 30s
  useEffect(() => {
    const interval = setInterval(fetchEvents, 30000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  return { events, isLoading, refetch: fetchEvents };
}
