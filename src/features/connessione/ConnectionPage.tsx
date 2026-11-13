import { useState } from 'react';
import {
  ArrowLeft,
  CircleCheck,
  CircleX,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { Connection, GitHubConnection } from '@/data/connection';
import { GitHubRepository, type VerifyResult } from '@/data/github';

const inputCls =
  'min-h-12 w-full rounded-xl border border-line-strong bg-surface px-4 text-base text-ink focus:border-plum';

/** Accesso d'emergenza con il token, per chi gestisce l'app. */
export function ConnectionPage({
  onConnect,
  onBack,
}: {
  onConnect: (c: Connection) => void;
  onBack: () => void;
}) {
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('registro-data');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);

  const conn = (): GitHubConnection => ({
    kind: 'github',
    owner: owner.trim(),
    repo: repo.trim(),
    token: token.trim(),
  });
  const valid = Boolean(owner.trim() && repo.trim() && token.trim());
  const reset = () => setResult(null);

  async function verify() {
    if (!valid) return;
    setChecking(true);
    setResult(null);
    try {
      setResult(await new GitHubRepository(conn()).verify());
    } catch (e) {
      setResult({
        ok: false,
        isPrivate: false,
        canWrite: false,
        hasDatabase: false,
        message: e instanceof Error ? e.message : 'Errore di rete: controlla la connessione.',
      });
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="min-h-dvh bg-paper px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-md">
        <Button variant="ghost" className="-ml-3" onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden /> Torna all'accesso
        </Button>
        <h1 className="mt-4 font-display text-2xl font-semibold">Accedi con il token</h1>
        <p className="mt-2 text-ink-2">
          Entrate e uscite sono salvate in un tuo repository GitHub privato. Questo dispositivo ci accede con
          un token personale, che resta salvato solo qui.
        </p>

        <form
          className="mt-8 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (result?.ok) onConnect(conn());
            else void verify();
          }}
        >
          <div>
            <label htmlFor="owner" className="text-sm font-semibold text-ink-2">
              Utente GitHub
            </label>
            <input
              id="owner"
              className={`${inputCls} mt-1.5`}
              value={owner}
              onChange={(e) => {
                setOwner(e.target.value);
                reset();
              }}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label htmlFor="repo" className="text-sm font-semibold text-ink-2">
              Repository dei dati
            </label>
            <input
              id="repo"
              className={`${inputCls} mt-1.5`}
              value={repo}
              onChange={(e) => {
                setRepo(e.target.value);
                reset();
              }}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
            />
          </div>
          <div>
            <label htmlFor="token" className="text-sm font-semibold text-ink-2">
              Token di accesso
            </label>
            <div className="relative mt-1.5">
              <KeyRound
                className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-ink-3"
                aria-hidden
              />
              <input
                id="token"
                type={showToken ? 'text' : 'password'}
                className={`${inputCls} pr-12 pl-10 font-mono text-base sm:text-sm`}
                value={token}
                onChange={(e) => {
                  setToken(e.target.value);
                  reset();
                }}
                placeholder="github_pat_…"
                autoComplete="current-password"
                spellCheck={false}
                required
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
            <p className="mt-1.5 text-xs text-ink-3">
              Token «fine-grained» con accesso solo a questo repository e permesso Contents: Read and write.{' '}
              <a
                href="https://github.com/settings/personal-access-tokens/new"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-plum underline underline-offset-2"
              >
                Crea un token su GitHub
              </a>
            </p>
          </div>

          {result ? (
            <div
              role="status"
              className={
                result.ok
                  ? 'flex gap-2 rounded-xl bg-ok-soft p-3 text-sm text-ok'
                  : result.canWrite && !result.isPrivate
                    ? 'flex gap-2 rounded-xl bg-warn-soft p-3 text-sm text-warn'
                    : 'flex gap-2 rounded-xl bg-uscite-soft p-3 text-sm text-uscite'
              }
            >
              {result.ok ? (
                <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
              ) : !result.isPrivate && result.canWrite ? (
                <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              ) : (
                <CircleX className="mt-0.5 size-4 shrink-0" aria-hidden />
              )}
              <span>{result.message}</span>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="secondary"
              className="flex-1 justify-center"
              onClick={() => void verify()}
              disabled={!valid || checking}
            >
              {checking ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
              Verifica
            </Button>
            <Button type="submit" className="flex-1 justify-center" disabled={!result?.ok}>
              Accedi
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
