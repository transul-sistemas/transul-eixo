import { IconEye } from "@tabler/icons-react";
import { LinkComContexto } from "@/components/navegacao/link-com-contexto";
import { Placa } from "@/components/placa";
import type { Densidade } from "@/lib/navegacao/preferencias-da-tabela";

interface Props {
  placa: string;
  densidade: Densidade;
  /** Abre o painel de espiar. Sem ela, a célula não tem o botão Espiar. */
  aoAbrir?: () => void;
  /** Para onde a placa leva (a ficha). Sem ele, a mini placa não é um link. */
  hrefDaFicha?: string;
  /** Avisa que a pessoa vai sair da lista para a ficha (guarda o ponto de retorno). */
  aoIrParaAFicha?: () => void;
}

/**
 * A célula da Placa: a mini placa Mercosul como link para a ficha (`Abrir ficha de AAA0A00`) e, ao
 * lado, o botão Espiar (`Espiar AAA0A00`, com o ícone de olho). O link vem antes na ordem do teclado.
 * `data-ficha-placa` e `data-espiar-placa` deixam o foco voltar a cada um. Sem link nem botão (fora
 * de uma lista) é só a mini placa. Na densidade compacta a mini placa é a menor.
 */
export function CelulaDaPlaca({ placa, densidade, aoAbrir, hrefDaFicha, aoIrParaAFicha }: Props) {
  const mini = <Placa placa={placa} tamanho={densidade === "compacta" ? "p" : "m"} />;
  if (!aoAbrir && !hrefDaFicha) return mini;
  return (
    <span className="inline-flex items-center gap-1.5">
      {hrefDaFicha ? (
        <LinkComContexto
          href={hrefDaFicha}
          aria-label={`Abrir ficha de ${placa}`}
          data-ficha-placa={placa}
          onClick={aoIrParaAFicha}
          className={`focus-visible:ring-ring/50 -m-0.5 inline-flex min-h-6 items-center rounded p-0.5 outline-none focus-visible:ring-3 ${densidade === "compacta" ? "w-20" : "w-24"}`}
        >
          {mini}
        </LinkComContexto>
      ) : (
        mini
      )}
      {aoAbrir ? (
        <button
          type="button"
          aria-label={`Espiar ${placa}`}
          aria-haspopup="dialog"
          data-espiar-placa={placa}
          onClick={aoAbrir}
          className="focus-visible:ring-ring/50 text-muted-foreground hover:bg-muted hover:text-foreground inline-grid size-6 cursor-pointer place-items-center rounded outline-none focus-visible:ring-3"
        >
          <IconEye aria-hidden className="size-4" />
        </button>
      ) : null}
    </span>
  );
}
