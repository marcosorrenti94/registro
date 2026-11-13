import * as Tooltip from '@radix-ui/react-tooltip';
import { Info } from 'lucide-react';
import { useState, type ReactNode } from 'react';

/** Spiegazione breve accanto a un valore. Si apre al passaggio del mouse, al focus e al tocco. */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip.Root open={open} onOpenChange={setOpen} delayDuration={150}>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex size-6 items-center justify-center rounded-full text-ink-3 hover:text-ink"
        >
          <Info className="size-4" aria-hidden />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          sideOffset={6}
          className="z-50 max-w-72 rounded-lg bg-ink px-3 py-2 text-xs leading-relaxed text-paper shadow-lg"
        >
          {children}
          <Tooltip.Arrow className="fill-ink" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
