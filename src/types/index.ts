export interface Token {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  balance?: number;
  balanceRaw?: bigint;
}

export interface SelectedToken extends Token {
  selected: boolean;
  estimatedOutput?: number;
}

export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inputAmount: number;
  estimatedOutput: number;
  priceImpactPct: number;
  orderId?: string;
  swapTransaction?: string;
}

export interface SwapResult {
  token: Token;
  success: boolean;
  txid?: string;
  outputAmount?: number;
  error?: string;
}

export type WizardStep = 'connect' | 'select' | 'target' | 'review';

export interface WizardState {
  step: WizardStep;
  walletAddress: string | null;
  selectedTokens: Token[];
  targetToken: Token | null;
  slippageBps: number;
  quotes: SwapQuote[];
  results: SwapResult[];
}