// Complete shim for @mysten/sui/jsonRpc to fix version mismatch.
// @mysten/dapp-kit@1.0.1 expects @mysten/sui@^2 exports but we have 1.45.2.
// We don't use Sui, so these are all stubs.

/* eslint-disable @typescript-eslint/no-explicit-any */

export class SuiJsonRpcClient {
  constructor(_options: any) {}
}

export function isSuiJsonRpcClient(_client: any): boolean {
  return false;
}

export class JsonRpcHTTPTransport {
  constructor(_options: any) {}
}

export class SuiHTTPStatusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SuiHTTPStatusError';
  }
}

export class SuiHTTPTransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SuiHTTPTransportError';
  }
}

export class JsonRpcError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JsonRpcError';
  }
}

// Added in @mysten/sui@2.x, missing in 1.45.2
const fullnodeUrls: Record<string, string> = {
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
  devnet: 'https://fullnode.devnet.sui.io:443',
  localnet: 'http://127.0.0.1:9000',
};

export function getJsonRpcFullnodeUrl(network: string): string {
  return fullnodeUrls[network] || fullnodeUrls.mainnet;
}
