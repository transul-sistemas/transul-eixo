// O clique na linha da lista é só atalho de mouse e de toque: o botão "Espiar" é o controle de
// verdade (teclado e leitor de tela). Esta guarda evita abrir o painel quando o clique era de outra
// coisa: um botão, um link, um campo, uma seleção de texto ou um atalho com tecla.

const INTERATIVO = 'a, button, input, select, textarea, label, [role="button"], [role="dialog"]';

interface Teclas {
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

export function cliqueAbreAPlaca(
  alvo: { closest(seletor: string): unknown } | null,
  teclas: Teclas,
  textoSelecionado: string,
): boolean {
  if (alvo === null) return false;
  if (teclas.ctrlKey || teclas.metaKey || teclas.shiftKey || teclas.altKey) return false;
  if (textoSelecionado.trim() !== "") return false;
  return alvo.closest(INTERATIVO) === null;
}
