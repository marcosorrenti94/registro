import { useEffect } from 'react';

/**
 * Su iPhone la tastiera copre la parte bassa della pagina senza ridimensionarla: gli elementi
 * fissati in basso finiscono sotto la tastiera. Qui si misura quanto spazio occupa (VisualViewport)
 * e lo si espone come --kb-inset, con la classe .kb-open su <html> quando è aperta.
 */
export function useKeyboardInset(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        const editing =
          document.activeElement instanceof HTMLElement &&
          document.activeElement.matches('input, textarea, select');
        // Oltre ~120px con un campo attivo è la tastiera (non la barra degli strumenti di Safari)
        const open = editing && inset > 120;
        root.style.setProperty('--kb-inset', `${open ? inset : 0}px`);
        root.classList.toggle('kb-open', open);
      });
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
      root.classList.remove('kb-open');
    };
  }, []);
}
