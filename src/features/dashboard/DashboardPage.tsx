import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { clsx } from 'clsx';
import {
  ExpenseDistributionChart,
  IncomeByMonthChart,
  MethodsByMonthChart,
  TrendChart,
} from '@/components/charts/Charts';
import { Delta, ValueRow, fatturatoTip, ivaTip } from '@/components/Summary';
import { availableYears, monthlySummaries, summarize, type PeriodSummary } from '@/lib/calc';
import { MONTH_NAMES, formatDateIt, isIsoDate, parseIso, todayIso, yearRange } from '@/lib/dates';
import { formatAmount, formatEuro, formatPercent, formatRate } from '@/lib/money';
import { useData } from '@/state/DataContext';
import { useCategories } from '@/state/useCategories';

function Hero({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: number;
  tone?: 'uscite';
  sub?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-semibold text-ink-2">{label}</p>
      <p
        className={clsx(
          'num mt-1 truncate font-display text-3xl font-semibold tracking-tight sm:text-4xl',
          tone === 'uscite' && 'text-uscite',
          value < 0 && 'text-uscite',
        )}
      >
        {formatEuro(value)}
      </p>
      {sub ? <div className="mt-0.5 text-xs text-ink-3">{sub}</div> : null}
    </div>
  );
}

export function DashboardPage() {
  const params = useParams();
  const navigate = useNavigate();
  const { db } = useData();
  const { all } = useCategories();
  const years = useMemo(() => availableYears(db), [db]);
  const currentYear = parseIso(todayIso()).year;
  const year = Number(params.year) || currentYear;
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);

  const months = useMemo(() => monthlySummaries(db, year), [db, year]);
  const prevMonths = useMemo(() => monthlySummaries(db, year - 1), [db, year]);
  const yearSum = useMemo(() => summarize(db, yearRange(year)), [db, year]);
  const prevYearSum = useMemo(() => summarize(db, yearRange(year - 1)), [db, year]);
  const kpiRange = range && range.from <= range.to ? range : null;
  const kpi: PeriodSummary = useMemo(
    () => (kpiRange ? summarize(db, kpiRange) : yearSum),
    [db, kpiRange, yearSum],
  );
  const hasPrev = prevYearSum.giorniCompilati > 0 && !kpiRange;
  const s = db.settings;

  const yearOptions = years.includes(year) ? years : [...years, year].sort((a, b) => a - b);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Dashboard {year}</h1>
          <p className="mt-1 text-sm text-ink-2">{s.businessName}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-semibold text-ink-2">
            Anno
            <select
              value={year}
              onChange={(e) => {
                setRange(null);
                navigate(`/dashboard/${e.target.value}`);
              }}
              className="mt-1 block min-h-11 rounded-xl border border-line-strong bg-surface px-3 text-base text-ink"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Filtro periodo per i KPI */}
      <fieldset className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
        <legend className="sr-only">Periodo dei KPI</legend>
        <span className="w-full text-sm font-semibold text-ink-2 sm:w-auto sm:self-center">
          {kpiRange ? 'Periodo personalizzato' : `Indicatori di tutto il ${year}`}
        </span>
        <label className="text-xs font-semibold text-ink-3">
          Da
          <input
            type="date"
            value={range?.from ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return setRange(null);
              if (isIsoDate(v)) setRange((r) => ({ from: v, to: r?.to ?? yearRange(year).to }));
            }}
            className="mt-1 block min-h-11 rounded-xl border border-line-strong bg-surface px-3 text-base text-ink sm:text-sm"
          />
        </label>
        <label className="text-xs font-semibold text-ink-3">
          A
          <input
            type="date"
            value={range?.to ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return setRange(null);
              if (isIsoDate(v)) setRange((r) => ({ from: r?.from ?? yearRange(year).from, to: v }));
            }}
            className="mt-1 block min-h-11 rounded-xl border border-line-strong bg-surface px-3 text-base text-ink sm:text-sm"
          />
        </label>
        {range ? (
          <button
            type="button"
            onClick={() => setRange(null)}
            className="min-h-11 rounded-xl px-3 text-sm font-semibold text-plum hover:bg-plum-soft"
          >
            Torna all'anno intero
          </button>
        ) : null}
        {range && !kpiRange ? (
          <p className="w-full text-xs font-semibold text-uscite">
            La data iniziale deve venire prima di quella finale.
          </p>
        ) : null}
      </fieldset>

      {/* KPI principali */}
      <section
        aria-label="Indicatori principali"
        className="mt-6 grid gap-6 rounded-3xl bg-surface px-5 py-6 sm:grid-cols-3 sm:px-7"
      >
        <Hero
          label="Incasso totale"
          value={kpi.entrate}
          sub={
            kpiRange ? (
              `${formatDateIt(kpiRange.from)} – ${formatDateIt(kpiRange.to)}`
            ) : hasPrev ? (
              <>
                <Delta current={kpi.entrate} previous={prevYearSum.entrate} /> rispetto al {year - 1}
              </>
            ) : (
              `${kpi.giorniConEntrate} giorni con entrate`
            )
          }
        />
        <Hero label="Spese totali" value={kpi.uscite} tone="uscite" />
        <Hero label="Ricavo netto" value={kpi.netto} sub="Entrate meno uscite" />
      </section>

      <dl className="mt-4 grid gap-x-8 rounded-2xl border border-line bg-surface px-4 py-2 sm:px-5 md:grid-cols-2">
        <div>
          <ValueRow
            label="Fatturato dichiarato"
            value={formatEuro(kpi.fatturatoDichiarato)}
            tip={fatturatoTip(s)}
          />
          <ValueRow
            label={`IVA totale (${s.vatMode === 'scorporo' ? 'scorporo' : 'aggiunta'} ${formatRate(s.vatRateBps)})`}
            value={formatEuro(kpi.iva)}
            tip={ivaTip(s)}
          />
          <ValueRow
            label="Netto dopo IVA"
            value={formatEuro(kpi.nettoDopoIva)}
            tip="Ricavo netto meno l'IVA."
          />
          <ValueRow
            label="Percentuale varie"
            value={formatPercent(kpi.percVarie)}
            tip="Varie diviso totale entrate."
          />
        </div>
        <div>
          <ValueRow
            label="Incasso medio giornaliero"
            value={formatEuro(kpi.incassoMedioGiornaliero)}
            tip={`Totale dei giorni con entrate diviso per il numero di quei giorni (${kpi.giorniConEntrate}).`}
          />
          <ValueRow label="Totale contanti" value={formatEuro(kpi.contanti)} />
          <ValueRow label="Totale carta" value={formatEuro(kpi.carta)} />
          <ValueRow label="Totale varie" value={formatEuro(kpi.varie)} />
        </div>
      </dl>

      {/* Tabella mensile */}
      <section className="mt-8">
        <h2 className="font-display text-xl font-semibold">Riepilogo mensile</h2>
        {/* Telefono: un mese per riga, tocca per aprire il mese */}
        <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface sm:hidden">
          <div
            className="flex items-center gap-3 border-b border-line px-4 py-2 text-xs font-semibold text-ink-3"
            aria-hidden
          >
            <span className="w-20 shrink-0">Mese</span>
            <span className="flex-1 text-right">Entrate e uscite</span>
            <span className="w-24 shrink-0 text-right">Netto</span>
          </div>
          <ul className="divide-y divide-line">
            {months.map((m, i) => {
              const prev = prevMonths[i]?.summary;
              const empty = m.summary.giorniCompilati === 0;
              const name = MONTH_NAMES[m.month - 1] ?? '';
              return (
                <li key={m.month}>
                  <Link
                    to={`/mese/${year}/${m.month}`}
                    aria-label={
                      empty
                        ? `${name}: nessun dato`
                        : `${name}: entrate ${formatEuro(m.summary.entrate)}, uscite ${formatEuro(m.summary.uscite)}, netto ${formatEuro(m.summary.netto)}`
                    }
                    className={clsx('flex min-h-14 items-center gap-3 px-4 py-2', empty && 'text-ink-3')}
                  >
                    <span className="w-20 shrink-0 font-semibold">{name}</span>
                    {empty ? (
                      <span className="flex-1 text-right text-sm">Nessun dato</span>
                    ) : (
                      <>
                        <span className="min-w-0 flex-1 text-right">
                          <span className="flex items-center justify-end gap-1.5">
                            {prev && prev.giorniCompilati > 0 ? (
                              <Delta current={m.summary.entrate} previous={prev.entrate} />
                            ) : null}
                            <span className="num font-semibold">{formatAmount(m.summary.entrate)}</span>
                          </span>
                          {m.summary.uscite ? (
                            <span className="num block text-xs text-uscite">
                              -{formatAmount(m.summary.uscite)}
                            </span>
                          ) : null}
                        </span>
                        <span
                          className={clsx(
                            'num w-24 shrink-0 text-right font-semibold',
                            m.summary.netto < 0 && 'text-uscite',
                          )}
                        >
                          {formatAmount(m.summary.netto)}
                        </span>
                      </>
                    )}
                  </Link>
                </li>
              );
            })}
            <li className="flex min-h-14 items-center gap-3 bg-surface-2 px-4 py-2 font-bold">
              <span className="w-20 shrink-0">Totale</span>
              <span className="flex-1 text-right">
                <span className="num block">{formatAmount(yearSum.entrate)}</span>
                <span className="num block text-xs text-uscite">-{formatAmount(yearSum.uscite)}</span>
              </span>
              <span className={clsx('num w-24 shrink-0 text-right', yearSum.netto < 0 && 'text-uscite')}>
                {formatAmount(yearSum.netto)}
              </span>
            </li>
          </ul>
        </div>
        <p className="mt-2 text-xs text-ink-3 sm:hidden">
          Imponibile e IVA di ogni mese sono nella pagina del mese e nell'export Excel.
        </p>

        <div className="mt-3 hidden overflow-x-auto rounded-2xl border border-line bg-surface sm:block">
          <table className="w-full min-w-[56rem] text-sm">
            <thead>
              <tr className="border-b border-line text-right text-ink-3">
                <th scope="col" className="px-4 py-2.5 text-left font-semibold">
                  Mese
                </th>
                <th scope="col" className="px-3 py-2.5 font-semibold">
                  Entrate
                </th>
                <th scope="col" className="px-3 py-2.5 font-semibold">
                  Contanti
                </th>
                <th scope="col" className="px-3 py-2.5 font-semibold">
                  Carta
                </th>
                <th scope="col" className="px-3 py-2.5 font-semibold">
                  Varie
                </th>
                <th scope="col" className="px-3 py-2.5 font-semibold">
                  Uscite
                </th>
                <th scope="col" className="px-3 py-2.5 font-semibold">
                  Ricavo netto
                </th>
                <th scope="col" className="px-3 py-2.5 font-semibold">
                  Imponibile
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  IVA
                </th>
              </tr>
            </thead>
            <tbody>
              {months.map((m, i) => {
                const prev = prevMonths[i]?.summary;
                const empty = m.summary.giorniCompilati === 0;
                return (
                  <tr
                    key={m.month}
                    className={clsx('border-b border-line text-right', empty && 'text-ink-3')}
                  >
                    <th scope="row" className="px-4 py-2 text-left font-medium">
                      <Link to={`/mese/${year}/${m.month}`} className="hover:text-plum hover:underline">
                        {MONTH_NAMES[m.month - 1]}
                      </Link>
                    </th>
                    <td className="num px-3 py-2 font-semibold">
                      <span className="flex items-center justify-end gap-2">
                        {prev && prev.giorniCompilati > 0 && !empty ? (
                          <Delta current={m.summary.entrate} previous={prev.entrate} />
                        ) : null}
                        {formatAmount(m.summary.entrate)}
                      </span>
                    </td>
                    <td className="num px-3 py-2">{formatAmount(m.summary.contanti)}</td>
                    <td className="num px-3 py-2">{formatAmount(m.summary.carta)}</td>
                    <td className="num px-3 py-2">{formatAmount(m.summary.varie)}</td>
                    <td className={clsx('num px-3 py-2', m.summary.uscite && 'text-uscite')}>
                      {m.summary.uscite ? `-${formatAmount(m.summary.uscite)}` : formatAmount(0)}
                    </td>
                    <td className={clsx('num px-3 py-2 font-semibold', m.summary.netto < 0 && 'text-uscite')}>
                      {formatAmount(m.summary.netto)}
                    </td>
                    <td className="num px-3 py-2">{formatAmount(m.summary.imponibile)}</td>
                    <td className="num px-4 py-2">{formatAmount(m.summary.iva)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-surface-2 text-right font-bold">
                <th scope="row" className="px-4 py-3 text-left">
                  Totale {year}
                </th>
                <td className="num px-3 py-3">{formatAmount(yearSum.entrate)}</td>
                <td className="num px-3 py-3">{formatAmount(yearSum.contanti)}</td>
                <td className="num px-3 py-3">{formatAmount(yearSum.carta)}</td>
                <td className="num px-3 py-3">{formatAmount(yearSum.varie)}</td>
                <td className="num px-3 py-3 text-uscite">-{formatAmount(yearSum.uscite)}</td>
                <td className={clsx('num px-3 py-3', yearSum.netto < 0 && 'text-uscite')}>
                  {formatAmount(yearSum.netto)}
                </td>
                <td className="num px-3 py-3">{formatAmount(yearSum.imponibile)}</td>
                <td className="num px-4 py-3">{formatAmount(yearSum.iva)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {hasPrev ? (
          <p className="mt-2 text-xs text-ink-3">
            Le percentuali accanto alle entrate confrontano ogni mese con lo stesso mese del {year - 1}.
          </p>
        ) : null}
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-2" aria-label="Grafici annuali">
        <IncomeByMonthChart months={months} />
        <TrendChart months={months} />
        <ExpenseDistributionChart summary={yearSum} categories={all} title="Distribuzione uscite annuali" />
        <MethodsByMonthChart months={months} />
      </section>
    </div>
  );
}
