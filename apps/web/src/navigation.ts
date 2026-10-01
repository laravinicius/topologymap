/** Permite ao editor proteger o trabalho antes de trocar de contexto ou sair. */
export function confirmNavigation(destination?: string) {
  return window.dispatchEvent(new CustomEvent('topologia:before-navigate', { cancelable: true, detail: { destination } }));
}
