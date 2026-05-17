'use client';

import { Token } from '@/types';
import { formatTokenAmount } from '@/lib/utils';

interface TokenCardProps {
  token: Token;
  selected: boolean;
  onToggle: () => void;
}

export function TokenCard({ token, selected, onToggle }: TokenCardProps) {
  const balance = token.balance ?? 0;

  return (
    <div
      onClick={onToggle}
      className={`relative p-3 rounded-xl border-2 cursor-pointer transition-all select-none ${
        selected
          ? 'border-blue-500 bg-blue-500/10'
          : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
      }`}
    >
      <div className={`absolute top-2 right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
        selected ? 'bg-blue-500 border-blue-500' : 'border-gray-600'
      }`}>
        {selected && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>

      <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center mb-2 overflow-hidden">
        {token.logoURI ? (
          <img src={token.logoURI} alt={token.symbol} className="w-full h-full object-cover" />
        ) : (
          <span className="text-lg font-bold text-gray-400">
            {token.symbol.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>

      <div className="font-semibold text-white text-sm truncate">{token.symbol}</div>
      <div className="text-gray-400 text-xs mt-0.5">
        {formatTokenAmount(balance, token.decimals)}
      </div>
    </div>
  );
}