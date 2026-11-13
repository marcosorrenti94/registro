import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import * as Collapsible from '@radix-ui/react-collapsible';
import { clsx } from 'clsx';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { AmountInput } from '@/components/AmountInput';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import type { Cents, Expense, IsoDate } from '@/domain/types';
import { deleteDraft, readDraft, writeDraft } from '@/data/cache';
import { dayRow } from '@/lib/calc';
import {
  MONTH_NAMES,
  WEEKDAY_NAMES,
  addDays,
  formatDateLong,
  formatDayMonthYear,
  isIsoDate,
  parseIso,
  todayIso,
  weekday,
} from '@/lib/dates';
import { newId } from '@/lib/id';
import { formatEuro } from '@/lib/money';
import { useData } from '@/state/DataContext';
import { useCategories } from '@/state/useCategories';

interface ExpenseDraft {
  id: string;
  categoryId: string;
  amountCents: Cents;
  note: string;
}

interface DayForm {
  contanti: Cents;
  carta: Cents;
  varie: Cents;
  note: string;
  expenses: ExpenseDraft[];
}

const fingerprint = (f: DayForm) =>
  JSON.stringify({ ...f, expenses: f.expenses.filter((e) => e.amountCents > 0 || e.note.trim()) });

export function OggiPage() {
  const params = useParams();
  const date: IsoDate = params.date && isIsoDate(params.date) ? params.date : todayIso();
  // Rimontato a ogni cambio di giorno: il modulo riparte dai dati salvati di quel giorno
  return <DayEditor key={date} date={date} />;
}

function DayEditor({ date }: { date: IsoDate }) {
  const navigate = useNavigate();
  const today = todayIso();
  const { db, update, connectionKey } = useData();
  const { active, byId } = useCategories();

  const row = useMemo(() => dayRow(db, date), [db, date]);
  const saved = useMemo<DayForm>(
    () => ({
      contanti: row.contanti,
      carta: row.carta,
      varie: row.varie,
      note: row.entry?.note ?? '',
      expenses: row.expenses.map((e) => ({
        id: e.id,
        categoryId: e.categoryId,
        amountCents: e.amountCents,
        note: e.note ?? '',
      })),
    }),
    [row],
  );

  const [form, setForm] = useState<DayForm>(saved);
  const [restoredDraft, setRestoredDraft] = useState(false);
  const [expensesOpen, setExpensesOpen] = useState(saved.expenses.length > 0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const loadedFor = useRef<string | null>(null);

  const dirty = fingerprint(form) !== fingerprint(saved);
  const isCompiled = row.status === 'compilato';

  // All'apertura del giorno: riprende l'eventuale bozza non salvata
  useEffect(() => {
    let cancelled = false;
    void readDraft(connectionKey, date).then((payload) => {
      if (cancelled) return;
      loadedFor.current = date;
      if (!payload) return;
      try {
        const draft = JSON.parse(payload) as DayForm;
        if (fingerprint(draft) !== fingerprint(saved)) {
          setForm(draft);
          setRestoredDraft(true);
          if (draft.expenses.length) setExpensesOpen(true);
        }
      } catch {
        /* bozza illeggibile: ignorata */
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo all'apertura del giorno
  }, []);

  // Autosalvataggio della bozza mentre si scrive
  useEffect(() => {
    if (loadedFor.current !== date) return;
    const t = window.setTimeout(() => {
      if (dirty) void writeDraft(connectionKey, date, JSON.stringify(form));
      else void deleteDraft(connectionKey, date);
    }, 400);
    return () => window.clearTimeout(t);
  }, [form, dirty, date, connectionKey]);

  const goTo = useCallback((d: IsoDate) => navigate(d === today ? '/' : `/giorno/${d}`), [navigate, today]);

  const set = <K extends keyof DayForm>(key: K, value: DayForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const setExpense = (id: string, patch: Partial<ExpenseDraft>) =>
    setForm((f) => ({ ...f, expenses: f.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  const addExpense = (categoryId: string) =>
    setForm((f) => ({
      ...f,
      expenses: [...f.expenses, { id: newId(), categoryId, amountCents: 0, note: '' }],
    }));
  const removeExpense = (id: string) =>
    setForm((f) => ({ ...f, expenses: f.expenses.filter((e) => e.id !== id) }));

  const entrate = form.contanti + form.carta + form.varie;
  const uscite = form.expenses.reduce((s, e) => s + e.amountCents, 0);

  async function save() {
    setSaving(true);
    const now = new Date().toISOString();
    const expenses = form.expenses.filter((e) => e.amountCents > 0);
    const ok = await update((d) => {
      d.days[date] = {
        date,
        contantiCents: form.contanti,
        cartaCents: form.carta,
        varieCents: form.varie,
        ...(form.note.trim() ? { note: form.note.trim() } : {}),
        updatedAt: now,
      };
      for (const [id, e] of Object.entries(d.expenses)) if (e.date === date) delete d.expenses[id];
      for (const e of expenses) {
        const prev = db.expenses[e.id];
        const unchanged =
          prev &&
          prev.amountCents === e.amountCents &&
          prev.categoryId === e.categoryId &&
          (prev.note ?? '') === e.note.trim();
        const exp: Expense = {
          id: e.id,
          date,
          categoryId: e.categoryId,
          amountCents: e.amountCents,
          ...(e.note.trim() ? { note: e.note.trim() } : {}),
          updatedAt: unchanged ? prev.updatedAt : now,
        };
        d.expenses[e.id] = exp;
      }
    }, 'Giorno salvato');
    setSaving(false);
    if (ok) {
      await deleteDraft(connectionKey, date);
      setRestoredDraft(false);
    }
  }

  async function removeDay() {
    const ok = await update((d) => {
      delete d.days[date];
      for (const [id, e] of Object.entries(d.expenses)) if (e.date === date) delete d.expenses[id];
    }, 'Giorno eliminato');
    if (ok) await deleteDraft(connectionKey, date);
  }

  const share = (v: Cents) => (entrate > 0 ? `${(v / entrate) * 100}%` : '0%');

  // Scorrimento orizzontale su data e totale: giorno precedente / successivo (una mano, dietro al bancone)
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    const target = e.target as HTMLElement;
    touchStart.current =
      t && !target.closest('input, textarea, button, a') ? { x: t.clientX, y: t.clientY } : null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    const t = e.changedTouches[0];
    touchStart.current = null;
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 40) goTo(addDays(date, dx < 0 ? 1 : -1));
  };
  const { year: y, month: m } = parseIso(date);

  return (
    <div className="mx-auto max-w-xl">
      <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {/* Navigazione tra i giorni */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Giorno precedente"
            onClick={() => goTo(addDays(date, -1))}
          >
            <ChevronLeft className="size-6" aria-hidden />
          </Button>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-sm font-semibold text-ink-2">
              {WEEKDAY_NAMES[weekday(date)]}
              {date === today ? (
                <span className="ml-2 rounded-full bg-plum-soft px-2 py-0.5 text-xs text-plum">Oggi</span>
              ) : null}
            </p>
            <h1 className="font-display text-xl leading-tight font-semibold whitespace-nowrap min-[400px]:text-2xl">
              {formatDayMonthYear(date)}
            </h1>
            <p
              className={clsx(
                'text-xs font-semibold',
                isCompiled ? 'text-ok' : row.status === 'mancante' ? 'text-uscite' : 'text-ink-3',
              )}
            >
              {isCompiled
                ? 'Già compilato'
                : row.status === 'chiuso'
                  ? 'Giorno di chiusura'
                  : row.status === 'mancante'
                    ? 'Da compilare'
                    : 'Non ancora compilato'}
            </p>
            <Link
              to={`/mese/${y}/${m}`}
              className="mt-0.5 inline-flex min-h-8 items-center text-xs font-semibold text-plum underline-offset-2 hover:underline"
            >
              Calendario di {MONTH_NAMES[m - 1]?.toLowerCase()}
            </Link>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Giorno successivo"
            onClick={() => goTo(addDays(date, 1))}
          >
            <ChevronRight className="size-6" aria-hidden />
          </Button>
          <label className="relative">
            <span className="sr-only">Scegli il giorno</span>
            <span className="flex size-11 items-center justify-center rounded-xl text-ink-2 hover:bg-surface-2">
              <CalendarDays className="size-5" aria-hidden />
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && isIsoDate(e.target.value) && goTo(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>

        {restoredDraft ? (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-warn-soft px-4 py-2.5 text-sm text-warn">
            <span>Ho ripreso i dati che non avevi salvato.</span>
            <button
              type="button"
              className="min-h-9 shrink-0 font-semibold underline underline-offset-2"
              onClick={() => {
                setForm(saved);
                setRestoredDraft(false);
                void deleteDraft(connectionKey, date);
              }}
            >
              Scarta
            </button>
          </div>
        ) : null}

        {/* La cassa: totale del giorno in tempo reale */}
        <section
          aria-label="Totale del giorno"
          className="mt-5 rounded-3xl bg-plum px-5 pt-5 pb-4 text-on-plum"
        >
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold opacity-80">Incasso del giorno</p>
              <p
                className="num font-display text-5xl leading-tight font-semibold tracking-tight sm:text-6xl"
                aria-live="polite"
              >
                {formatEuro(entrate)}
              </p>
            </div>
            {uscite > 0 ? (
              <div className="text-right">
                <p className="text-xs font-semibold opacity-80">Uscite</p>
                <p className="num text-lg font-semibold">-{formatEuro(uscite)}</p>
              </div>
            ) : null}
          </div>
          <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-white/20" aria-hidden>
            <span
              className="h-full bg-[#7fd1ab] transition-[width] duration-300"
              style={{ width: share(form.contanti) }}
            />
            <span
              className="h-full bg-[#9cc1f5] transition-[width] duration-300"
              style={{ width: share(form.carta) }}
            />
            <span
              className="h-full bg-[#f0c977] transition-[width] duration-300"
              style={{ width: share(form.varie) }}
            />
          </div>
          <p className="mt-2 text-xs opacity-80">
            Netto del giorno <span className="num font-semibold">{formatEuro(entrate - uscite)}</span>
          </p>
        </section>
      </div>

      {/* Entrate */}
      <div className="mt-6 grid gap-4">
        <AmountInput
          label="Contanti"
          swatch="var(--contanti)"
          value={form.contanti}
          onChange={(v) => set('contanti', v)}
        />
        <AmountInput
          label="Carta"
          swatch="var(--carta)"
          value={form.carta}
          onChange={(v) => set('carta', v)}
        />
        <AmountInput
          label="Varie"
          swatch="var(--varie)"
          value={form.varie}
          onChange={(v) => set('varie', v)}
          hint="Già tassate altrove: non entrano nell'imponibile né nell'IVA."
        />
      </div>

      {/* Uscite */}
      <Collapsible.Root
        open={expensesOpen}
        onOpenChange={setExpensesOpen}
        className="mt-6 rounded-2xl border border-line bg-surface"
      >
        <Collapsible.Trigger className="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left">
          <span className="font-semibold">
            Uscite
            {form.expenses.length ? (
              <span className="ml-2 text-sm font-medium text-ink-3">
                {form.expenses.length} {form.expenses.length === 1 ? 'voce' : 'voci'}
              </span>
            ) : null}
          </span>
          <span className="flex items-center gap-2">
            {uscite > 0 ? <span className="num font-semibold text-uscite">-{formatEuro(uscite)}</span> : null}
            <ChevronDown
              className={clsx('size-5 text-ink-3 transition-transform', expensesOpen && 'rotate-180')}
              aria-hidden
            />
          </span>
        </Collapsible.Trigger>
        <Collapsible.Content className="border-t border-line px-4 pt-4 pb-4">
          {form.expenses.length ? (
            <ul className="mb-5 grid gap-4">
              {form.expenses.map((e) => {
                const cat = byId.get(e.categoryId);
                return (
                  <li key={e.id} className="rounded-xl bg-surface-2 p-3">
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <AmountInput
                          size="md"
                          label={cat?.name ?? 'Categoria eliminata'}
                          swatch={cat?.color}
                          value={e.amountCents}
                          onChange={(v) => setExpense(e.id, { amountCents: v })}
                          autoFocus={e.amountCents === 0 && !e.note}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="mt-6"
                        aria-label={`Rimuovi uscita ${cat?.name ?? ''}`}
                        onClick={() => removeExpense(e.id)}
                      >
                        <X className="size-5" aria-hidden />
                      </Button>
                    </div>
                    <label className="mt-2 block">
                      <span className="sr-only">Nota per {cat?.name}</span>
                      <input
                        value={e.note}
                        onChange={(ev) => setExpense(e.id, { note: ev.target.value })}
                        placeholder="Nota (facoltativa), es. fornitore"
                        className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-base sm:text-sm"
                      />
                    </label>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mb-4 text-sm text-ink-3">Nessuna uscita in questo giorno.</p>
          )}
          <p className="mb-2 text-sm font-semibold text-ink-2">Aggiungi un'uscita</p>
          <div className="flex flex-wrap gap-2">
            {active.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => addExpense(c.id)}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong bg-surface px-3.5 text-sm font-medium hover:border-plum"
              >
                <Plus className="size-4" style={{ color: c.color }} aria-hidden />
                {c.name}
              </button>
            ))}
          </div>
        </Collapsible.Content>
      </Collapsible.Root>

      <label className="mt-6 block">
        <span className="text-sm font-semibold text-ink-2">Nota del giorno</span>
        <textarea
          value={form.note}
          onChange={(e) => set('note', e.target.value)}
          rows={2}
          className="mt-1.5 w-full rounded-xl border border-line-strong bg-surface px-4 py-3 text-base"
        />
      </label>

      {isCompiled ? (
        <Button variant="ghost" className="mt-4 -ml-2 text-uscite" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="size-4" aria-hidden />
          Elimina il giorno
        </Button>
      ) : null}

      {/* Salvataggio sempre a portata di pollice */}
      <div className="save-bar sticky z-20 mt-6">
        <Button
          size="lg"
          className="w-full justify-center shadow-lg"
          disabled={saving || (!dirty && isCompiled)}
          onClick={() => {
            if (form.expenses.some((e) => e.amountCents === 0 && !e.note.trim())) {
              toast.info('Le uscite senza importo non vengono salvate');
            }
            void save();
          }}
        >
          {saving
            ? 'Salvo…'
            : isCompiled && !dirty
              ? 'Salvato'
              : isCompiled
                ? 'Salva le modifiche'
                : 'Salva il giorno'}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Eliminare il giorno?"
        description={`Vengono eliminate entrate, uscite e nota di ${formatDateLong(date).toLowerCase()}. Non si può annullare.`}
        confirmLabel="Elimina il giorno"
        onConfirm={() => void removeDay()}
      />
    </div>
  );
}
