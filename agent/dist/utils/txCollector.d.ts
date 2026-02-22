/**
 * Transaction Evidence Collector
 *
 * Records all on-chain transactions the agent performs.
 * Used for demo evidence and hackathon submission.
 */
export interface TxRecord {
    hash: string;
    description: string;
    chain: string;
    chainId: number;
    type: 'resolve' | 'bridge' | 'swap' | 'approve' | 'entry' | 'update' | 'analyze';
    timestamp: number;
    gasUsed?: string;
    blockNumber?: number;
    from?: string;
    to?: string;
}
declare class TxCollector {
    private txs;
    record(tx: TxRecord): void;
    getAll(): TxRecord[];
    getByType(type: TxRecord['type']): TxRecord[];
    count(): number;
    getEtherscanLinks(): string[];
    printSummary(): void;
    exportForDemo(): {
        totalTxs: number;
        transactions: TxRecord[];
        etherscanLinks: string[];
        summary: Record<string, number>;
    };
    clear(): void;
}
export declare const txCollector: TxCollector;
export {};
