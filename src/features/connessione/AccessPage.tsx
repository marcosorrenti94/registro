import { useEffect, useState } from 'react';
import { Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { InstallSteps } from '@/components/InstallHint';
import { Button } from '@/components/ui/Button';
import { unlockAccess } from '@/data/accessFile';
import { loadAccessFile, type AccessFileState } from '@/data/accessLoader';
import { LOCAL_MODE_AVAILABLE, type Connection } from '@/data/connection';
import { shouldSuggestInstall } from '@/lib/platform';

const inputCls =
  'min-h-12 w-full rounded-xl border border-line-strong bg-surface px-4 text-base text-ink focus:border-plum';

/**
 * Accesso con password: sull'iPhone il portachiavi propone nome e password salvati e li inserisce
 * con Face ID. La password sblocca il token cifrato in accesso.json.
 */
export function AccessPage({
  onConnect,
  onSetup,
  onToken,
}: {
  onConnect: (c: Connection) => void;
  onSetup: () => void;
  onToken: () => void;
}) {
  const [access, setAccess] = useState<AccessFileState | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestInstall] = useState(shouldSuggestInstall);

  useEffect(() => {
    let cancelled = false;
    void loadAccessFile().then((s) => {
      if (!cancelled) setAccess(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit() {
    if (access?.status !== 'ok' || !password.trim()) return;
    setBusy(true);
    setError(null);
    const secret = await unlockAccess(access.file, password);
    setBusy(false);
    if (!secret) {
      setError('Password non corretta. Controlla di aver scelto quella del Registro.');
      return;
    }
    onConnect({ kind: 'github', owner: secret.owner, repo: secret.repo, token: secret.token });
  }

  return (
    <div className="min-h-dvh bg-paper px-4 pt-[calc(2.5rem+env(safe-area-inset-top))] pb-10 sm:py-16">
      <div className="mx-auto max-w-sm">
        <p className="font-display text-4xl leading-none font-bold text-plum">Registro</p>

        {suggestInstall ? (
          <div className="mt-6 rounded-2xl bg-plum-soft p-4">
            <p className="font-semibold text-plum">Prima installa l'app, poi accedi dall'icona</p>
            <p className="mt-1 text-sm text-ink-2">
              Su iPhone Safari e l'app installata non condividono l'accesso: così accedi una volta sola.
            </p>
            <InstallSteps />
          </div>
        ) : null}

        <h1 className="mt-8 font-display text-2xl font-semibold">Accedi</h1>

        {access === null ? (
          <p className="mt-4 flex items-center gap-2 text-ink-3" aria-busy="true">
            <LoaderCircle className="size-4 animate-spin" aria-hidden /> Un momento…
          </p>
        ) : access.status !== 'ok' ? (
          <div className="mt-4 rounded-xl bg-warn-soft p-4 text-sm text-warn" role="status">
            {access.status === 'missing'
              ? "L'accesso non è ancora configurato. Chi gestisce l'app deve creare il file di accesso."
              : access.message}
          </div>
        ) : (
          <form
            className="mt-5 space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <div>
              <label htmlFor="name" className="text-sm font-semibold text-ink-2">
                Nome
              </label>
              <input
                id="name"
                name="username"
                autoComplete="username"
                autoCapitalize="words"
                className={`${inputCls} mt-1.5`}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <p className="mt-1 text-xs text-ink-3">Serve all'iPhone per ricordare la password.</p>
            </div>
            <div>
              <label htmlFor="password" className="text-sm font-semibold text-ink-2">
                Password
              </label>
              <div className="relative mt-1.5">
                <input
                  id="password"
                  name="password"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className={`${inputCls} pr-12`}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'password-error' : undefined}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute top-1/2 right-1 flex size-10 -translate-y-1/2 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-2"
                  aria-label={show ? 'Nascondi password' : 'Mostra password'}
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {error ? (
                <p id="password-error" className="mt-1.5 text-sm font-medium text-uscite" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
            <Button
              type="submit"
              size="lg"
              className="w-full justify-center"
              disabled={busy || !password.trim()}
            >
              {busy ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : null}
              {busy ? 'Verifico…' : 'Accedi'}
            </Button>
          </form>
        )}

        <div className="mt-12 border-t border-line pt-5 text-sm">
          <p className="text-ink-3">Per chi gestisce l'app</p>
          <div className="mt-1 flex flex-wrap gap-x-4">
            <button type="button" onClick={onSetup} className="min-h-11 font-semibold text-plum">
              Configura l'accesso
            </button>
            <button type="button" onClick={onToken} className="min-h-11 font-semibold text-ink-2">
              Accedi con il token
            </button>
            {LOCAL_MODE_AVAILABLE ? (
              <button
                type="button"
                onClick={() => onConnect({ kind: 'local' })}
                className="min-h-11 font-semibold text-ink-2"
              >
                Prova senza account
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
