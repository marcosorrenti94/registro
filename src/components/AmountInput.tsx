import { useId, useState, type ReactNode } from 'react';
import { clsx } from 'clsx';
import type { Cents } from '@/domain/types';
import { centsToInput, parseAmount } from '@/lib/money';

/**
 * Campo importo con tastiera decimale su mobile. Accetta "," e "." come separatore.
 * Comunica il valore in centesimi solo quando è valido; altrimenti mostra l'errore.
 */
export function AmountInput({
  label,
  value,
  onChange,
  swatch,
  hint,
  autoFocus,
  size = 'lg',
  id: idProp,
}: {
  label: string;
  value: Cents;
  onChange: (cents: Cents) => void;
  swatch?: string;
  hint?: ReactNode;
  autoFocus?: boolean;
  size?: 'lg' | 'md';
  id?: string;
}) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const [text, setText] = useState(() => centsToInput(value));
  const [invalid, setInvalid] = useState(false);
  const [prevValue, setPrevValue] = useState(value);

  // Allinea il testo quando il valore cambia dall'esterno (es. bozza scartata)
  if (value !== prevValue) {
    setPrevValue(value);
    if (parseAmount(text) !== value) {
      setText(centsToInput(value));
      setInvalid(false);
    }
  }

  return (
    <div>
      <label htmlFor={id} className="flex items-center gap-2 text-sm font-semibold text-ink-2">
        {swatch ? (
          <span aria-hidden className="inline-block h-3.5 w-2 rounded-sm" style={{ background: swatch }} />
        ) : null}
        {label}
      </label>
      <div className="relative mt-1.5">
        <span
          aria-hidden
          className={clsx(
            'pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-3',
            size === 'lg' ? 'text-lg' : 'text-base',
          )}
        >
          €
        </span>
        <input
          id={id}
          inputMode="decimal"
          enterKeyHint="next"
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder="0"
          value={text}
          aria-invalid={invalid}
          aria-describedby={invalid || hint ? `${id}-hint` : undefined}
          onChange={(e) => {
            const t = e.target.value;
            setText(t);
            const cents = parseAmount(t);
            setInvalid(cents === null);
            if (cents !== null) onChange(cents);
          }}
          onBlur={() => {
            const cents = parseAmount(text);
            if (cents !== null) setText(centsToInput(cents));
          }}
          className={clsx(
            'num w-full rounded-xl border bg-surface pr-4 pl-10 text-right font-semibold text-ink placeholder:text-ink-3/60',
            size === 'lg' ? 'min-h-14 text-2xl' : 'min-h-12 text-lg',
            invalid ? 'border-uscite' : 'border-line-strong focus:border-plum',
          )}
        />
      </div>
      {invalid ? (
        <p id={`${id}-hint`} className="mt-1 text-xs font-medium text-uscite">
          Scrivi un importo come 45 o 45,50.
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
