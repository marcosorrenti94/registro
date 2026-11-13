import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { clsx } from 'clsx';
import {
  CalendarDays,
  ChartColumnBig,
  CloudCheck,
  CloudOff,
  LoaderCircle,
  PenLine,
  Settings,
  TriangleAlert,
} from 'lucide-react';
import { useData } from '@/state/DataContext';
import { lastMonthPath } from '@/state/navMemory';
import { useKeyboardInset } from '@/state/useKeyboardInset';
import { InstallHint } from '@/components/InstallHint';

const NAV = [
  { to: '/', label: 'Oggi', icon: PenLine, end: true },
  { to: '/mese', label: 'Mese', icon: CalendarDays, end: false },
  { to: '/dashboard', label: 'Dashboard', icon: ChartColumnBig, end: false },
  { to: '/impostazioni', label: 'Impostazioni', icon: Settings, end: false },
] as const;

function SyncBadge({ compact = false }: { compact?: boolean }) {
  const { status, pending, connection, error, syncNow } = useData();
  if (connection.kind === 'local') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-warn-soft px-2.5 py-1 text-xs font-semibold text-warn">
        Solo su questo dispositivo
      </span>
    );
  }
  const state =
    status === 'syncing'
      ? { icon: LoaderCircle, text: 'Sincronizzo…', cls: 'text-ink-2', spin: true }
      : status === 'offline' || (pending && status !== 'error')
        ? { icon: CloudOff, text: pending ? 'Da sincronizzare' : 'Offline', cls: 'text-warn', spin: false }
        : status === 'error'
          ? { icon: TriangleAlert, text: 'Errore di sincronizzazione', cls: 'text-uscite', spin: false }
          : { icon: CloudCheck, text: 'Sincronizzato', cls: 'text-ok', spin: false };
  const Icon = state.icon;
  return (
    <button
      type="button"
      onClick={() => void syncNow()}
      title={error ?? 'Sincronizza ora'}
      className={clsx(
        'inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold hover:bg-surface-2',
        state.cls,
      )}
    >
      <Icon className={clsx('size-4', state.spin && 'animate-spin')} aria-hidden />
      <span className={compact ? 'sr-only' : undefined}>{state.text}</span>
    </button>
  );
}

export function AppShell() {
  const { db } = useData();
  const { pathname } = useLocation();
  useKeyboardInset();
  // La scheda Mese riporta all'ultimo mese aperto (su iPhone non c'è il tasto Indietro)
  const navTarget = (to: string) =>
    to !== '/mese' ? to : pathname.startsWith('/mese') ? pathname : lastMonthPath();
  // Ogni schermata si apre dall'inizio
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface px-4 py-6 lg:flex">
        <div className="px-2">
          <p className="font-display text-2xl leading-none font-bold text-plum">Registro</p>
          <p className="mt-1 truncate text-sm text-ink-2">{db.settings.businessName}</p>
        </div>
        <nav aria-label="Principale" className="mt-8 flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={navTarget(to)}
              end={end}
              className={({ isActive }) =>
                clsx(
                  'flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors',
                  isActive ? 'bg-plum-soft text-plum' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                )
              }
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto px-1">
          <SyncBadge />
        </div>
      </aside>

      <div className="min-w-0">
        {/* Barra superiore mobile */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-paper/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
          <p className="py-3 font-display text-lg font-bold text-plum">Registro</p>
          <SyncBadge />
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 pt-4 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-10 lg:pt-8 lg:pb-12">
          <InstallHint />
          <Outlet />
        </main>
      </div>

      {/* Bottom bar mobile */}
      <nav
        aria-label="Principale"
        className="bottom-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={navTarget(to)}
            end={end}
            className={({ isActive }) =>
              clsx(
                'flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold',
                isActive ? 'text-plum' : 'text-ink-3',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={clsx(
                    'flex h-8 w-14 items-center justify-center rounded-full transition-colors',
                    isActive && 'bg-plum-soft',
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
