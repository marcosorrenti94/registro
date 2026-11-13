import * as RDialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-50 bg-[#120c14]/55 backdrop-blur-[2px]" />
        <RDialog.Content className="fixed inset-x-3 bottom-3 z-50 max-h-[85dvh] overflow-y-auto rounded-2xl border border-line bg-surface p-5 shadow-2xl sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2">
          <div className="flex items-start justify-between gap-4">
            <RDialog.Title className="font-display text-xl font-semibold">{title}</RDialog.Title>
            <RDialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Chiudi" className="-mt-2 -mr-2">
                <X className="size-5" aria-hidden />
              </Button>
            </RDialog.Close>
          </div>
          {description ? (
            <RDialog.Description className="mt-2 text-sm text-ink-2">{description}</RDialog.Description>
          ) : (
            <RDialog.Description className="sr-only">{title}</RDialog.Description>
          )}
          {children ? <div className="mt-4">{children}</div> : null}
          {footer ? (
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>
          ) : null}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

/** Conferma prima di eliminare o sovrascrivere: l'azione distruttiva è sempre esplicita. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  danger = true,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  danger?: boolean;
  children?: ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
