/**
 * Arc/Circle CCTP Integration for LP BattleVault
 *
 * Enables cross-chain USDC bridging via Circle's CCTP (Cross-Chain Transfer Protocol)
 * Arc provides the infrastructure for chain-abstracted USDC transfers.
 */
import { createPublicClient, http, encodeFunctionData, } from 'viem';
import { mainnet, arbitrum, optimism, base, polygon, sepolia } from 'viem/chains';
import { logger } from '../utils/logger.js';
// Circle CCTP Contract Addresses
// Reference: https://developers.circle.com/stablecoins/docs/evm-smart-contracts
export const CCTP_CONTRACTS = {
    // Mainnet
    ETHEREUM: {
        tokenMessenger: '0xBd3fa81B58Ba92a82136038B25aDec7066af3155',
        messageTransmitter: '0x0a992d191DEeC32aFe36203Ad87D7d289a738F81',
        usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        domain: 0,
    },
    ARBITRUM: {
        tokenMessenger: '0x19330d10D9Cc8751218eaf51E8885D058642E08A',
        messageTransmitter: '0xC30362313FBBA5cf9163F0bb16a0e01f01A896ca',
        usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        domain: 3,
    },
    BASE: {
        tokenMessenger: '0x1682Ae6375C4E4A97e4B583BC394c861A46D8962',
        messageTransmitter: '0xAD09780d193884d503182aD4588450C416D6F9D4',
        usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        domain: 6,
    },
    POLYGON: {
        tokenMessenger: '0x9daF8c91AEFAE50b9c0E69629D3F6Ca40cA3B3FE',
        messageTransmitter: '0xF3be9355363857F3e001be68856A2f96b4C39Ba9',
        usdc: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
        domain: 7,
    },
    OPTIMISM: {
        tokenMessenger: '0x2B4069517957735bE00ceE0fadAE88a26365528f',
        messageTransmitter: '0x4D41f22c5a0e5c74090899E5a8Fb597a8842b3e8',
        usdc: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
        domain: 2,
    },
    // Testnet
    SEPOLIA: {
        tokenMessenger: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
        messageTransmitter: '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD',
        usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
        domain: 0,
    },
    BASE_SEPOLIA: {
        tokenMessenger: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
        messageTransmitter: '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD',
        usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        domain: 6,
    },
    ARBITRUM_SEPOLIA: {
        tokenMessenger: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
        messageTransmitter: '0xaCF1ceeF35caAc005e15888dDb8A3515C41B4872',
        usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
        domain: 3,
    },
};
// TokenMessenger ABI (partial - depositForBurn function)
const TOKEN_MESSENGER_ABI = [
    {
        inputs: [
            { name: 'amount', type: 'uint256' },
            { name: 'destinationDomain', type: 'uint32' },
            { name: 'mintRecipient', type: 'bytes32' },
            { name: 'burnToken', type: 'address' },
        ],
        name: 'depositForBurn',
        outputs: [{ name: 'nonce', type: 'uint64' }],
        stateMutability: 'nonpayable',
        type: 'function',
    },
];
// MessageTransmitter ABI (partial - receiveMessage function)
const MESSAGE_TRANSMITTER_ABI = [
    {
        inputs: [
            { name: 'message', type: 'bytes' },
            { name: 'attestation', type: 'bytes' },
        ],
        name: 'receiveMessage',
        outputs: [{ name: 'success', type: 'bool' }],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [{ name: 'nonce', type: 'uint64' }],
        name: 'usedNonces',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
];
// ERC20 ABI (partial - approve function)
const ERC20_ABI = [
    {
        inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        name: 'approve',
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [{ name: 'account', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
];
export class ArcIntegration {
    clients = new Map();
    attestationServiceUrl = 'https://iris-api.circle.com/attestations';
    constructor() {
        // Initialize public clients for supported chains
        this.initializeClients();
        logger.info('Arc/CCTP Integration initialized');
    }
    initializeClients() {
        const chains = {
            ETHEREUM: { chain: mainnet, rpc: 'https://eth.llamarpc.com' },
            ARBITRUM: { chain: arbitrum, rpc: 'https://arb1.arbitrum.io/rpc' },
            BASE: { chain: base, rpc: 'https://mainnet.base.org' },
            POLYGON: { chain: polygon, rpc: 'https://polygon-rpc.com' },
            OPTIMISM: { chain: optimism, rpc: 'https://mainnet.optimism.io' },
            SEPOLIA: { chain: sepolia, rpc: 'https://rpc.sepolia.org' },
        };
        for (const [name, config] of Object.entries(chains)) {
            this.clients.set(name, createPublicClient({
                chain: config.chain,
                transport: http(config.rpc),
            }));
        }
    }
    /**
     * Get USDC balance on a specific chain
     */
    async getUSDCBalance(chain, address) {
        const client = this.clients.get(chain);
        if (!client)
            throw new Error(`Unsupported chain: ${chain}`);
        const cctp = CCTP_CONTRACTS[chain];
        const balance = await client.readContract({
            address: cctp.usdc,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [address],
        });
        return balance;
    }
    /**
     * Prepare bridge transaction data (for frontend execution)
     * Step 1: Approve USDC spending
     */
    prepareApproveData(chain, amount) {
        const cctp = CCTP_CONTRACTS[chain];
        const data = encodeFunctionData({
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [cctp.tokenMessenger, amount],
        });
        return {
            to: cctp.usdc,
            data,
        };
    }
    /**
     * Prepare depositForBurn transaction data
     * Step 2: Burn USDC on source chain
     */
    prepareDepositForBurnData(request) {
        const sourceCctp = CCTP_CONTRACTS[request.sourceChain];
        const destCctp = CCTP_CONTRACTS[request.destChain];
        // Convert recipient address to bytes32 (padded)
        const mintRecipient = `0x000000000000000000000000${request.recipient.slice(2)}`;
        const data = encodeFunctionData({
            abi: TOKEN_MESSENGER_ABI,
            functionName: 'depositForBurn',
            args: [
                request.amount,
                destCctp.domain,
                mintRecipient,
                sourceCctp.usdc,
            ],
        });
        return {
            to: sourceCctp.tokenMessenger,
            data,
        };
    }
    /**
     * Get attestation from Circle's attestation service
     * This is called after the burn transaction is confirmed
     */
    async getAttestation(messageHash) {
        try {
            const response = await fetch(`${this.attestationServiceUrl}/${messageHash}`);
            const data = await response.json();
            if (data.status === 'complete') {
                return {
                    attestation: data.attestation,
                    status: 'complete',
                };
            }
            return {
                attestation: '',
                status: data.status || 'pending',
            };
        }
        catch (error) {
            logger.error('Failed to get attestation', error);
            return null;
        }
    }
    /**
     * Prepare receiveMessage transaction data
     * Step 3: Mint USDC on destination chain
     */
    prepareReceiveMessageData(destChain, message, attestation) {
        const cctp = CCTP_CONTRACTS[destChain];
        const data = encodeFunctionData({
            abi: MESSAGE_TRANSMITTER_ABI,
            functionName: 'receiveMessage',
            args: [message, attestation],
        });
        return {
            to: cctp.messageTransmitter,
            data,
        };
    }
    /**
     * Get full bridge flow instructions
     */
    getBridgeInstructions(request) {
        const approveData = this.prepareApproveData(request.sourceChain, request.amount);
        const burnData = this.prepareDepositForBurnData(request);
        return {
            steps: [
                {
                    step: 1,
                    action: 'approve',
                    description: `Approve TokenMessenger to spend ${this.formatUSDC(request.amount)} USDC`,
                    transaction: approveData,
                },
                {
                    step: 2,
                    action: 'depositForBurn',
                    description: `Burn ${this.formatUSDC(request.amount)} USDC on ${request.sourceChain}`,
                    transaction: burnData,
                },
                {
                    step: 3,
                    action: 'waitForAttestation',
                    description: 'Wait for Circle attestation (typically 10-20 minutes)',
                },
                {
                    step: 4,
                    action: 'receiveMessage',
                    description: `Mint ${this.formatUSDC(request.amount)} USDC on ${request.destChain}`,
                    // Transaction data generated after attestation is received
                },
            ],
        };
    }
    /**
     * Log a bridge action
     */
    logBridgeAction(action, request, status, txHash) {
        logger.logAction({
            timestamp: new Date().toISOString(),
            action: `CCTP_${action}`,
            reasoning: `Bridge ${this.formatUSDC(request.amount)} USDC from ${request.sourceChain} to ${request.destChain}`,
            inputs: {
                sourceChain: request.sourceChain,
                destChain: request.destChain,
                amount: request.amount.toString(),
                recipient: request.recipient,
            },
            txHash,
            status: status,
        });
    }
    /**
     * Format USDC amount for display (6 decimals)
     */
    formatUSDC(amount) {
        const decimals = 6;
        const divisor = BigInt(10 ** decimals);
        const integerPart = amount / divisor;
        const fractionalPart = amount % divisor;
        return `${integerPart}.${fractionalPart.toString().padStart(decimals, '0').slice(0, 2)} USDC`;
    }
    /**
     * Get supported chains
     */
    getSupportedChains() {
        return Object.keys(CCTP_CONTRACTS);
    }
    /**
     * Get CCTP contract addresses for a chain
     */
    getContractAddresses(chain) {
        return CCTP_CONTRACTS[chain];
    }
    /**
     * Print bridge flow summary
     */
    printBridgeFlowSummary(request) {
        const instructions = this.getBridgeInstructions(request);
        console.log('\n' + '='.repeat(60));
        console.log('CCTP BRIDGE FLOW');
        console.log('='.repeat(60));
        console.log(`\nFrom: ${request.sourceChain}`);
        console.log(`To: ${request.destChain}`);
        console.log(`Amount: ${this.formatUSDC(request.amount)}`);
        console.log(`Recipient: ${request.recipient}`);
        console.log('\nSteps:');
        instructions.steps.forEach((step) => {
            console.log(`  ${step.step}. ${step.action}: ${step.description}`);
        });
        console.log('\n' + '='.repeat(60));
    }
}
export const arcIntegration = new ArcIntegration();
