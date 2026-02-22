export declare const config: {
    chain: {
        blockExplorers: {
            readonly default: {
                readonly name: "Arbiscan";
                readonly url: "https://sepolia.arbiscan.io";
                readonly apiUrl: "https://api-sepolia.arbiscan.io/api";
            };
        };
        blockTime: 250;
        contracts: {
            readonly multicall3: {
                readonly address: "0xca11bde05977b3631167028862be2a173976ca11";
                readonly blockCreated: 81930;
            };
        };
        ensTlds?: readonly string[] | undefined;
        id: 421614;
        name: "Arbitrum Sepolia";
        nativeCurrency: {
            readonly name: "Arbitrum Sepolia Ether";
            readonly symbol: "ETH";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://sepolia-rollup.arbitrum.io/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        testnet: true;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: import("viem").ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: import("viem").PrepareTransactionRequestParameters, options: {
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<import("viem").PrepareTransactionRequestParameters>) | [fn: ((args: import("viem").PrepareTransactionRequestParameters, options: {
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<import("viem").PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: import("viem").ChainSerializers<undefined, import("viem").TransactionSerializable> | undefined;
        verifyHash?: ((client: import("viem").Client, parameters: import("viem").VerifyHashActionParameters) => Promise<import("viem").VerifyHashActionReturnType>) | undefined;
    };
    chainId: number;
    rpcUrl: string;
    privateKey: `0x${string}`;
    battleArenaAddress: `0x${string}`;
    poolManager: `0x${string}`;
    pollIntervalMs: number;
    logLevel: string;
};
export declare function validateConfig(): void;
