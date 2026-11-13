import { useRouteError } from 'react-router';
import { Button } from './ui/Button';

/** Schermata mostrata se una pagina va in errore: i dati salvati non vengono toccati. */
export function RouteError() {
  const error = useRouteError();
  const message = error instanceof Error ? error.message : 'Errore sconosciuto';
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-2xl font-semibold">Questa pagina non si è aperta</h1>
      <p className="mt-2 text-ink-2">
        I dati salvati non sono stati modificati. Ricarica l'app; se il problema resta, annota il messaggio
        qui sotto.
      </p>
      <pre className="mt-4 overflow-x-auto rounded-xl bg-surface-2 p-3 text-xs text-ink-2">{message}</pre>
      <div className="mt-6 flex gap-2">
        <Button onClick={() => window.location.reload()}>Ricarica l'app</Button>
        <Button variant="secondary" onClick={() => (window.location.hash = '#/')}>
          Vai a Oggi
        </Button>
      </div>
    </div>
  );
}
