/** iPhone, iPod o iPad (anche iPadOS che si presenta come Mac con touch). */
export function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** true se l'app è aperta dall'icona sulla schermata Home (non dentro Safari). */
export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}

/** Su iPhone in Safari conviene installare l'app prima di usarla. */
export function shouldSuggestInstall(): boolean {
  return isIOS() && !isStandalone();
}
