// src/components/WizardStepIndicator.jsx — Industrial HUD vertical step indicator
import React from 'react';
import MaterialIcon from './ui/MaterialIcon';

const STEPS = [
  { label: 'Welcome', subtitle: 'ORIENTATION' },
  { label: 'Basics', subtitle: 'TOURNAMENT ID' },
  { label: 'Divisions', subtitle: 'SECTOR ALLOCATION' },
  { label: 'Format', subtitle: 'STRUCTURAL CONFIG' },
  { label: 'Teams', subtitle: 'ROSTER VALIDATION' },
  { label: 'Ready', subtitle: 'LAUNCH SEQUENCE' },
];

export default function WizardStepIndicator({ currentStep, onStepClick }) {
  const progress = Math.round(((currentStep + 1) / STEPS.length) * 100);

  return (
    <div className="flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center gap-2 mb-8">
          <span className="w-2 h-2 bg-primary-container" />
          <span className="font-headline font-bold uppercase tracking-tighter text-on-surface-variant text-sm">
            Setup Wizard
          </span>
        </div>

        <div className="space-y-6">
          {STEPS.map((step, idx) => {
            const isCompleted = idx < currentStep;
            const isCurrent = idx === currentStep;
            const isFuture = idx > currentStep;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => isCompleted && onStepClick?.(idx)}
                disabled={!isCompleted}
                className={`flex items-start gap-4 w-full text-left transition-all ${
                  isFuture ? 'opacity-30' : ''
                } ${isCompleted ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
              >
                <span
                  className={`font-mono font-bold text-sm ${
                    isCurrent ? 'text-primary' : isCompleted ? 'text-primary/50' : 'text-on-surface-variant'
                  }`}
                >
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <div>
                  <span
                    className={`block font-headline text-xs font-black uppercase tracking-widest ${
                      isCurrent ? 'text-primary' : 'text-on-surface-variant'
                    }`}
                  >
                    {step.label}
                  </span>
                  <span
                    className={`block font-mono text-[10px] ${
                      isCurrent ? 'text-primary/60' : 'text-on-surface-variant/40'
                    }`}
                  >
                    {step.subtitle}
                  </span>
                </div>
                {isCompleted && (
                  <MaterialIcon name="check" className="text-primary/50 text-sm ml-auto" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-12">
        <span className="block font-mono text-[10px] text-secondary uppercase tracking-widest mb-1">
          Runtime Status
        </span>
        <div className="flex items-center gap-2">
          <div className="w-full h-1 bg-surface-container-lowest overflow-hidden">
            <div
              className="h-full bg-primary shadow-[0_0_8px_#ffc485] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="font-mono text-[9px] text-primary whitespace-nowrap">
            {progress}%
          </span>
        </div>
      </div>
    </div>
  );
}
