/**
 * Simple logger with structured output for agent transparency
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export interface AgentActionLog {
    timestamp: string;
    action: string;
    battleId?: string;
    contractType?: string;
    reasoning: string;
    inputs?: Record<string, unknown>;
    outputs?: Record<string, unknown>;
    txHash?: string;
    gasUsed?: string;
    status: 'pending' | 'success' | 'failed';
}
declare class Logger {
    private level;
    private actionLogs;
    setLevel(level: LogLevel): void;
    private shouldLog;
    private formatTimestamp;
    debug(message: string, data?: unknown): void;
    info(message: string, data?: unknown): void;
    warn(message: string, data?: unknown): void;
    error(message: string, data?: unknown): void;
    success(message: string, data?: unknown): void;
    logAction(action: AgentActionLog): void;
    getActionLogs(): AgentActionLog[];
    getRecentLogs(limit?: number): AgentActionLog[];
    printSummary(): void;
}
export declare const logger: Logger;
export {};
