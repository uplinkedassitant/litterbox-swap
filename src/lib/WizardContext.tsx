'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Token, WizardStep, SwapResult } from '@/types';

interface WizardContextType {
  step: WizardStep;
  setStep: (step: WizardStep) => void;
  selectedTokens: Token[];
  setSelectedTokens: (tokens: Token[]) => void;
  toggleToken: (token: Token) => void;
  targetToken: Token | null;
  setTargetToken: (token: Token | null) => void;
  slippageBps: number;
  setSlippageBps: (bps: number) => void;
  swapResults: SwapResult[];
  setSwapResults: (results: SwapResult[]) => void;
  resetWizard: () => void;
}

const WizardContext = createContext<WizardContextType | null>(null);

export function WizardProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<WizardStep>('connect');
  const [selectedTokens, setSelectedTokens] = useState<Token[]>([]);
  const [targetToken, setTargetToken] = useState<Token | null>(null);
  const [slippageBps, setSlippageBps] = useState(100); // 1%
  const [swapResults, setSwapResults] = useState<SwapResult[]>([]);

  const toggleToken = useCallback((token: Token) => {
    setSelectedTokens(prev =>
      prev.some(t => t.mint === token.mint)
        ? prev.filter(t => t.mint !== token.mint)
        : [...prev, token]
    );
  }, []);

  const resetWizard = useCallback(() => {
    setStep('connect');
    setSelectedTokens([]);
    setTargetToken(null);
    setSlippageBps(100);
    setSwapResults([]);
  }, []);

  return (
    <WizardContext.Provider value={{
      step, setStep,
      selectedTokens, setSelectedTokens, toggleToken,
      targetToken, setTargetToken,
      slippageBps, setSlippageBps,
      swapResults, setSwapResults,
      resetWizard,
    }}>
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard() {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error('useWizard must be used inside WizardProvider');
  return ctx;
}