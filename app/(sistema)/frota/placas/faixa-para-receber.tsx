import { IconInbox } from "@tabler/icons-react";
import Link from "next/link";
import { formatarInteiro } from "@/components/formato/numero";

// A faixa "Para receber": bem aparente, com ícone e texto (nunca só pela cor), na cor de ação do
// Eixo (não é situação da placa, então não usa as cores de status). Na lista, diz quantas placas
// esperam por quem usa e leva ao filtro; na ficha, diz a etapa e abre o assistente certo.

const CLASSE =
  "border-primary bg-primary/10 text-foreground flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 text-sm";

export function FaixaParaReceberNaLista({
  quantidade,
  hrefDoFiltro,
}: {
  quantidade: number;
  /** A lista filtrada por "Para receber" (o chip, na URL). */
  hrefDoFiltro: string;
}) {
  if (quantidade <= 0) return null;
  const texto =
    quantidade === 1
      ? "1 placa espera por você."
      : `${formatarInteiro(quantidade)} placas esperam por você.`;
  return (
    <div role="status" data-faixa-para-receber="" className={CLASSE}>
      <IconInbox aria-hidden className="text-primary size-5 shrink-0" />
      <p className="flex-1">
        <b>Para receber:</b> {texto} Receba cada uma e conclua o recebimento respondendo as
        pendências.
      </p>
      <Link href={hrefDoFiltro} className="text-primary font-medium underline underline-offset-4">
        Ver placas para receber
      </Link>
    </div>
  );
}

export function FaixaParaReceberNaFicha({
  etapa,
  deGestor,
  hrefDoAssistente,
}: {
  etapa: "receber" | "concluir";
  deGestor: string;
  /** A ficha com o assistente da etapa aberto (`?assistente=`). */
  hrefDoAssistente: string;
}) {
  return (
    <div role="status" data-faixa-para-receber="" className={CLASSE}>
      <IconInbox aria-hidden className="text-primary size-5 shrink-0" />
      <p className="flex-1">
        <b>Aguardando você:</b>{" "}
        {etapa === "receber"
          ? `${deGestor} disponibilizou esta placa para você. Registre a chegada.`
          : "Você recebeu esta placa. Responda as pendências para ela passar à sua carteira."}
      </p>
      <Link
        href={hrefDoAssistente}
        scroll={false}
        className="text-primary font-medium underline underline-offset-4"
      >
        {etapa === "receber" ? "Receber placa" : "Concluir recebimento"}
      </Link>
    </div>
  );
}
