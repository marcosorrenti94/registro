import { useEffect, useState, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { formatEuro } from '@/lib/money';

/** true se è attivo il tema scuro (classe .dark su <html>). */
export function useIsDark(): boolean {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => setDark(el.classList.contains('dark')));
    obs.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

const compact = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0, useGrouping: 'always' });

/** Etichetta d'asse: "€ 1.200" (senza decimali). */
export function axisEuro(cents: number): string {
  return `€ ${compact.format(cents / 100)}`;
}

export const AXIS_PROPS = {
  stroke: 'var(--line-strong)',
  tick: { fill: 'var(--ink-3)', fontSize: 12 },
  tickLine: false,
  axisLine: false,
} as const;

export function ChartCard({
  title,
  description,
  action,
  isEmpty,
  emptyText = 'Nessun dato in questo periodo.',
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  isEmpty?: boolean;
  emptyText?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={clsx('rounded-2xl border border-line bg-surface p-4 sm:p-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-lg font-semibold">{title}</h3>
          {description ? <p className="mt-0.5 text-sm text-ink-3">{description}</p> : null}
        </div>
        {action}
      </div>
      {isEmpty ? (
        <div className="mt-4 flex h-48 items-center justify-center rounded-xl border border-dashed border-line-strong px-6 text-center text-sm text-ink-3">
          {emptyText}
        </div>
      ) : (
        <div className="mt-4">{children}</div>
      )}
    </section>
  );
}

export interface TooltipRow {
  name: string;
  value: number;
  color: string;
  dashed?: boolean;
}

/** Riquadro del tooltip: testo nei colori del testo, il colore della serie solo nel campione. */
export function TooltipBox({
  title,
  rows,
  footer,
}: {
  title: string;
  rows: TooltipRow[];
  footer?: ReactNode;
}) {
  return (
    <div className="min-w-44 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm shadow-lg">
      <p className="font-semibold text-ink">{title}</p>
      <ul className="mt-1.5 grid gap-1">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-ink-2">
              <span
                aria-hidden
                className="inline-block h-0.5 w-3"
                style={{
                  background: r.dashed ? 'transparent' : r.color,
                  borderTop: r.dashed ? `2px dashed ${r.color}` : undefined,
                  height: r.dashed ? 0 : 8,
                  borderRadius: 2,
                }}
              />
              {r.name}
            </span>
            <span className="num font-semibold text-ink">{formatEuro(r.value)}</span>
          </li>
        ))}
      </ul>
      {footer ? <div className="mt-1.5 border-t border-line pt-1.5 text-ink-2">{footer}</div> : null}
    </div>
  );
}

/** Legenda HTML cliccabile: mostra/nasconde le serie. L'identità non è mai affidata solo al colore. */
export function ToggleLegend({
  items,
  hidden,
  onToggle,
}: {
  items: { key: string; name: string; color: string; dashed?: boolean }[];
  hidden: Set<string>;
  onToggle: (key: string) => void;
}) {
  return (
    <ul className="mb-3 flex flex-wrap gap-2" aria-label="Serie del grafico">
      {items.map((it) => {
        const off = hidden.has(it.key);
        return (
          <li key={it.key}>
            <button
              type="button"
              aria-pressed={!off}
              onClick={() => onToggle(it.key)}
              className={clsx(
                'inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors',
                off ? 'border-line text-ink-3 line-through' : 'border-line-strong text-ink',
              )}
            >
              <span
                aria-hidden
                className="inline-block w-4"
                style={
                  it.dashed
                    ? { borderTop: `2px dashed ${off ? 'var(--line-strong)' : it.color}` }
                    : { height: 10, borderRadius: 3, background: off ? 'var(--line-strong)' : it.color }
                }
              />
              {it.name}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function useToggleSet(initial: string[] = []) {
  const [hidden, setHidden] = useState(() => new Set(initial));
  const toggle = (key: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  return [hidden, toggle] as const;
}
