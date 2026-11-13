import { useState } from 'react';
import {
  ArrowLeft,
  CircleCheck,
  CircleX,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import {
  MAX_PEOPLE,
  buildAccessFile,
  generatePassword,
  passwordProblem,
  type AccessFile,
} from '@/data/accessFile';
import { GitHubRepository, type VerifyResult } from '@/data/github';
import { downloadFile } from '@/lib/download';
import { newId } from '@/lib/id';

const inputCls =
  'min-h-12 w-full rounded-xl border border-line-strong bg-surface px-4 text-base text-ink focus:border-plum';

interface Person {
  id: string;
  name: string;
  password: string;
}

const newPerson = (): Person => ({ id: newId(), name: '', password: generatePassword() });

/**
 * Configurazione dell'accesso (per chi gestisce l'app, una volta): verifica il token sul repository
 * dati privato, genera una password per persona e produce accesso.json da pubblicare con l'app.
 * Il token non lascia il dispositivo se non verso api.github.com.
 */
export function SetupPage({ onBack }: { onBack: () => void }) {
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('registro-data');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [checking, setChecking] = useState(false);
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [people, setPeople] = useState<Person[]>(() => [newPerson()]);
  const [showPasswords, setShowPasswords] = useState(true);
  const [building, setBuilding] = useState(false);
  const [done, setDone] = useState<AccessFile | null>(null);

  const valid = Boolean(owner.trim() && repo.trim() && token.trim());
  const reset = () => {
    setVerify(null);
    setDone(null);
  };
  const problems = people.map((p) => (p.name.trim() ? passwordProblem(p.password) : 'Scrivi il nome.'));
  const ready = verify?.ok && problems.every((p) => p === null);

  async function check() {
    setChecking(true);
    reset();
    try {
      setVerify(
        await new GitHubRepository({
          kind: 'github',
          owner: owner.trim(),
          repo: repo.trim(),
          token: token.trim(),
        }).verify(),
      );
    } catch (e) {
      setVerify({
        ok: false,
        isPrivate: false,
        canWrite: false,
        hasDatabase: false,
        message: e instanceof Error ? e.message : 'Errore di rete.',
      });
    } finally {
      setChecking(false);
    }
  }

  async function build() {
    if (!ready) return;
    setBuilding(true);
    try {
      const file = await buildAccessFile(
        people.map((p) => ({
          secret: { label: p.name.trim(), owner: owner.trim(), repo: repo.trim(), token: token.trim() },
          password: p.password,
        })),
      );
      downloadFile(JSON.stringify(file, null, 2), 'accesso.json', 'application/json');
      setDone(file);
    } finally {
      setBuilding(false);
    }
  }

  const setPerson = (id: string, patch: Partial<Person>) => {
    setDone(null);
    setPeople((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  return (
    <div className="min-h-dvh bg-paper px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-12 sm:py-12">
      <div className="mx-auto max-w-lg">
        <Button variant="ghost" className="-ml-3" onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden /> Torna all'accesso
        </Button>
        <h1 className="mt-4 font-display text-3xl font-semibold">Configura l'accesso</h1>
        <p className="mt-2 text-ink-2">
          Da fare una volta, da chi gestisce l'app. Ogni persona riceve una password: sblocca l'accesso al
          repository dei dati senza dover usare il token.
        </p>

        <section className="mt-8">
          <h2 className="font-display text-xl font-semibold">Repository dei dati</h2>
          <div className="mt-4 grid gap-4">
            <label className="block">
              <span className="text-sm font-semibold text-ink-2">Proprietario (utente o organizzazione)</span>
              <input
                className={`${inputCls} mt-1.5`}
                value={owner}
                onChange={(e) => {
                  setOwner(e.target.value);
                  reset();
                }}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-ink-2">Nome del repository privato</span>
              <input
                className={`${inputCls} mt-1.5`}
                value={repo}
                onChange={(e) => {
                  setRepo(e.target.value);
                  reset();
                }}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </label>
            <div>
              <label htmlFor="setup-token" className="text-sm font-semibold text-ink-2">
                Token (Contents: Read and write, solo su questo repository)
              </label>
              <div className="relative mt-1.5">
                <KeyRound
                  className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-ink-3"
                  aria-hidden
                />
                <input
                  id="setup-token"
                  type={showToken ? 'text' : 'password'}
                  className={`${inputCls} pr-12 pl-10 font-mono text-base sm:text-sm`}
                  value={token}
                  onChange={(e) => {
                    setToken(e.target.value);
                    reset();
                  }}
                  placeholder="github_pat_…"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => setShowToken((v) => !v)}
                  className="absolute top-1/2 right-1 flex size-10 -translate-y-1/2 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-2"
                  aria-label={showToken ? 'Nascondi token' : 'Mostra token'}
                >
                  {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <Button
              variant="secondary"
              className="justify-center"
              onClick={() => void check()}
              disabled={!valid || checking}
            >
              {checking ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
              Verifica il repository
            </Button>
            {verify ? (
              <p
                role="status"
                className={
                  verify.ok
                    ? 'flex gap-2 rounded-xl bg-ok-soft p-3 text-sm text-ok'
                    : 'flex gap-2 rounded-xl bg-uscite-soft p-3 text-sm text-uscite'
                }
              >
                {verify.ok ? (
                  <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
                ) : (
                  <CircleX className="mt-0.5 size-4 shrink-0" aria-hidden />
                )}
                {verify.message}
              </p>
            ) : null}
          </div>
        </section>

        <section className="mt-10">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-xl font-semibold">Persone</h2>
            <Button variant="ghost" onClick={() => setShowPasswords((v) => !v)}>
              {showPasswords ? (
                <EyeOff className="size-4" aria-hidden />
              ) : (
                <Eye className="size-4" aria-hidden />
              )}
              {showPasswords ? 'Nascondi password' : 'Mostra password'}
            </Button>
          </div>
          <p className="mt-1 text-sm text-ink-2">
            Al massimo {MAX_PEOPLE}. Per rinnovare il token senza cambiare password, scrivi qui le password
            già in uso.
          </p>
          <ul className="mt-4 grid gap-4">
            {people.map((p, i) => (
              <li key={p.id} className="rounded-2xl border border-line bg-surface p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">Persona {i + 1}</p>
                  {people.length > 1 ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Rimuovi persona ${i + 1}`}
                      onClick={() => setPeople((ps) => ps.filter((x) => x.id !== p.id))}
                    >
                      <X className="size-5" aria-hidden />
                    </Button>
                  ) : null}
                </div>
                <label className="mt-2 block">
                  <span className="text-sm font-semibold text-ink-2">Nome</span>
                  <input
                    className={`${inputCls} mt-1.5`}
                    value={p.name}
                    onChange={(e) => setPerson(p.id, { name: e.target.value })}
                    autoCapitalize="words"
                  />
                </label>
                <label className="mt-3 block">
                  <span className="text-sm font-semibold text-ink-2">Password</span>
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    className={`${inputCls} mt-1.5 font-mono`}
                    value={p.password}
                    onChange={(e) => setPerson(p.id, { password: e.target.value })}
                    autoComplete="new-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </label>
                {problems[i] && p.name.trim() ? (
                  <p className="mt-1 text-sm text-uscite">{problems[i]}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setPerson(p.id, { password: generatePassword() })}
                  >
                    <RefreshCw className="size-4" aria-hidden /> Genera
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(p.password)
                        .then(() => toast.success('Password copiata'))
                        .catch(() => toast.error('Copia non riuscita: selezionala e copiala a mano'))
                    }
                  >
                    <Copy className="size-4" aria-hidden /> Copia
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          {people.length < MAX_PEOPLE ? (
            <Button
              variant="ghost"
              className="mt-3 -ml-2"
              onClick={() => setPeople((ps) => [...ps, newPerson()])}
            >
              <Plus className="size-4" aria-hidden /> Aggiungi una persona
            </Button>
          ) : null}
        </section>

        <section className="mt-10">
          <Button
            size="lg"
            className="w-full justify-center"
            disabled={!ready || building}
            onClick={() => void build()}
          >
            {building ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : null}
            {building ? 'Cifro…' : 'Crea il file di accesso'}
          </Button>
          {!verify?.ok ? (
            <p className="mt-2 text-sm text-ink-3">Prima verifica il repository dei dati.</p>
          ) : null}
          {done ? (
            <div className="mt-5 rounded-2xl bg-ok-soft p-4 text-sm text-ink" role="status">
              <p className="font-semibold text-ok">File accesso.json scaricato</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-ink-2">
                <li>
                  Metti il file nella cartella <code>public/</code> del progetto e pubblica l'app.
                </li>
                <li>Consegna a ogni persona la sua password: va salvata nell'app Password dell'iPhone.</li>
                <li>
                  Le password non sono salvate da nessuna parte: se chiudi questa pagina non si possono
                  rivedere.
                </li>
              </ol>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
