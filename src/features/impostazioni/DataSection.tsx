import { useRef, useState } from 'react';
import { Download, FileSpreadsheet, FileJson, FileText, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import type { Database } from '@/domain/types';
import { createBackup, parseBackup } from '@/io/backupJson';
import { exportMovementsCsv } from '@/io/exportCsv';
import {
  applyImport,
  buildImportPlan,
  parseRegistroXlsx,
  type ImportPlanItem,
  type ImportResult,
} from '@/io/importXlsx';
import { availableYears } from '@/lib/calc';
import { formatDateIt, formatDateLong } from '@/lib/dates';
import { downloadFile, stamp } from '@/lib/download';
import { formatEuro } from '@/lib/money';
import { useData } from '@/state/DataContext';

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function useBackupDownload() {
  const { db } = useData();
  return () => downloadFile(createBackup(db), `registro-backup-${stamp()}.json`, 'application/json');
}

function ExcelImport() {
  const { db, update } = useData();
  const backup = useBackupDownload();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{
    file: string;
    result: ImportResult;
    plan: ImportPlanItem[];
  } | null>(null);

  async function onFile(file: File) {
    setBusy(true);
    try {
      const categories = Object.values(db.categories);
      const result = await parseRegistroXlsx(await file.arrayBuffer(), categories);
      setPreview({ file: file.name, result, plan: buildImportPlan(db, result) });
    } catch (e) {
      toast.error('File non leggibile', {
        description: e instanceof Error ? e.message : 'Controlla che sia un file Excel (.xlsx).',
      });
    } finally {
      setBusy(false);
    }
  }

  async function run(overwrite: boolean) {
    if (!preview) return;
    let written = 0;
    let skipped = 0;
    const ok = await update((d) => {
      const r = applyImport(d, buildImportPlan(d, preview.result), overwrite);
      written = r.written;
      skipped = r.skipped;
      return r.db;
    });
    setPreview(null);
    if (ok || written) {
      toast.success(`Importati ${written} giorni`, {
        description: skipped ? `${skipped} giorni già presenti non sono stati toccati.` : undefined,
      });
    }
  }

  const counts = preview
    ? {
        nuovo: preview.plan.filter((p) => p.state === 'nuovo').length,
        identico: preview.plan.filter((p) => p.state === 'identico').length,
        diverso: preview.plan.filter((p) => p.state === 'diverso'),
      }
    : null;
  const total =
    preview?.result.days.reduce((s, d) => s + d.contantiCents + d.cartaCents + d.varieCents, 0) ?? 0;

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void onFile(f);
        }}
      />
      <Button variant="secondary" onClick={() => input.current?.click()} disabled={busy}>
        <Upload className="size-4" aria-hidden />
        {busy ? 'Leggo il file…' : 'Importa dal registro Excel'}
      </Button>

      <Dialog
        open={Boolean(preview)}
        onOpenChange={(o) => !o && setPreview(null)}
        title="Anteprima dell'import"
        description={
          preview
            ? `${preview.file}: ${preview.result.days.length} giorni con dati, entrate per ${formatEuro(total)}.`
            : undefined
        }
        footer={
          counts ? (
            <>
              <Button variant="secondary" onClick={() => setPreview(null)}>
                Annulla
              </Button>
              {counts.diverso.length ? (
                <>
                  <Button variant="secondary" onClick={() => void run(false)}>
                    Importa e salta i {counts.diverso.length} diversi
                  </Button>
                  <Button variant="danger" onClick={() => void run(true)}>
                    Importa e sovrascrivi
                  </Button>
                </>
              ) : (
                <Button onClick={() => void run(false)} disabled={counts.nuovo === 0}>
                  Importa {counts.nuovo} giorni
                </Button>
              )}
            </>
          ) : null
        }
      >
        {counts && preview ? (
          <div className="grid gap-4 text-sm">
            <ul className="grid gap-1">
              <li>
                <span className="num font-semibold">{counts.nuovo}</span> giorni nuovi da aggiungere
              </li>
              <li>
                <span className="num font-semibold">{counts.identico}</span> giorni già presenti e identici
                (ignorati)
              </li>
              <li className={counts.diverso.length ? 'font-semibold text-uscite' : undefined}>
                <span className="num">{counts.diverso.length}</span> giorni già presenti con valori diversi
              </li>
            </ul>
            {counts.diverso.length ? (
              <div className="max-h-40 overflow-y-auto rounded-xl bg-surface-2 p-3">
                <p className="mb-1 font-semibold">Giorni che verrebbero sovrascritti</p>
                <ul className="grid gap-0.5 text-ink-2">
                  {counts.diverso.map((p) => (
                    <li key={p.day.date}>{formatDateLong(p.day.date)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {preview.result.warnings.length ? (
              <div className="rounded-xl bg-warn-soft p-3 text-warn">
                <p className="font-semibold">Avvisi</p>
                <ul className="mt-1 list-disc pl-5">
                  {preview.result.warnings.slice(0, 8).map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="text-ink-2">
              Prima di importare conviene scaricare un backup dei dati attuali.{' '}
              <button
                type="button"
                onClick={backup}
                className="font-semibold text-plum underline underline-offset-2"
              >
                Scarica il backup
              </button>
            </p>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}

function BackupRestore() {
  const { db, update } = useData();
  const backup = useBackupDownload();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ db: Database; exportedAt: string; days: number } | null>(null);

  async function onFile(file: File) {
    try {
      const parsed = parseBackup(await file.text());
      setPending({ ...parsed, days: Object.keys(parsed.db.days).length });
    } catch (e) {
      toast.error('Backup non valido', { description: e instanceof Error ? e.message : undefined });
    }
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void onFile(f);
        }}
      />
      <Button variant="secondary" onClick={() => input.current?.click()}>
        <Upload className="size-4" aria-hidden />
        Ripristina da backup
      </Button>
      <ConfirmDialog
        open={Boolean(pending)}
        onOpenChange={(o) => !o && setPending(null)}
        title="Sostituire tutti i dati?"
        description={
          pending
            ? `Il backup${pending.exportedAt ? ` del ${formatDateIt(pending.exportedAt.slice(0, 10))}` : ''} contiene ${pending.days} giorni. Tutti i dati attuali (${Object.keys(db.days).length} giorni) verranno sostituiti.`
            : ''
        }
        confirmLabel="Sostituisci i dati"
        onConfirm={() => {
          const next = pending?.db;
          if (next) void update(() => next, 'Backup ripristinato');
        }}
      >
        <p className="text-sm text-ink-2">
          Nel dubbio, scarica prima un backup dei dati attuali.{' '}
          <button
            type="button"
            onClick={backup}
            className="font-semibold text-plum underline underline-offset-2"
          >
            Scarica il backup
          </button>
        </p>
      </ConfirmDialog>
    </>
  );
}

export function DataSection() {
  const { db } = useData();
  const backup = useBackupDownload();
  const years = availableYears(db);
  const [year, setYear] = useState(years[years.length - 1] ?? new Date().getFullYear());
  const [exporting, setExporting] = useState(false);

  async function exportExcel() {
    setExporting(true);
    try {
      const { exportYearXlsx } = await import('@/io/exportXlsx');
      downloadFile(await exportYearXlsx(db, year), `Registro ${year}.xlsx`, XLSX_TYPE);
    } catch (e) {
      toast.error('Export non riuscito', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div>
        <h3 className="font-semibold">Importa</h3>
        <p className="mt-1 text-sm text-ink-2">
          Legge i fogli mensili del vecchio registro. Prima di aggiungere i dati mostra un'anteprima, e i
          giorni già presenti si sovrascrivono solo se lo scegli.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <ExcelImport />
          <BackupRestore />
        </div>
      </div>
      <div>
        <h3 className="font-semibold">Esporta</h3>
        <p className="mt-1 text-sm text-ink-2">
          L'Excel ha la stessa struttura del registro originale, con fogli mensili, Dashboard e formule vere.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-ink-2">
            Anno
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="min-h-11 rounded-xl border border-line-strong bg-surface px-3 text-base text-ink"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <Button variant="secondary" onClick={() => void exportExcel()} disabled={exporting}>
            <FileSpreadsheet className="size-4" aria-hidden />
            {exporting ? 'Preparo il file…' : 'Scarica Excel'}
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              downloadFile(
                exportMovementsCsv(db),
                `registro-movimenti-${stamp()}.csv`,
                'text/csv;charset=utf-8',
              )
            }
          >
            <FileText className="size-4" aria-hidden />
            Scarica CSV movimenti
          </Button>
          <Button variant="secondary" onClick={backup}>
            <FileJson className="size-4" aria-hidden />
            Scarica backup completo
          </Button>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-3">
          <Download className="size-3.5" aria-hidden />I file scaricati contengono i tuoi dati: conservali in
          un posto sicuro.
        </p>
      </div>
    </div>
  );
}
