'use client';

import { useWizard } from '@/lib/WizardContext';
import { Wizard } from './components/Wizard';
import { StepConnect } from './components/StepConnect';
import { StepSelectTokens } from './components/StepSelectTokens';
import { StepPickTarget } from './components/StepPickTarget';
import { StepReview } from './components/StepReview';

export default function HomePage() {
  const { step } = useWizard();

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 py-4 px-6">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🗑️</span>
            <span className="font-bold text-xl tracking-tight">Litterbox</span>
          </div>
          <span className="text-gray-500 text-xs">Batch Swap Wizard</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <Wizard />

        <div className="mt-8 bg-gray-900 rounded-2xl border border-gray-800 p-6 min-h-96">
          {step === 'connect' && <StepConnect />}
          {step === 'select' && <StepSelectTokens />}
          {step === 'target' && <StepPickTarget />}
          {step === 'review' && <StepReview />}
        </div>
      </div>
    </main>
  );
}