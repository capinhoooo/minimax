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

const LOG_COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

class TxCollector {
  private txs: TxRecord[] = [];

  record(tx: TxRecord): void {
    this.txs.push(tx);
  }

  getAll(): TxRecord[] {
    return [...this.txs];
  }

  getByType(type: TxRecord['type']): TxRecord[] {
    return this.txs.filter(tx => tx.type === type);
  }

  count(): number {
    return this.txs.length;
  }

  getEtherscanLinks(): string[] {
    return this.txs.map(tx => {
      const explorer = tx.chainId === 11155111
        ? 'https://sepolia.etherscan.io'
        : tx.chainId === 84532
        ? 'https://sepolia.basescan.org'
        : tx.chainId === 421614
        ? 'https://sepolia.arbiscan.io'
        : 'https://etherscan.io';
      return `${explorer}/tx/${tx.hash}`;
    });
  }

  printSummary(): void {
    console.log('\n' + '='.repeat(70));
    console.log(`${LOG_COLORS.cyan}  TRANSACTION EVIDENCE SUMMARY${LOG_COLORS.reset}`);
    console.log('='.repeat(70));
    console.log(`  Total Transactions: ${this.txs.length}`);

    const byType: Record<string, number> = {};
    for (const tx of this.txs) {
      byType[tx.type] = (byType[tx.type] || 0) + 1;
    }
    for (const [type, count] of Object.entries(byType)) {
      console.log(`    ${type}: ${count}`);
    }

    if (this.txs.length > 0) {
      console.log(`\n${LOG_COLORS.green}  Transaction Hashes:${LOG_COLORS.reset}`);
      this.txs.forEach((tx, i) => {
        const explorer = tx.chainId === 11155111
          ? 'sepolia.etherscan.io'
          : tx.chainId === 84532
          ? 'sepolia.basescan.org'
          : tx.chainId === 421614
          ? 'sepolia.arbiscan.io'
          : 'etherscan.io';
        console.log(`  ${i + 1}. [${tx.type.toUpperCase()}] ${tx.description}`);
        console.log(`     ${LOG_COLORS.gray}${tx.hash}${LOG_COLORS.reset}`);
        console.log(`     ${LOG_COLORS.blue}https://${explorer}/tx/${tx.hash}${LOG_COLORS.reset}`);
      });
    }
    console.log('='.repeat(70) + '\n');
  }

  exportForDemo(): {
    totalTxs: number;
    transactions: TxRecord[];
    etherscanLinks: string[];
    summary: Record<string, number>;
  } {
    const summary: Record<string, number> = {};
    for (const tx of this.txs) {
      summary[tx.type] = (summary[tx.type] || 0) + 1;
    }
    return {
      totalTxs: this.txs.length,
      transactions: this.txs,
      etherscanLinks: this.getEtherscanLinks(),
      summary,
    };
  }

  clear(): void {
    this.txs = [];
  }
}

export const txCollector = new TxCollector();
