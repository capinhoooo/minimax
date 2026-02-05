/**
 * Arc/Circle CCTP Integration for LP BattleVault
 *
 * Enables cross-chain USDC bridging via Circle's CCTP (Cross-Chain Transfer Protocol)
 * Arc provides the infrastructure for chain-abstracted USDC transfers.
 */
import { type Address, type Hash } from 'viem';
export declare const CCTP_CONTRACTS: {
    readonly ETHEREUM: {
        readonly tokenMessenger: Address;
        readonly messageTransmitter: Address;
        readonly usdc: Address;
        readonly domain: 0;
    };
    readonly ARBITRUM: {
        readonly tokenMessenger: Address;
        readonly messageTransmitter: Address;
        readonly usdc: Address;
        readonly domain: 3;
    };
    readonly BASE: {
        readonly tokenMessenger: Address;
        readonly messageTransmitter: Address;
        readonly usdc: Address;
        readonly domain: 6;
    };
    readonly POLYGON: {
        readonly tokenMessenger: Address;
        readonly messageTransmitter: Address;
        readonly usdc: Address;
        readonly domain: 7;
    };
    readonly OPTIMISM: {
        readonly tokenMessenger: Address;
        readonly messageTransmitter: Address;
        readonly usdc: Address;
        readonly domain: 2;
    };
    readonly SEPOLIA: {
        readonly tokenMessenger: Address;
        readonly messageTransmitter: Address;
        readonly usdc: Address;
        readonly domain: 0;
    };
    readonly BASE_SEPOLIA: {
        readonly tokenMessenger: Address;
        readonly messageTransmitter: Address;
        readonly usdc: Address;
        readonly domain: 6;
    };
    readonly ARBITRUM_SEPOLIA: {
        readonly tokenMessenger: Address;
        readonly messageTransmitter: Address;
        readonly usdc: Address;
        readonly domain: 3;
    };
};
export type SupportedChain = keyof typeof CCTP_CONTRACTS;
export interface BridgeRequest {
    sourceChain: SupportedChain;
    destChain: SupportedChain;
    amount: bigint;
    recipient: Address;
}
export interface BridgeTransaction {
    sourceChain: SupportedChain;
    destChain: SupportedChain;
    amount: bigint;
    recipient: Address;
    burnTxHash?: Hash;
    nonce?: bigint;
    messageHash?: string;
    attestation?: string;
    mintTxHash?: Hash;
    status: 'pending_burn' | 'pending_attestation' | 'ready_to_mint' | 'completed' | 'failed';
}
export declare class ArcIntegration {
    private clients;
    private attestationServiceUrl;
    constructor();
    private initializeClients;
    /**
     * Get USDC balance on a specific chain
     */
    getUSDCBalance(chain: SupportedChain, address: Address): Promise<bigint>;
    /**
     * Prepare bridge transaction data (for frontend execution)
     * Step 1: Approve USDC spending
     */
    prepareApproveData(chain: SupportedChain, amount: bigint): {
        to: Address;
        data: `0x${string}`;
    };
    /**
     * Prepare depositForBurn transaction data
     * Step 2: Burn USDC on source chain
     */
    prepareDepositForBurnData(request: BridgeRequest): {
        to: Address;
        data: `0x${string}`;
    };
    /**
     * Get attestation from Circle's attestation service
     * This is called after the burn transaction is confirmed
     */
    getAttestation(messageHash: string): Promise<{
        attestation: string;
        status: string;
    } | null>;
    /**
     * Prepare receiveMessage transaction data
     * Step 3: Mint USDC on destination chain
     */
    prepareReceiveMessageData(destChain: SupportedChain, message: string, attestation: string): {
        to: Address;
        data: `0x${string}`;
    };
    /**
     * Get full bridge flow instructions
     */
    getBridgeInstructions(request: BridgeRequest): {
        steps: Array<{
            step: number;
            action: string;
            description: string;
            transaction?: {
                to: Address;
                data: `0x${string}`;
            };
        }>;
    };
    /**
     * Log a bridge action
     */
    logBridgeAction(action: string, request: BridgeRequest, status: string, txHash?: string): void;
    /**
     * Format USDC amount for display (6 decimals)
     */
    formatUSDC(amount: bigint): string;
    /**
     * Get supported chains
     */
    getSupportedChains(): SupportedChain[];
    /**
     * Get CCTP contract addresses for a chain
     */
    getContractAddresses(chain: SupportedChain): {
        readonly tokenMessenger: Address;
        readonly messageTransmitter: Address;
        readonly usdc: Address;
        readonly domain: 0;
    } | {
        readonly tokenMessenger: Address;
        readonly messageTransmitter: Address;
        readonly usdc: Address;
        readonly domain: 3;
    } | {
        readonly tokenMessenger: Address;
        readonly messageTransmitter: Address;
        readonly usdc: Address;
        readonly domain: 6;
    } | {
        readonly tokenMessenger: Address;
        readonly messageTransmitter: Address;
        readonly usdc: Address;
        readonly domain: 7;
    } | {
        readonly tokenMessenger: Address;
        readonly messageTransmitter: Address;
        readonly usdc: Address;
        readonly domain: 2;
    } | {
        readonly tokenMessenger: Address;
        readonly messageTransmitter: Address;
        readonly usdc: Address;
        readonly domain: 0;
    } | {
        readonly tokenMessenger: Address;
        readonly messageTransmitter: Address;
        readonly usdc: Address;
        readonly domain: 6;
    } | {
        readonly tokenMessenger: Address;
        readonly messageTransmitter: Address;
        readonly usdc: Address;
        readonly domain: 3;
    };
    /**
     * Print bridge flow summary
     */
    printBridgeFlowSummary(request: BridgeRequest): void;
}
export declare const arcIntegration: ArcIntegration;
