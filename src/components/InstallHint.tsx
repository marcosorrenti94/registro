import { useState } from 'react';
import { Share, SquarePlus, X } from 'lucide-react';
import { shouldSuggestInstall } from '@/lib/platform';

const KEY = 'registro.install-hint-dismissed';

function dismissed(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** Istruzioni per installare l'app su iPhone: Safari non propone l'installazione da solo. */
export function InstallSteps() {
  return (
    <ol className="mt-2 grid gap-1.5 text-sm">
      <li className="flex items-center gap-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-bold">
          1
        </span>
        Tocca <Share className="size-4 shrink-0" aria-label="Condividi" /> in basso in Safari
      </li>
      <li className="flex items-center gap-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-bold">
          2
        </span>
        Scegli <SquarePlus className="size-4 shrink-0" aria-hidden /> «Aggiungi alla schermata Home»
      </li>
      <li className="flex items-center gap-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-bold">
          3
        </span>
        Apri il Registro dall'icona
      </li>
    </ol>
  );
}

/** Avviso nelle schermate dell'app, solo su iPhone in Safari; si può chiudere. */
export function InstallHint() {
  const [hidden, setHidden] = useState(() => !shouldSuggestInstall() || dismissed());
  if (hidden) return null;
  return (
    <aside aria-label="Installa l'app" className="mb-5 rounded-2xl bg-plum-soft p-4 text-ink">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-plum">Installa il Registro sull'iPhone</p>
        <button
          type="button"
          aria-label="Chiudi l'avviso"
          onClick={() => {
            setHidden(true);
            try {
              localStorage.setItem(KEY, '1');
            } catch {
              /* ignora */
            }
          }}
          className="-mt-2 -mr-2 flex size-11 items-center justify-center rounded-xl text-ink-2"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <p className="mt-1 text-sm text-ink-2">
        Si apre a tutto schermo, funziona senza connessione e Safari non cancella la copia dei dati dopo
        qualche giorno di inutilizzo.
      </p>
      <InstallSteps />
      <p className="mt-2 text-xs text-ink-3">
        L'app installata non condivide l'accesso con Safari: al primo avvio dall'icona inserisci di nuovo il
        token.
      </p>
    </aside>
  );
}
