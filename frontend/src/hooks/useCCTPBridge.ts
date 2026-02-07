import { useState, useCallback, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi';
import { parseUnits, pad, keccak256, type Address, type Hex } from 'viem';
import {
  type CctpChain,
  getCctpChain,
  CCTP_ATTESTATION_API,
  ERC20_ABI,
  TOKEN_MESSENGER_ABI,
  MESSAGE_TRANSMITTER_ABI,
} from '../lib/contracts';

export type BridgeStep = 'idle' | 'approving' | 'burning' | 'attesting' | 'minting' | 'completed' | 'error';

interface BridgeState {
  step: BridgeStep;
  error: string | null;
  approveTxHash: Hex | undefined;
  burnTxHash: Hex | undefined;
  mintTxHash: Hex | undefined;
  attestation: Hex | null;
  messageBytes: Hex | null;
  messageHash: Hex | null;
}

const initialState: BridgeState = {
  step: 'idle',
  error: null,
  approveTxHash: undefined,
  burnTxHash: undefined,
  mintTxHash: undefined,
  attestation: null,
  messageBytes: null,
  messageHash: null,
};

export function useCCTPBridge(sourceChain: CctpChain | undefined, destChain: CctpChain | undefined) {
  const { address, chain } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const [state, setState] = useState<BridgeState>(initialState);
  const [amount, setAmount] = useState('');

  const amountBigInt = amount ? parseUnits(amount, 6) : 0n;

  // Read USDC balance on source chain
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: sourceChain?.usdc,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: sourceChain?.chainId,
    query: { enabled: !!address && !!sourceChain },
  });

  // Read allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: sourceChain?.usdc,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && sourceChain ? [address, sourceChain.tokenMessenger] : undefined,
    chainId: sourceChain?.chainId,
    query: { enabled: !!address && !!sourceChain },
  });

  const needsApproval = amountBigInt > 0n && (allowance as bigint ?? 0n) < amountBigInt;

  // Write contracts
  const { writeContractAsync: approveAsync, data: approveTxHash, isPending: isApproving } = useWriteContract();
  const { writeContractAsync: burnAsync, data: burnTxHash, isPending: isBurning } = useWriteContract();
  const { writeContractAsync: receiveAsync, data: mintTxHash, isPending: isMinting } = useWriteContract();

  // Wait for approve tx
  const { isSuccess: approveConfirmed } = useWaitForTransactionReceipt({
    hash: state.approveTxHash,
    chainId: sourceChain?.chainId,
  });

  // Wait for burn tx
  const { data: burnReceipt, isSuccess: burnConfirmed } = useWaitForTransactionReceipt({
    hash: state.burnTxHash,
    chainId: sourceChain?.chainId,
  });

  // Wait for mint tx
  const { isSuccess: mintConfirmed } = useWaitForTransactionReceipt({
    hash: state.mintTxHash,
    chainId: destChain?.chainId,
  });

  // After approve confirmed, move to burning step
  useEffect(() => {
    if (approveConfirmed && state.step === 'approving') {
      refetchAllowance();
      setState((s) => ({ ...s, step: 'idle' }));
    }
  }, [approveConfirmed, state.step, refetchAllowance]);

  // After burn confirmed, extract messageBytes and start attestation polling
  useEffect(() => {
    if (burnConfirmed && burnReceipt && state.step === 'burning') {
      // Find MessageSent event log
      // MessageSent event topic: keccak256("MessageSent(bytes)")
      const messageSentTopic = keccak256(
        new TextEncoder().encode('MessageSent(bytes)') as unknown as Hex
      );

      const messageSentLog = burnReceipt.logs.find(
        (log) => log.topics[0]?.toLowerCase() === messageSentTopic.toLowerCase()
      );

      if (messageSentLog) {
        // The message bytes are in the log data (ABI encoded)
        // Skip first 64 bytes (offset + length), rest is the message
        const rawData = messageSentLog.data;
        // ABI decode: first 32 bytes = offset, next 32 bytes = length, rest = message bytes
        const offsetHex = rawData.slice(2, 66);
        const lengthHex = rawData.slice(66, 130);
        const offset = parseInt(offsetHex, 16);
        const length = parseInt(lengthHex, 16);
        // Message starts after offset pointer + length prefix (both 32 bytes)
        const messageStart = 2 + (offset + 32) * 2;
        const messageEnd = messageStart + length * 2;
        const messageHex = ('0x' + rawData.slice(messageStart, messageEnd)) as Hex;
        const msgHash = keccak256(messageHex);

        setState((s) => ({
          ...s,
          step: 'attesting',
          messageBytes: messageHex,
          messageHash: msgHash,
        }));
      } else {
        setState((s) => ({ ...s, step: 'error', error: 'Could not find MessageSent event in burn transaction' }));
      }
    }
  }, [burnConfirmed, burnReceipt, state.step]);

  // Poll attestation API
  useEffect(() => {
    if (state.step !== 'attesting' || !state.messageHash) return;

    let cancelled = false;
    const poll = async () => {
      while (!cancelled) {
        try {
          const res = await fetch(`${CCTP_ATTESTATION_API}/${state.messageHash}`);
          const data = await res.json();
          if (data.status === 'complete' && data.attestation) {
            if (!cancelled) {
              setState((s) => ({ ...s, attestation: data.attestation as Hex }));
            }
            return;
          }
        } catch {
          // ignore fetch errors, keep polling
        }
        await new Promise((r) => setTimeout(r, 5000));
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [state.step, state.messageHash]);

  // Once attestation is received, auto-receive on destination
  useEffect(() => {
    if (state.attestation && state.messageBytes && state.step === 'attesting' && destChain) {
      const doReceive = async () => {
        try {
          // Switch to destination chain if needed
          if (chain?.id !== destChain.chainId) {
            await switchChainAsync({ chainId: destChain.chainId });
          }
          setState((s) => ({ ...s, step: 'minting' }));
          const hash = await receiveAsync({
            address: destChain.messageTransmitter,
            abi: MESSAGE_TRANSMITTER_ABI,
            functionName: 'receiveMessage',
            args: [state.messageBytes!, state.attestation!],
            chainId: destChain.chainId,
          });
          setState((s) => ({ ...s, mintTxHash: hash }));
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Failed to receive message';
          // If already received (nonce used), treat as success
          if (msg.includes('Nonce already used')) {
            setState((s) => ({ ...s, step: 'completed' }));
          } else {
            setState((s) => ({ ...s, step: 'error', error: msg }));
          }
        }
      };
      doReceive();
    }
  }, [state.attestation, state.messageBytes, state.step, destChain, chain?.id, switchChainAsync, receiveAsync]);

  // After mint confirmed
  useEffect(() => {
    if (mintConfirmed && state.step === 'minting') {
      setState((s) => ({ ...s, step: 'completed' }));
      refetchBalance();
    }
  }, [mintConfirmed, state.step, refetchBalance]);

  // Approve USDC
  const approve = useCallback(async () => {
    if (!sourceChain || !address) return;
    try {
      // Switch to source chain if needed
      if (chain?.id !== sourceChain.chainId) {
        await switchChainAsync({ chainId: sourceChain.chainId });
      }
      setState((s) => ({ ...s, step: 'approving', error: null }));
      const hash = await approveAsync({
        address: sourceChain.usdc,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [sourceChain.tokenMessenger, amountBigInt],
        chainId: sourceChain.chainId,
      });
      setState((s) => ({ ...s, approveTxHash: hash }));
    } catch (err: unknown) {
      setState((s) => ({
        ...s,
        step: 'error',
        error: err instanceof Error ? err.message : 'Approval failed',
      }));
    }
  }, [sourceChain, address, chain?.id, switchChainAsync, approveAsync, amountBigInt]);

  // Burn USDC (depositForBurn)
  const burn = useCallback(async () => {
    if (!sourceChain || !destChain || !address) return;
    try {
      // Switch to source chain if needed
      if (chain?.id !== sourceChain.chainId) {
        await switchChainAsync({ chainId: sourceChain.chainId });
      }
      setState((s) => ({ ...s, step: 'burning', error: null }));
      // Encode recipient address as bytes32 (left-padded)
      const mintRecipient = pad(address, { size: 32 });
      const hash = await burnAsync({
        address: sourceChain.tokenMessenger,
        abi: TOKEN_MESSENGER_ABI,
        functionName: 'depositForBurn',
        args: [amountBigInt, destChain.domain, mintRecipient, sourceChain.usdc],
        chainId: sourceChain.chainId,
      });
      setState((s) => ({ ...s, burnTxHash: hash }));
    } catch (err: unknown) {
      setState((s) => ({
        ...s,
        step: 'error',
        error: err instanceof Error ? err.message : 'Burn failed',
      }));
    }
  }, [sourceChain, destChain, address, chain?.id, switchChainAsync, burnAsync, amountBigInt]);

  const reset = useCallback(() => {
    setState(initialState);
    setAmount('');
  }, []);

  const isOnSourceChain = chain?.id === sourceChain?.chainId;

  return {
    // State
    step: state.step,
    error: state.error,
    approveTxHash: state.approveTxHash,
    burnTxHash: state.burnTxHash,
    mintTxHash: state.mintTxHash,
    // Data
    balance: balance as bigint | undefined,
    allowance: allowance as bigint | undefined,
    needsApproval,
    amount,
    setAmount,
    isOnSourceChain,
    // Actions
    approve,
    burn,
    reset,
    // Loading states
    isApproving: isApproving || state.step === 'approving',
    isBurning: isBurning || state.step === 'burning',
    isAttesting: state.step === 'attesting',
    isMinting: isMinting || state.step === 'minting',
    isCompleted: state.step === 'completed',
    refetchBalance,
  };
}
