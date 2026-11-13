import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';

/**
 * L'app funziona offline grazie al service worker. Quando viene pubblicata una nuova versione
 * non si aggiorna da sola a metà di un inserimento: chiede prima conferma.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Controlla gli aggiornamenti ogni ora se l'app resta aperta
      if (registration) window.setInterval(() => void registration.update(), 60 * 60 * 1000);
    },
  });

  useEffect(() => {
    if (!needRefresh) return;
    toast('È disponibile una nuova versione', {
      description: 'Salva il giorno che stai compilando, poi aggiorna.',
      duration: Infinity,
      action: { label: 'Aggiorna', onClick: () => void updateServiceWorker(true) },
    });
  }, [needRefresh, updateServiceWorker]);

  useEffect(() => {
    if (offlineReady) toast.success("L'app ora funziona anche senza connessione");
  }, [offlineReady]);

  return null;
}
