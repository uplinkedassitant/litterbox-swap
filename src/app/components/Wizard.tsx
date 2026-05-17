'use client';

import { useWizard } from '@/lib/WizardContext';
import { WizardStep } from '@/types';
import { useWallet } from '@solana/wallet-adapter-react';

const STEPS: { id: WizardStep; label: string }[] = [
  { id: 'connect', label: 'Connect' },
  { id: 'select', label: 'Select Tokens' },
  { id: 'target', label: 'Pick Target' },
  { id: 'review', label: 'Review & Swap' },
];

export function Wizard() {
  const { step } = useWizard();
  const stepIndex = STEPS.findIndex(s => s.id === step);

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center justify-center mb-8">
        {STEPS.map((s, i) => {
          const isActive = s.id === step;
          const isDone = i < stepIndex;
          return (
            <div key={s.id} className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-colors ${
                isDone ? 'bg-green-500 text-white' :
                isActive ? 'bg-blue-600 text-white' :
                'bg-gray-700 text-gray-400'
              }`}>
                {isDone ? '✓' : i + 1}
              </div>
              <span className={`ml-2 text-sm font-medium hidden sm:inline ${
                isActive ? 'text-white' : 'text-gray-500'
              }`}>{s.label}</span>
              {i < STEPS.length - 1 && (
                <div className={`w-8 sm:w-16 h-0.5 mx-2 ${
                  isDone ? 'bg-green-500' : 'bg-gray-700'
                }`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}