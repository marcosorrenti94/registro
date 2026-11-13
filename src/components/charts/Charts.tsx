import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { clsx } from 'clsx';
import type { Category } from '@/domain/types';
import type { MonthSummary, PeriodSummary } from '@/lib/calc';
import { CATEGORY_SLOTS, INCOME_COLOR, OTHER_COLOR, TREND_COLOR, categoryColor, pick } from '@/lib/colors';
import { MONTH_NAMES, MONTH_SHORT } from '@/lib/dates';
import { formatEuro, formatPercent } from '@/lib/money';
import { AXIS_PROPS, ChartCard, ToggleLegend, TooltipBox, axisEuro, useIsDark, useToggleSet } from './base';

const INCOME_SERIES = [
  { key: 'contanti', name: 'Contanti' },
  { key: 'carta', name: 'Carta' },
  { key: 'varie', name: 'Varie' },
] as const;

type IncomeKey = (typeof INCOME_SERIES)[number]['key'];

interface MonthPoint {
  label: string;
  fullLabel: string;
  contanti: number;
  carta: number;
  varie: number;
  entrate: number;
  uscite: number;
  netto: number;
}

function toPoints(months: MonthSummary[]): MonthPoint[] {
  return months.map((m) => ({
    label: MONTH_SHORT[m.month - 1] ?? '',
    fullLabel: `${MONTH_NAMES[m.month - 1] ?? ''} ${m.year}`,
    contanti: m.summary.contanti,
    carta: m.summary.carta,
    varie: m.summary.varie,
    entrate: m.summary.entrate,
    uscite: m.summary.uscite,
    netto: m.summary.netto,
  }));
}

interface RechartsTooltipProps {
  active?: boolean;
  payload?: readonly { payload?: unknown }[];
}

function pointOf(props: RechartsTooltipProps): MonthPoint | null {
  const p = props.payload?.[0]?.payload;
  return props.active && p ? (p as MonthPoint) : null;
}

const CHART_H = 260;

/** Entrate per mese, impilate per metodo di pagamento: l'altezza della barra è il totale. */
export function IncomeByMonthChart({ months }: { months: MonthSummary[] }) {
  const dark = useIsDark();
  const data = useMemo(() => toPoints(months), [months]);
  const [hidden, toggle] = useToggleSet();
  const isEmpty = data.every((d) => d.entrate === 0);
  const visible = INCOME_SERIES.filter((s) => !hidden.has(s.key));
  const last = visible[visible.length - 1]?.key;
  return (
    <ChartCard title="Entrate per mese" description="Contanti, carta e varie impilati" isEmpty={isEmpty}>
      <ToggleLegend
        items={INCOME_SERIES.map((s) => ({
          key: s.key,
          name: s.name,
          color: pick(INCOME_COLOR[s.key], dark),
        }))}
        hidden={hidden}
        onToggle={toggle}
      />
      <ResponsiveContainer width="100%" height={CHART_H}>
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="label" {...AXIS_PROPS} minTickGap={6} />
          <YAxis {...AXIS_PROPS} tickFormatter={axisEuro} width={64} />
          <Tooltip
            cursor={{ fill: 'var(--surface-2)' }}
            content={(props: RechartsTooltipProps) => {
              const p = pointOf(props);
              if (!p) return null;
              return (
                <TooltipBox
                  title={p.fullLabel}
                  rows={visible.map((s) => ({
                    name: s.name,
                    value: p[s.key],
                    color: pick(INCOME_COLOR[s.key], dark),
                  }))}
                  footer={
                    <span className="flex justify-between gap-4">
                      Totale <span className="num font-semibold text-ink">{formatEuro(p.entrate)}</span>
                    </span>
                  }
                />
              );
            }}
          />
          {visible.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name}
              stackId="entrate"
              fill={pick(INCOME_COLOR[s.key], dark)}
              stroke="var(--surface)"
              strokeWidth={2}
              radius={s.key === last ? [4, 4, 0, 0] : 0}
              maxBarSize={44}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** Contanti vs Carta vs Varie per mese, barre affiancate. */
export function MethodsByMonthChart({ months }: { months: MonthSummary[] }) {
  const dark = useIsDark();
  const data = useMemo(() => toPoints(months).filter((d) => d.entrate > 0), [months]);
  const [hidden, toggle] = useToggleSet();
  const visible = INCOME_SERIES.filter((s) => !hidden.has(s.key));
  return (
    <ChartCard
      title="Contanti, carta e varie"
      description="Confronto dei metodi nei mesi con entrate"
      isEmpty={data.length === 0}
    >
      <ToggleLegend
        items={INCOME_SERIES.map((s) => ({
          key: s.key,
          name: s.name,
          color: pick(INCOME_COLOR[s.key], dark),
        }))}
        hidden={hidden}
        onToggle={toggle}
      />
      <ResponsiveContainer width="100%" height={CHART_H}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
          barCategoryGap="22%"
          barGap={2}
        >
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="label" {...AXIS_PROPS} />
          <YAxis {...AXIS_PROPS} tickFormatter={axisEuro} width={64} />
          <Tooltip
            cursor={{ fill: 'var(--surface-2)' }}
            content={(props: RechartsTooltipProps) => {
              const p = pointOf(props);
              if (!p) return null;
              return (
                <TooltipBox
                  title={p.fullLabel}
                  rows={visible.map((s) => ({
                    name: s.name,
                    value: p[s.key],
                    color: pick(INCOME_COLOR[s.key], dark),
                  }))}
                />
              );
            }}
          />
          {visible.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name}
              fill={pick(INCOME_COLOR[s.key], dark)}
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

const TREND_VIEWS = {
  andamento: [
    { key: 'entrate', name: 'Entrate', dashed: false },
    { key: 'uscite', name: 'Uscite', dashed: false },
    { key: 'netto', name: 'Ricavo netto', dashed: true },
  ],
  metodi: [
    { key: 'contanti', name: 'Contanti', dashed: false },
    { key: 'carta', name: 'Carta', dashed: false },
    { key: 'varie', name: 'Varie', dashed: false },
  ],
} as const;

type TrendKey = 'entrate' | 'uscite' | 'netto' | IncomeKey;

function trendColor(key: TrendKey, dark: boolean): string {
  if (key === 'entrate' || key === 'uscite' || key === 'netto') return pick(TREND_COLOR[key], dark);
  return pick(INCOME_COLOR[key], dark);
}

/** Trend mensile: due viste da tre serie ciascuna, per restare leggibile. */
export function TrendChart({ months }: { months: MonthSummary[] }) {
  const dark = useIsDark();
  const [view, setView] = useState<keyof typeof TREND_VIEWS>('andamento');
  const [hidden, toggle] = useToggleSet();
  // I mesi senza dati diventano buchi nella linea, non zeri
  const data = useMemo(
    () =>
      toPoints(months).map((p, i) =>
        months[i]?.summary.giorniCompilati
          ? p
          : { ...p, contanti: null, carta: null, varie: null, entrate: null, uscite: null, netto: null },
      ),
    [months],
  );
  const series = TREND_VIEWS[view];
  const visible = series.filter((s) => !hidden.has(s.key));
  const isEmpty = months.every((m) => m.summary.giorniCompilati === 0);

  return (
    <ChartCard
      title="Trend mensile"
      description="I mesi senza dati restano vuoti"
      isEmpty={isEmpty}
      action={
        <div role="tablist" aria-label="Vista del trend" className="flex rounded-xl bg-surface-2 p-1">
          {(
            [
              ['andamento', 'Andamento'],
              ['metodi', 'Per metodo'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              type="button"
              aria-selected={view === k}
              onClick={() => setView(k)}
              className={clsx(
                'min-h-9 rounded-lg px-3 text-sm font-semibold',
                view === k ? 'bg-surface text-ink shadow-sm' : 'text-ink-3',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      }
    >
      <ToggleLegend
        items={series.map((s) => ({
          key: s.key,
          name: s.name,
          color: trendColor(s.key, dark),
          dashed: s.dashed,
        }))}
        hidden={hidden}
        onToggle={toggle}
      />
      <ResponsiveContainer width="100%" height={CHART_H}>
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="label" {...AXIS_PROPS} minTickGap={6} />
          <YAxis {...AXIS_PROPS} tickFormatter={axisEuro} width={64} />
          <Tooltip
            cursor={{ stroke: 'var(--line-strong)', strokeWidth: 1 }}
            content={(props: RechartsTooltipProps) => {
              const p = pointOf(props) as
                (Omit<MonthPoint, TrendKey> & Record<TrendKey, number | null>) | null;
              if (!p || p.entrate === null) return null;
              return (
                <TooltipBox
                  title={p.fullLabel}
                  rows={visible.map((s) => ({
                    name: s.name,
                    value: p[s.key] ?? 0,
                    color: trendColor(s.key, dark),
                    dashed: s.dashed,
                  }))}
                />
              );
            }}
          />
          {visible.map((s) => (
            <Line
              key={s.key}
              type="linear"
              connectNulls={false}
              dataKey={s.key}
              name={s.name}
              stroke={trendColor(s.key, dark)}
              strokeWidth={2}
              strokeDasharray={s.dashed ? '6 4' : undefined}
              dot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)', fill: trendColor(s.key, dark) }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--surface)' }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

interface Slice {
  key: string;
  name: string;
  value: number;
  color: string;
}

/** Ciambella con legenda-tabella: nome, importo e quota sempre scritti accanto al colore. */
function Donut({ slices, total, centerLabel }: { slices: Slice[]; total: number; centerLabel: string }) {
  return (
    <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,13rem)_1fr]">
      <div className="relative mx-auto aspect-square w-full max-w-52">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="100%"
              stroke="var(--surface)"
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
            >
              {slices.map((s) => (
                <Cell key={s.key} fill={s.color} />
              ))}
            </Pie>
            <Tooltip
              content={(props: RechartsTooltipProps) => {
                const s = props.active ? (props.payload?.[0]?.payload as Slice | undefined) : undefined;
                if (!s) return null;
                return (
                  <TooltipBox
                    title={s.name}
                    rows={[{ name: formatPercent(s.value / total), value: s.value, color: s.color }]}
                  />
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xs text-ink-3">{centerLabel}</span>
          <span className="num font-display text-lg font-semibold">{formatEuro(total)}</span>
        </div>
      </div>
      <table className="w-full text-sm">
        <caption className="sr-only">{centerLabel} per voce</caption>
        <tbody>
          {slices.map((s) => (
            <tr key={s.key} className="border-b border-line last:border-0">
              <th scope="row" className="py-2 text-left font-medium text-ink-2">
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block size-2.5 shrink-0 rounded-sm"
                    style={{ background: s.color }}
                  />
                  {s.name}
                </span>
              </th>
              <td className="num py-2 text-right font-semibold">{formatEuro(s.value)}</td>
              <td className="num w-16 py-2 text-right text-ink-3">{formatPercent(s.value / total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Distribuzione delle entrate (Contanti / Carta / Varie). */
export function IncomeDistributionChart({ summary }: { summary: PeriodSummary }) {
  const dark = useIsDark();
  const slices: Slice[] = INCOME_SERIES.map((s) => ({
    key: s.key,
    name: s.name,
    value: summary[s.key],
    color: pick(INCOME_COLOR[s.key], dark),
  })).filter((s) => s.value > 0);
  return (
    <ChartCard
      title="Distribuzione entrate"
      isEmpty={summary.entrate === 0}
      emptyText="Nessuna entrata in questo periodo."
    >
      <Donut slices={slices} total={summary.entrate} centerLabel="Entrate" />
    </ChartCard>
  );
}

/** Uscite per categoria ordinate per importo; oltre 8 categorie le minori finiscono in "Altre". */
function expenseSlices(summary: PeriodSummary, categories: Category[], dark: boolean): Slice[] {
  const order = new Map(categories.map((c, i) => [c.id, i]));
  const rows = Object.entries(summary.uscitePerCategoria)
    .filter(([, v]) => v > 0)
    .map(([id, value]) => {
      const cat = categories.find((c) => c.id === id);
      const idx = order.get(id) ?? 99;
      const color = cat
        ? categoryColor(cat.color, dark)
        : pick(idx < CATEGORY_SLOTS.length ? (CATEGORY_SLOTS[idx] ?? OTHER_COLOR) : OTHER_COLOR, dark);
      return { key: id, name: cat?.name ?? 'Categoria eliminata', value, color };
    })
    .sort((a, b) => b.value - a.value);
  if (rows.length <= 8) return rows;
  const rest = rows.slice(7).reduce((s, r) => s + r.value, 0);
  return [
    ...rows.slice(0, 7),
    { key: '_altre', name: 'Altre categorie', value: rest, color: pick(OTHER_COLOR, dark) },
  ];
}

export function ExpenseDistributionChart({
  summary,
  categories,
  title = 'Distribuzione uscite',
}: {
  summary: PeriodSummary;
  categories: Category[];
  title?: string;
}) {
  const dark = useIsDark();
  const slices = expenseSlices(summary, categories, dark);
  return (
    <ChartCard title={title} isEmpty={summary.uscite === 0} emptyText="Nessuna uscita in questo periodo.">
      <Donut slices={slices} total={summary.uscite} centerLabel="Uscite" />
    </ChartCard>
  );
}

/** Uscite per categoria come barre orizzontali con valori scritti. */
export function ExpenseByCategoryChart({
  summary,
  categories,
}: {
  summary: PeriodSummary;
  categories: Category[];
}) {
  const dark = useIsDark();
  const slices = expenseSlices(summary, categories, dark);
  return (
    <ChartCard
      title="Uscite per categoria"
      isEmpty={summary.uscite === 0}
      emptyText="Nessuna uscita in questo mese."
    >
      <ResponsiveContainer width="100%" height={Math.max(120, slices.length * 44)}>
        <BarChart
          data={slices}
          layout="vertical"
          margin={{ top: 0, right: 84, left: 0, bottom: 0 }}
          barCategoryGap={8}
        >
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" {...AXIS_PROPS} width={120} />
          <Tooltip
            cursor={{ fill: 'var(--surface-2)' }}
            content={(props: RechartsTooltipProps) => {
              const s = props.active ? (props.payload?.[0]?.payload as Slice | undefined) : undefined;
              if (!s) return null;
              return (
                <TooltipBox
                  title={s.name}
                  rows={[{ name: formatPercent(s.value / summary.uscite), value: s.value, color: s.color }]}
                />
              );
            }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={26} isAnimationActive={false}>
            {slices.map((s) => (
              <Cell key={s.key} fill={s.color} />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              formatter={(v: unknown) => formatEuro(Number(v))}
              style={{ fill: 'var(--ink)', fontSize: 13, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
