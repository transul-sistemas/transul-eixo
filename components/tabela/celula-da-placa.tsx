import { Placa } from "@/components/placa";
import type { Densidade } from "@/lib/navegacao/preferencias-da-tabela";

interface Props {
  placa: string;
  densidade: Densidade;
  /** Abre o painel de espiar. Sem ela (fora de uma lista), a célula é só a mini placa. */
  aoAbrir?: () => void;
}

/**
 * A célula da Placa: a mini placa Mercosul dentro de um botão "Espiar AAA0A00". O botão é o controle
 * de teclado e de leitor de tela; `data-espiar-placa` deixa o foco voltar a ele ao fechar o painel.
 * Na densidade compacta a mini placa é a menor.
 */
export function CelulaDaPlaca({ placa, densidade, aoAbrir }: Props) {
  const mini = <Placa placa={placa} tamanho={densidade === "compacta" ? "p" : "m"} />;
  if (!aoAbrir) return mini;
  return (
    <button
      type="button"
      aria-label={`Espiar ${placa}`}
      aria-haspopup="dialog"
      data-espiar-placa={placa}
      onClick={aoAbrir}
      className="focus-visible:ring-ring/50 -m-0.5 inline-flex min-h-6 cursor-pointer items-center rounded p-0.5 outline-none focus-visible:ring-3"
    >
      {mini}
    </button>
  );
}
