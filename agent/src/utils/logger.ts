/**
 * Simple logger with structured output for agent transparency
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface AgentActionLog {
  timestamp: string;
  action: string;
  battleId?: string;
  contractType?: 'range' | 'fee';
  reasoning: string;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  txHash?: string;
  gasUsed?: string;
  status: 'pending' | 'success' | 'failed';
}

const LOG_COLORS = {
  debug: '\x1b[90m',   // Gray
  info: '\x1b[36m',    // Cyan
  warn: '\x1b[33m',    // Yellow
  error: '\x1b[31m',   // Red
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
};

class Logger {
  private level: LogLevel = 'info';
  private actionLogs: AgentActionLog[] = [];

  setLevel(level: LogLevel) {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  debug(message: string, data?: unknown) {
    if (this.shouldLog('debug')) {
      console.log(`${LOG_COLORS.debug}[${this.formatTimestamp()}] [DEBUG] ${message}${LOG_COLORS.reset}`, data || '');
    }
  }

  info(message: string, data?: unknown) {
    if (this.shouldLog('info')) {
      console.log(`${LOG_COLORS.info}[${this.formatTimestamp()}] [INFO] ${message}${LOG_COLORS.reset}`, data || '');
    }
  }

  warn(message: string, data?: unknown) {
    if (this.shouldLog('warn')) {
      console.log(`${LOG_COLORS.warn}[${this.formatTimestamp()}] [WARN] ${message}${LOG_COLORS.reset}`, data || '');
    }
  }

  error(message: string, data?: unknown) {
    if (this.shouldLog('error')) {
      console.log(`${LOG_COLORS.error}[${this.formatTimestamp()}] [ERROR] ${message}${LOG_COLORS.reset}`, data || '');
    }
  }

  success(message: string, data?: unknown) {
    console.log(`${LOG_COLORS.green}[${this.formatTimestamp()}] [SUCCESS] ${message}${LOG_COLORS.reset}`, data || '');
  }

  // Log agent actions with full transparency
  logAction(action: AgentActionLog) {
    this.actionLogs.push(action);

    const statusColor = action.status === 'success' ? LOG_COLORS.green :
                        action.status === 'failed' ? LOG_COLORS.error : LOG_COLORS.blue;

    console.log('\n' + '='.repeat(60));
    console.log(`${LOG_COLORS.blue}[AGENT ACTION]${LOG_COLORS.reset} ${action.action}`);
    console.log('='.repeat(60));
    console.log(`  Timestamp:    ${action.timestamp}`);
    if (action.battleId) console.log(`  Battle ID:    ${action.battleId}`);
    if (action.contractType) console.log(`  Contract:     ${action.contractType === 'range' ? 'Range Vault' : 'Fee Vault'}`);
    console.log(`  Reasoning:    ${action.reasoning}`);
    console.log(`  Status:       ${statusColor}${action.status.toUpperCase()}${LOG_COLORS.reset}`);
    if (action.txHash) console.log(`  TX Hash:      ${action.txHash}`);
    if (action.gasUsed) console.log(`  Gas Used:     ${action.gasUsed}`);
    if (action.inputs) console.log(`  Inputs:       ${JSON.stringify(action.inputs)}`);
    if (action.outputs) console.log(`  Outputs:      ${JSON.stringify(action.outputs)}`);
    console.log('='.repeat(60) + '\n');
  }

  // Get all action logs (for reporting)
  getActionLogs(): AgentActionLog[] {
    return this.actionLogs;
  }

  // Print summary of all actions
  printSummary() {
    const successful = this.actionLogs.filter(l => l.status === 'success').length;
    const failed = this.actionLogs.filter(l => l.status === 'failed').length;
    const pending = this.actionLogs.filter(l => l.status === 'pending').length;

    console.log('\n' + '='.repeat(60));
    console.log(`${LOG_COLORS.blue}[AGENT SUMMARY]${LOG_COLORS.reset}`);
    console.log('='.repeat(60));
    console.log(`  Total Actions:  ${this.actionLogs.length}`);
    console.log(`  ${LOG_COLORS.green}Successful:     ${successful}${LOG_COLORS.reset}`);
    console.log(`  ${LOG_COLORS.error}Failed:         ${failed}${LOG_COLORS.reset}`);
    console.log(`  ${LOG_COLORS.blue}Pending:        ${pending}${LOG_COLORS.reset}`);
    console.log('='.repeat(60) + '\n');

    // List all transaction hashes
    const txHashes = this.actionLogs.filter(l => l.txHash).map(l => l.txHash);
    if (txHashes.length > 0) {
      console.log('Transaction Hashes:');
      txHashes.forEach((hash, i) => {
        console.log(`  ${i + 1}. ${hash}`);
      });
    }
  }
}

export const logger = new Logger();
