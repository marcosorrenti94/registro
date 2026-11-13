import { Suspense, lazy, useState } from 'react';
import { createHashRouter, RouterProvider } from 'react-router';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Toaster } from 'sonner';
import { AppShell } from '@/components/layout/AppShell';
import { RouteError } from '@/components/RouteError';
import { UpdatePrompt } from '@/components/UpdatePrompt';
import { clearConnection, loadConnection, saveConnection, type Connection } from '@/data/connection';
import { AccessPage } from '@/features/connessione/AccessPage';
import { ConnectionPage } from '@/features/connessione/ConnectionPage';
import { SetupPage } from '@/features/connessione/SetupPage';
import { OggiPage } from '@/features/oggi/OggiPage';
import { DataProvider, useData } from '@/state/DataContext';

// Oggi (la schermata del bancone) è nel pacchetto principale; le altre si scaricano quando servono
const MesePage = lazy(() => import('@/features/mese/MesePage').then((m) => ({ default: m.MesePage })));
const DashboardPage = lazy(() =>
  import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const ImpostazioniPage = lazy(() =>
  import('@/features/impostazioni/ImpostazioniPage').then((m) => ({ default: m.ImpostazioniPage })),
);

function Loading() {
  return (
    <div className="flex min-h-[50dvh] items-center justify-center text-ink-3" aria-busy="true">
      Carico il registro…
    </div>
  );
}

function Gate({ children }: { children: React.ReactNode }) {
  const { loading } = useData();
  return loading ? <Loading /> : <Suspense fallback={<Loading />}>{children}</Suspense>;
}

// Hash router: funziona su GitHub Pages senza configurazioni del server e offline
const router = createHashRouter([
  {
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      {
        index: true,
        element: (
          <Gate>
            <OggiPage />
          </Gate>
        ),
      },
      {
        path: 'giorno/:date',
        element: (
          <Gate>
            <OggiPage />
          </Gate>
        ),
      },
      {
        path: 'mese/:year?/:month?',
        element: (
          <Gate>
            <MesePage />
          </Gate>
        ),
      },
      {
        path: 'dashboard/:year?',
        element: (
          <Gate>
            <DashboardPage />
          </Gate>
        ),
      },
      {
        path: 'impostazioni',
        element: (
          <Gate>
            <ImpostazioniPage />
          </Gate>
        ),
      },
      {
        path: '*',
        element: (
          <Gate>
            <OggiPage />
          </Gate>
        ),
      },
    ],
  },
]);

export function App() {
  const [connection, setConnection] = useState<Connection | null>(loadConnection);
  const [screen, setScreen] = useState<'accesso' | 'configura' | 'token'>('accesso');
  const connect = (c: Connection) => {
    saveConnection(c);
    setConnection(c);
    setScreen('accesso');
  };

  return (
    <Tooltip.Provider>
      <Toaster position="top-center" richColors closeButton toastOptions={{ className: 'font-sans' }} />
      <UpdatePrompt />
      {connection ? (
        <DataProvider
          key={connection.kind === 'github' ? `${connection.owner}/${connection.repo}` : 'local'}
          connection={connection}
          onDisconnect={() => {
            clearConnection();
            setConnection(null);
          }}
        >
          <RouterProvider router={router} />
        </DataProvider>
      ) : screen === 'configura' ? (
        <SetupPage onBack={() => setScreen('accesso')} />
      ) : screen === 'token' ? (
        <ConnectionPage onConnect={connect} onBack={() => setScreen('accesso')} />
      ) : (
        <AccessPage
          onConnect={connect}
          onSetup={() => setScreen('configura')}
          onToken={() => setScreen('token')}
        />
      )}
    </Tooltip.Provider>
  );
}
