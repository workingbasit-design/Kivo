import { cn } from '@/lib/utils';

export type ProgressStepState = 'done' | 'now' | 'todo';

export interface ProgressStep {
  label: string;
  sub?: string;
  state: ProgressStepState;
}

export interface ProgressStepsProps {
  steps: ProgressStep[];
}

/**
 * Vertical steps with a connector rail (mockup `.steps`): done steps get
 * an ok dot, the current step a warn ring, future steps a plain outline.
 */
export function ProgressSteps({ steps }: ProgressStepsProps) {
  return (
    <ol data-kit="progress-steps" className="list-none m-0 py-1.5">
      {steps.map((step) => (
        <li
          key={step.label}
          aria-current={step.state === 'now' ? 'step' : undefined}
          className={cn(
            'relative grid grid-cols-[20px_minmax(0,1fr)_auto] gap-3 items-center py-2',
            // connector rail
            "before:content-[''] before:absolute before:left-[9px] before:top-0 before:bottom-0 before:w-0.5 before:bg-line",
            'first:before:top-1/2 last:before:bottom-1/2',
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              'relative z-[1] justify-self-center w-3.5 h-3.5 rounded-full',
              'border-[2.5px] border-line-strong bg-surface',
              step.state === 'done' && 'bg-ok border-ok',
              step.state === 'now' && 'border-warn ring-4 ring-warn-bg',
            )}
          />
          <div className="min-w-0">
            <span
              className={cn(
                'font-semibold text-ink',
                step.state === 'todo' && 'text-ink-2 font-medium',
              )}
            >
              {step.label}
            </span>
            {step.sub && (
              <span className="block text-[14px] text-ink-2">{step.sub}</span>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
