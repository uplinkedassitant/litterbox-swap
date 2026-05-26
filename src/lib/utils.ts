export function truncateAddress(addr: string, chars = 4): string {
  if (!addr) return '';
  return `${addr.slice(0, chars + 2)}...${addr.slice(-chars)}`;
}

export function formatTokenAmount(amount: number, decimals: number): string {
  if (amount === 0) return '0';
  
  // If amount is already small (< 1M), it's likely already human-readable
  // Don't divide again - this prevents the double-division bug
  let formatted = amount < 1_000_000 ? amount : amount / Math.pow(10, decimals);
  
  if (formatted < 0.01) return '<0.01';
  if (formatted >= 1_000_000) return `${(formatted / 1_000_000).toFixed(2)}M`;
  if (formatted >= 1_000) return `${(formatted / 1_000).toFixed(2)}K`;
  return formatted.toFixed(4).replace(/\.?0+$/, '');
}

export function formatSolAmount(amount: number): string {
  return `${amount.toFixed(4)} SOL`;
}

export function lamportsToAmount(lamports: bigint | number, decimals: number): number {
  return Number(lamports) / Math.pow(10, decimals);
}

export function amountToLamports(amount: number, decimals: number): bigint {
  return BigInt(Math.floor(amount * Math.pow(10, decimals)));
}

export function bpsToPercent(bps: number): string {
  return `${(bps / 100).toFixed(1)}%`;
}