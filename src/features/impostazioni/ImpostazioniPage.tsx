import { useState, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { Archive, ArchiveRestore, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Switch } from '@/components/ui/Switch';
import type { Category } from '@/domain/types';
import { clearCache } from '@/data/cache';
import { CATEGORY_SLOTS, OTHER_COLOR } from '@/lib/colors';
import { WEEKDAY_NAMES } from '@/lib/dates';
import { newId } from '@/lib/id';
import { formatRate } from '@/lib/money';
import { useData } from '@/state/DataContext';
import { useTheme, type ThemePref } from '@/state/theme';
import { useCategories } from '@/state/useCategories';
import { DataSection } from './DataSection';

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-line py-6 last:border-0">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      {description ? <p className="mt-1 max-w-prose text-sm text-ink-2">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const inputCls =
  'min-h-11 rounded-xl border border-line-strong bg-surface px-3 text-base text-ink focus:border-plum';

/** Campo di testo che salva quando si esce dal campo o si preme Invio. */
function CommitInput({
  value,
  onCommit,
  label,
  className,
}: {
  value: string;
  onCommit: (v: string) => void;
  label: string;
  className?: string;
}) {
  const [text, setText] = useState(value);
  const commit = () => {
    const v = text.trim();
    if (!v) setText(value);
    else if (v !== value) onCommit(v);
  };
  return (
    <input
      aria-label={label}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
      className={clsx(inputCls, className)}
    />
  );
}

function VatRateInput({ bps }: { bps: number }) {
  const { update } = useData();
  const [rate, setRate] = useState(String(bps / 100).replace('.', ','));
  const commitRate = () => {
    const n = Number(rate.replace(',', '.'));
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      toast.error('Aliquota non valida', { description: 'Scrivi un numero tra 0 e 100, ad esempio 22.' });
      setRate(String(bps / 100).replace('.', ','));
      return;
    }
    const next = Math.round(n * 100);
    if (next !== bps)
      void update((d) => void (d.settings.vatRateBps = next), `Aliquota IVA: ${formatRate(next)}`);
  };
  return (
    <label className="block max-w-48">
      <span className="text-sm font-semibold text-ink-2">Aliquota (%)</span>
      <input
        inputMode="decimal"
        value={rate}
        onChange={(e) => setRate(e.target.value)}
        onBlur={commitRate}
        onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
        className={clsx(inputCls, 'num mt-1.5 w-full')}
      />
    </label>
  );
}

function VatSection() {
  const { db, update } = useData();
  const s = db.settings;
  const scorporo = s.vatMode === 'scorporo';
  return (
    <Section
      title="IVA"
      description="Contanti e carta sono incassi lordi. Le varie non entrano mai nell'imponibile né nell'IVA."
    >
      <div className="grid gap-5">
        <VatRateInput key={s.vatRateBps} bps={s.vatRateBps} />
        <div className="flex items-start justify-between gap-4 rounded-2xl border border-line bg-surface p-4">
          <div>
            <p id="vat-mode-label" className="font-semibold">
              Modalità di calcolo IVA: {scorporo ? 'scorporo (IVA inclusa)' : 'aggiunta'}
            </p>
            <p className="mt-1 text-sm text-ink-2">
              {scorporo
                ? "L'IVA è già dentro gli incassi: IVA = lordo − lordo / (1 + aliquota). È il calcolo corretto per gli scontrini."
                : "L'IVA viene aggiunta sopra gli incassi: IVA = lordo × aliquota. È il calcolo del vecchio Excel, utile per confronto."}
            </p>
          </div>
          <Switch
            checked={scorporo}
            label="Scorporo (IVA inclusa)"
            onCheckedChange={(v) =>
              void update(
                (d) => void (d.settings.vatMode = v ? 'scorporo' : 'aggiunta'),
                v ? 'IVA in scorporo' : 'IVA in aggiunta',
              )
            }
          />
        </div>
      </div>
    </Section>
  );
}

function CategoriesSection() {
  const { db, update } = useData();
  const { all } = useCategories();
  const [newName, setNewName] = useState('');
  const [toDelete, setToDelete] = useState<Category | null>(null);
  const used = new Set(Object.values(db.expenses).map((e) => e.categoryId));

  function add() {
    const name = newName.trim();
    if (!name) return;
    if (all.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      toast.error('Esiste già una categoria con questo nome');
      return;
    }
    const taken = new Set(all.filter((c) => !c.archived).map((c) => c.color.toLowerCase()));
    const color = CATEGORY_SLOTS.find((s) => !taken.has(s.light.toLowerCase()))?.light ?? OTHER_COLOR.light;
    const order = Math.max(-1, ...all.map((c) => c.order)) + 1;
    const id = newId();
    void update(
      (d) => void (d.categories[id] = { id, name, color, order, archived: false }),
      `Categoria «${name}» aggiunta`,
    );
    setNewName('');
  }

  return (
    <Section
      title="Categorie di uscita"
      description="Le categorie già usate non si possono eliminare: archiviale per toglierle dall'inserimento giornaliero, lo storico resta intatto."
    >
      <ul className="grid gap-2">
        {all.map((c) => (
          <li
            key={c.id}
            className={clsx(
              'flex items-center gap-3 rounded-xl border border-line bg-surface p-2 pl-3',
              c.archived && 'opacity-70',
            )}
          >
            <span
              aria-hidden
              className="inline-block size-3.5 shrink-0 rounded"
              style={{ background: c.color }}
            />
            <CommitInput
              key={c.name}
              label={`Nome della categoria ${c.name}`}
              value={c.name}
              className="min-w-0 flex-1"
              onCommit={(name) =>
                void update((d) => {
                  const cat = d.categories[c.id];
                  if (cat) cat.name = name;
                }, 'Categoria rinominata')
              }
            />
            {c.archived ? (
              <span className="hidden text-xs font-semibold text-ink-3 sm:inline">Archiviata</span>
            ) : null}
            {used.has(c.id) ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label={c.archived ? `Ripristina ${c.name}` : `Archivia ${c.name}`}
                title={c.archived ? 'Ripristina' : 'Archivia'}
                onClick={() =>
                  void update(
                    (d) => {
                      const cat = d.categories[c.id];
                      if (cat) cat.archived = !c.archived;
                    },
                    c.archived ? 'Categoria ripristinata' : 'Categoria archiviata',
                  )
                }
              >
                {c.archived ? (
                  <ArchiveRestore className="size-5" aria-hidden />
                ) : (
                  <Archive className="size-5" aria-hidden />
                )}
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Elimina ${c.name}`}
                title="Elimina"
                onClick={() => setToDelete(c)}
              >
                <Trash2 className="size-5" aria-hidden />
              </Button>
            )}
          </li>
        ))}
      </ul>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">Nome della nuova categoria</span>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nuova categoria"
            className={clsx(inputCls, 'w-full')}
          />
        </label>
        <Button type="submit" variant="secondary" disabled={!newName.trim()}>
          <Plus className="size-4" aria-hidden />
          Aggiungi
        </Button>
      </form>
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Eliminare la categoria?"
        description={`«${toDelete?.name ?? ''}» non è mai stata usata e verrà rimossa.`}
        confirmLabel="Elimina la categoria"
        onConfirm={() => {
          const id = toDelete?.id;
          if (id) void update((d) => void delete d.categories[id], 'Categoria eliminata');
        }}
      />
    </Section>
  );
}

function ConnectionSection() {
  const { connection, disconnect, pending } = useData();
  const [confirm, setConfirm] = useState(false);
  const [theme, setTheme] = useTheme();
  return (
    <>
      <Section title="Aspetto">
        <div role="radiogroup" aria-label="Tema" className="inline-flex rounded-xl bg-surface-2 p-1">
          {(
            [
              ['system', 'Automatico'],
              ['light', 'Chiaro'],
              ['dark', 'Scuro'],
            ] as [ThemePref, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={theme === k}
              onClick={() => setTheme(k)}
              className={clsx(
                'min-h-10 rounded-lg px-4 text-sm font-semibold',
                theme === k ? 'bg-surface text-ink shadow-sm' : 'text-ink-3',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </Section>
      <Section
        title="Accesso ai dati"
        description={
          connection.kind === 'github'
            ? `I dati sono nel repository privato ${connection.owner}/${connection.repo}. Il token è salvato solo su questo dispositivo.`
            : 'Anteprima: i dati sono salvati solo in questo browser.'
        }
      >
        <Button variant="secondary" onClick={() => setConfirm(true)}>
          Esci da questo dispositivo
        </Button>
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          title="Uscire da questo dispositivo?"
          description={
            connection.kind === 'local'
              ? 'I dati dell’anteprima salvati in questo browser verranno cancellati.'
              : pending
                ? 'Ci sono modifiche non ancora sincronizzate: uscendo andranno perse. Collegati a internet e attendi la sincronizzazione prima di uscire.'
                : 'Il token e la copia locale dei dati vengono rimossi da questo dispositivo. I dati restano nel repository privato.'
          }
          confirmLabel="Esci"
          onConfirm={() => {
            void clearCache().then(disconnect);
          }}
        />
      </Section>
    </>
  );
}

export function ImpostazioniPage() {
  const { db, update } = useData();
  const s = db.settings;
  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-3xl font-semibold">Impostazioni</h1>

      <Section title="Attività">
        <label className="block max-w-md">
          <span className="text-sm font-semibold text-ink-2">Nome dell'attività</span>
          <CommitInput
            key={s.businessName}
            label="Nome dell'attività"
            value={s.businessName}
            className="mt-1.5 w-full"
            onCommit={(name) => void update((d) => void (d.settings.businessName = name), 'Nome salvato')}
          />
        </label>
        <fieldset className="mt-5">
          <legend className="text-sm font-semibold text-ink-2">Giorni di chiusura settimanale</legend>
          <p className="mt-1 text-xs text-ink-3">
            Nel calendario non vengono segnalati come giorni da compilare.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
              const on = s.closedWeekdays.includes(wd);
              return (
                <label
                  key={wd}
                  className={clsx(
                    'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-medium',
                    on ? 'border-plum bg-plum-soft text-plum' : 'border-line-strong text-ink-2',
                  )}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={on}
                    onChange={() =>
                      void update((d) => {
                        d.settings.closedWeekdays = on
                          ? d.settings.closedWeekdays.filter((x) => x !== wd)
                          : [...d.settings.closedWeekdays, wd].sort();
                      })
                    }
                  />
                  {WEEKDAY_NAMES[wd]}
                </label>
              );
            })}
          </div>
        </fieldset>
      </Section>

      <VatSection />
      <CategoriesSection />
      <Section title="Import ed export">
        <DataSection />
      </Section>
      <ConnectionSection />
    </div>
  );
}
