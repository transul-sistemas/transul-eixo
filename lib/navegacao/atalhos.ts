/** Só o que o atalho precisa de um evento de teclado (facilita testar sem navegador). */
export interface TeclaPressionada {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
}

/**
 * Ctrl+letra (⌘+letra no Mac), sem Shift nem Alt: esses são outros atalhos, do navegador ou do
 * sistema, e não devem ser tomados.
 */
export function ehAtalho(evento: TeclaPressionada, tecla: string): boolean {
  return (
    (evento.ctrlKey || evento.metaKey) &&
    !evento.altKey &&
    !evento.shiftKey &&
    evento.key.toLowerCase() === tecla.toLowerCase()
  );
}

/** Campo onde a pessoa digita: ali, atalho de letra não pode disparar. */
export function ehCampoDeTexto(alvo: unknown): boolean {
  if (typeof alvo !== "object" || alvo === null) return false;
  const { tagName, isContentEditable } = alvo as { tagName?: unknown; isContentEditable?: unknown };
  if (isContentEditable === true) return true;
  if (typeof tagName !== "string") return false;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(tagName.toUpperCase());
}
