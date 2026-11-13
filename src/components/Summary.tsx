import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import type { Settings } from '@/domain/types';
import type { PeriodSummary } from '@/lib/calc';
import { relativeChange } from '@/lib/calc';
import { formatEuro, formatPercent, formatRate } from '@/lib/money';
import { InfoTip } from './ui/InfoTip';

export function fatturatoTip(settings: Settings): string {
  return settings.vatMode === 'scorporo'
    ? `Contanti + carta al netto dell'IVA (scorporo al ${formatRate(settings.vatRateBps)}). Le varie sono escluse.`
    : 'Contanti + carta, senza IVA aggiunta. Le varie sono escluse.';
}

export function ivaTip(settings: Settings): string {
  return settings.vatMode === 'scorporo'
    ? `IVA già compresa negli incassi di contanti e carta: (contanti + carta) − (contanti + carta) / ${1 + settings.vatRateBps / 10000}. Le varie sono escluse.`
    : `IVA aggiunta sopra gli incassi: (contanti + carta) × ${formatRate(settings.vatRateBps)}, come nel vecchio Excel. Le varie sono escluse.`;
}

/** Variazione rispetto a un valore precedente, con segno e colore. */
export function Delta({
  current,
  previous,
  inverse = false,
}: {
  current: number;
  previous: number;
  inverse?: boolean;
}) {
  const ch = relativeChange(current, previous);
  if (ch === null) return null;
  const good = inverse ? ch <= 0 : ch >= 0;
  return (
    <span className={clsx('num text-xs font-semibold', good ? 'text-ok' : 'text-uscite')}>
      {ch >= 0 ? '+' : '−'}
      {formatPercent(Math.abs(ch))}
    </span>
  );
}

/** Riga di una lista di valori: etichetta a sinistra, importo allineato a destra. */
export function ValueRow({
  label,
  value,
  tip,
  tone,
  strong,
  extra,
}: {
  label: string;
  value: string;
  tip?: string;
  tone?: 'uscite' | 'muted';
  strong?: boolean;
  extra?: ReactNode;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 border-b border-line py-1.5 last:border-0">
      <dt className="flex items-center gap-1 text-sm text-ink-2">
        {label}
        {tip ? <InfoTip label={`Cos'è ${label}`}>{tip}</InfoTip> : null}
      </dt>
      <dd className="flex items-center gap-2 text-right">
        {extra}
        <span
          className={clsx(
            'num',
            strong ? 'text-lg font-bold' : 'font-semibold',
            tone === 'uscite' && 'text-uscite',
            tone === 'muted' && 'text-ink-3',
          )}
        >
          {value}
        </span>
      </dd>
    </div>
  );
}

/** Riepilogo del periodo (come il riquadro Q–R dei fogli mensili). */
export function PeriodPanel({
  summary,
  settings,
  previous,
  previousLabel,
  className = 'md:grid-cols-2',
}: {
  summary: PeriodSummary;
  settings: Settings;
  previous?: PeriodSummary | null;
  previousLabel?: string;
  className?: string;
}) {
  const vatLabel = `IVA ${formatRate(settings.vatRateBps)}`;
  return (
    <div className={clsx('grid gap-4', className)}>
      <section className="rounded-2xl border border-line bg-surface px-4 py-2 sm:px-5">
        <h3 className="pt-2 pb-1 font-display text-lg font-semibold">Riepilogo</h3>
        <dl>
          <ValueRow
            label="Totale entrate"
            value={formatEuro(summary.entrate)}
            strong
            extra={previous ? <Delta current={summary.entrate} previous={previous.entrate} /> : null}
          />
          <ValueRow label="Contanti" value={formatEuro(summary.contanti)} />
          <ValueRow label="Carta" value={formatEuro(summary.carta)} />
          <ValueRow
            label="Varie"
            value={formatEuro(summary.varie)}
            tip="Entrate già tassate altrove: contano nel totale ma non nell'IVA."
          />
          <ValueRow
            label="Totale uscite"
            value={summary.uscite ? `-${formatEuro(summary.uscite)}` : formatEuro(0)}
            tone={summary.uscite ? 'uscite' : undefined}
            extra={previous ? <Delta current={summary.uscite} previous={previous.uscite} inverse /> : null}
          />
          <ValueRow
            label="Ricavo netto"
            value={formatEuro(summary.netto)}
            strong
            tone={summary.netto < 0 ? 'uscite' : undefined}
            tip="Totale entrate meno totale uscite."
          />
        </dl>
        {previous && previousLabel ? (
          <p className="pb-2 text-xs text-ink-3">
            Variazioni rispetto a {previousLabel}: entrate {formatEuro(previous.entrate)}, uscite{' '}
            {formatEuro(previous.uscite)}.
          </p>
        ) : null}
      </section>
      <section className="rounded-2xl border border-line bg-surface px-4 py-2 sm:px-5">
        <h3 className="pt-2 pb-1 font-display text-lg font-semibold">
          IVA {settings.vatMode === 'scorporo' ? 'in scorporo' : 'in aggiunta'}
        </h3>
        <dl>
          <ValueRow label="Contanti + carta" value={formatEuro(summary.lordoImponibile)} />
          <ValueRow
            label="Fatturato dichiarato"
            value={formatEuro(summary.fatturatoDichiarato)}
            tip={fatturatoTip(settings)}
          />
          <ValueRow label={vatLabel} value={formatEuro(summary.iva)} tip={ivaTip(settings)} />
          {settings.vatMode === 'aggiunta' ? (
            <ValueRow label="Totale con IVA" value={formatEuro(summary.totaleConIva)} />
          ) : null}
          <ValueRow
            label="Netto dopo IVA"
            value={formatEuro(summary.nettoDopoIva)}
            tip="Ricavo netto meno l'IVA del periodo."
            tone={summary.nettoDopoIva < 0 ? 'uscite' : undefined}
          />
          <ValueRow
            label="Incasso medio giornaliero"
            value={formatEuro(summary.incassoMedioGiornaliero)}
            tip={`Totale dei giorni con entrate diviso per il numero di quei giorni (${summary.giorniConEntrate}).`}
          />
        </dl>
      </section>
    </div>
  );
}
