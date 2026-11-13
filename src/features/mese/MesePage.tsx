import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ExpenseByCategoryChart, IncomeDistributionChart } from '@/components/charts/Charts';
import { PeriodPanel } from '@/components/Summary';
import { Button } from '@/components/ui/Button';
import { monthRows, previousYearMonth, summarize, type DayRow } from '@/lib/calc';
import {
  MONTH_NAMES,
  WEEKDAY_SHORT_MON_FIRST,
  formatDateIt,
  monthRange,
  parseIso,
  todayIso,
  weekday,
  weekdayMonFirst,
} from '@/lib/dates';
import { formatAmount, formatEuro, formatWhole } from '@/lib/money';
import { useData } from '@/state/DataContext';
import { rememberMonth } from '@/state/navMemory';
import { useCategories } from '@/state/useCategories';

const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'] as const;

function dayHref(date: string) {
  return date === todayIso() ? '/' : `/giorno/${date}`;
}

function Calendar({ rows }: { rows: DayRow[] }) {
  const first = rows[0];
  const lead = first ? weekdayMonFirst(first.date) : 0;
  const today = todayIso();
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 pb-1 text-center text-xs font-semibold text-ink-3" aria-hidden>
        {WEEKDAY_SHORT_MON_FIRST.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <ol className="grid grid-cols-7 gap-1" aria-label="Giorni del mese">
        {Array.from({ length: lead }, (_, i) => (
          <li key={`lead-${i}`} aria-hidden />
        ))}
        {rows.map((r) => {
          const { day } = parseIso(r.date);
          const label =
            r.status === 'compilato'
              ? `${day}: entrate ${formatEuro(r.entrate)}${r.uscite ? `, uscite ${formatEuro(r.uscite)}` : ''}`
              : `${day}: ${r.status === 'mancante' ? 'da compilare' : r.status === 'chiuso' ? 'chiuso' : 'non ancora compilato'}`;
          return (
            <li key={r.date}>
              <Link
                to={dayHref(r.date)}
                aria-label={label}
                className={clsx(
                  'flex aspect-[4/5] min-h-14 flex-col justify-between rounded-lg p-1.5 text-left transition-colors sm:aspect-[5/4] sm:p-2',
                  r.status === 'compilato' && 'border border-line bg-surface hover:border-plum',
                  r.status === 'mancante' &&
                    'border border-dashed border-uscite/70 bg-uscite-soft/40 hover:bg-uscite-soft',
                  r.status === 'chiuso' &&
                    'hatch border border-transparent text-ink-3 hover:border-line-strong',
                  r.status === 'futuro' && 'border border-line/60 text-ink-3 hover:border-line-strong',
                  r.date === today && 'ring-2 ring-plum ring-offset-1 ring-offset-paper',
                )}
              >
                <span
                  className={clsx(
                    'text-xs font-semibold sm:text-sm',
                    r.status === 'mancante' && 'text-uscite',
                  )}
                >
                  {day}
                </span>
                {r.status === 'compilato' ? (
                  <span className="min-w-0">
                    <span className="num block truncate text-xs font-semibold text-ink sm:text-sm">
                      <span className="sm:hidden">{r.entrate ? formatWhole(r.entrate) : '—'}</span>
                      <span className="hidden sm:inline">{r.entrate ? formatAmount(r.entrate) : '—'}</span>
                    </span>
                    {r.uscite ? (
                      <span className="num block truncate text-[11px] font-medium text-uscite sm:text-xs">
                        <span className="sm:hidden">-{formatWhole(r.uscite)}</span>
                        <span className="hidden sm:inline">-{formatAmount(r.uscite)}</span>
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ol>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-3 rounded border border-line bg-surface" /> Compilato
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-3 rounded border border-dashed border-uscite" /> Da
          compilare
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="hatch inline-block size-3 rounded" /> Chiuso
        </li>
      </ul>
    </div>
  );
}

function DayTable({ rows }: { rows: DayRow[] }) {
  const navigate = useNavigate();
  const visible = rows.filter((r) => r.status === 'compilato' || r.status === 'mancante');
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full min-w-[34rem] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-ink-3">
            <th scope="col" className="px-4 py-2.5 font-semibold">
              Giorno
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">
              Contanti
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">
              Carta
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">
              Varie
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">
              Entrate
            </th>
            <th scope="col" className="px-4 py-2.5 text-right font-semibold">
              Uscite
            </th>
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => (
            <tr
              key={r.date}
              onClick={() => navigate(dayHref(r.date))}
              className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-2"
            >
              <th scope="row" className="px-4 py-2 text-left font-medium">
                <Link to={dayHref(r.date)} className="hover:underline">
                  {WEEKDAY_SHORT[weekday(r.date)]} {formatDateIt(r.date)}
                </Link>
                {r.status === 'mancante' ? (
                  <span className="ml-2 text-xs font-semibold text-uscite">da compilare</span>
                ) : null}
              </th>
              <td className="num px-3 py-2 text-right">{r.contanti ? formatAmount(r.contanti) : ''}</td>
              <td className="num px-3 py-2 text-right">{r.carta ? formatAmount(r.carta) : ''}</td>
              <td className="num px-3 py-2 text-right">{r.varie ? formatAmount(r.varie) : ''}</td>
              <td className="num px-3 py-2 text-right font-semibold">
                {r.entrate ? formatAmount(r.entrate) : ''}
              </td>
              <td className="num px-4 py-2 text-right text-uscite">
                {r.uscite ? `-${formatAmount(r.uscite)}` : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MesePage() {
  const params = useParams();
  const navigate = useNavigate();
  const { db } = useData();
  const { all } = useCategories();
  const now = parseIso(todayIso());
  const year = Number(params.year) || now.year;
  const month = Math.min(12, Math.max(1, Number(params.month) || now.month));
  const [view, setView] = useState<'calendario' | 'tabella'>('calendario');
  useEffect(() => rememberMonth(year, month), [year, month]);

  const rows = useMemo(() => monthRows(db, year, month), [db, year, month]);
  const summary = useMemo(() => summarize(db, monthRange(year, month)), [db, year, month]);
  const previous = useMemo(() => previousYearMonth(db, year, month), [db, year, month]);
  const missing = rows.filter((r) => r.status === 'mancante').length;
  const compiled = rows.filter((r) => r.status === 'compilato').length;

  const go = (delta: number) => {
    const m = month + delta;
    const y = year + Math.floor((m - 1) / 12);
    const mm = ((((m - 1) % 12) + 12) % 12) + 1;
    navigate(`/mese/${y}/${mm}`);
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Mese precedente" onClick={() => go(-1)}>
          <ChevronLeft className="size-6" aria-hidden />
        </Button>
        <h1 className="flex-1 text-center font-display text-2xl font-semibold sm:flex-none sm:text-3xl">
          {MONTH_NAMES[month - 1]} {year}
        </h1>
        <Button variant="ghost" size="icon" aria-label="Mese successivo" onClick={() => go(1)}>
          <ChevronRight className="size-6" aria-hidden />
        </Button>
      </div>
      <p className="mt-1 text-center text-sm text-ink-2 sm:text-left">
        {compiled} {compiled === 1 ? 'giorno compilato' : 'giorni compilati'}
        {missing ? (
          <>
            {', '}
            <span className="font-semibold text-uscite">{missing} da compilare</span>
          </>
        ) : null}
      </p>
      {year !== now.year || month !== now.month ? (
        <p className="mt-1 text-center sm:text-left">
          <Link
            to={`/mese/${now.year}/${now.month}`}
            className="inline-flex min-h-9 items-center text-sm font-semibold text-plum underline-offset-2 hover:underline"
          >
            Torna a {MONTH_NAMES[now.month - 1]?.toLowerCase()} {now.year}
          </Link>
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <section aria-label="Giorni del mese">
          <div
            role="tablist"
            aria-label="Vista dei giorni"
            className="mb-3 inline-flex rounded-xl bg-surface-2 p-1"
          >
            {(['calendario', 'tabella'] as const).map((v) => (
              <button
                key={v}
                role="tab"
                type="button"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={clsx(
                  'min-h-9 rounded-lg px-4 text-sm font-semibold capitalize',
                  view === v ? 'bg-surface text-ink shadow-sm' : 'text-ink-3',
                )}
              >
                {v}
              </button>
            ))}
          </div>
          {view === 'calendario' ? <Calendar rows={rows} /> : <DayTable rows={rows} />}
        </section>
        <div className="grid content-start gap-4">
          <PeriodPanel
            summary={summary}
            settings={db.settings}
            previous={previous}
            previousLabel={`${MONTH_NAMES[month - 1]?.toLowerCase()} ${year - 1}`}
            className="md:grid-cols-2 xl:grid-cols-1"
          />
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <IncomeDistributionChart summary={summary} />
        <ExpenseByCategoryChart summary={summary} categories={all} />
      </div>
    </div>
  );
}
