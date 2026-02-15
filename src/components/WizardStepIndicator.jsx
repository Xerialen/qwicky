// src/components/WizardStepIndicator.jsx
import React from 'react';

const STEPS = [
  { label: 'Welcome' },
  { label: 'Basics' },
  { label: 'Divisions' },
  { label: 'Format' },
  { label: 'Teams' },
  { label: 'Ready' },
];

export default function WizardStepIndicator({ currentStep, onStepClick }) {
  return (
    <div className="flex items-center justify-center gap-0 px-4 py-4">
      {STEPS.map((step, idx) => {
        const isCompleted = idx < currentStep;
        const isCurrent = idx === currentStep;
        const isFuture = idx > currentStep;

        return (
          <React.Fragment key={idx}>
            {/* Connecting line (before each step except the first) */}
            {idx > 0 && (
              <div
                className={`h-0.5 flex-1 max-w-[60px] transition-colors duration-300 ${
                  idx <= currentStep ? 'bg-qw-accent' : 'bg-qw-border'
                }`}
              />
            )}

            {/* Step dot + label */}
            <button
              type="button"
              onClick={() => isCompleted && onStepClick?.(idx)}
              disabled={!isCompleted}
              className={`flex flex-col items-center gap-1.5 group ${
                isCompleted ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
              {/* Dot */}
              <div
                className={`
                  w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                  transition-all duration-300 border-2
                  ${isCompleted
                    ? 'bg-qw-accent border-qw-accent text-qw-dark group-hover:bg-qw-accent-bright'
                    : isCurrent
                      ? 'bg-qw-accent border-qw-accent text-qw-dark'
                      : 'bg-transparent border-qw-border text-qw-muted'
                  }
                `}
              >
                {isCompleted ? (
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>

              {/* Label — hidden on mobile */}
              <span
                className={`
                  hidden sm:block text-[10px] font-semibold uppercase tracking-wider
                  transition-colors duration-300
                  ${isCompleted
                    ? 'text-qw-accent group-hover:text-qw-accent-bright'
                    : isCurrent
                      ? 'text-white'
                      : 'text-qw-muted'
                  }
                `}
              >
                {step.label}
              </span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}
