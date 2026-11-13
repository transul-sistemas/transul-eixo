import { IconClockExclamation } from "@tabler/icons-react";
import { Etiqueta } from "@/components/etiqueta";
import { formatarInteiro } from "@/components/formato/numero";
import { Placa } from "@/components/placa";
import { BotaoDoOlho } from "@/components/tabela/botao-do-olho";
import { type LinhaDoPedido, situacaoDoEnvio } from "@/lib/dominio/meu-dia";

// Células do Receber placas que o assistente (quem decide) e a leitura do Administrador dividem.

export function ColunaDoCr({ linha }: { linha: LinhaDoPedido }) {
  if (linha.crs === null) {
    return (
      <span className="text-muted-foreground text-xs">
        CR não lido agora. Abra a ficha da placa para conferir.
      </span>
    );
  }
  if (linha.crs.length === 0) {
    return (
      <div className="flex flex-col gap-0.5">
        <Etiqueta status="atencao">Sem CR vigente</Etiqueta>
        <span className="text-muted-foreground text-xs">Vira tarefa de cadastro ao aceitar.</span>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-1">
      {linha.crs.map((cr) => (
        <li key={cr.codigo} className="flex flex-wrap items-center gap-1.5">
          <Etiqueta status="em-atividade">Vigente</Etiqueta>
          <span className="text-sm tabular-nums">{cr.codigo}</span>
          <span className="text-muted-foreground text-xs">
            {linha.operacao ? `Operação ${linha.operacao}` : cr.nome}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Quem enviou e há quanto tempo; passado o prazo, vermelho suave com ícone e texto (nunca só a cor). */
export function ColunaDoEnvio({ linha, hoje }: { linha: LinhaDoPedido; hoje: string }) {
  const envio = situacaoDoEnvio(linha.enviadaEm ?? null, hoje, linha.prazoDias ?? null);
  return (
    <div className="flex flex-col gap-0.5">
      <span>{linha.pedido.deGestor}</span>
      {envio.rotulo === null ? null : envio.vencido ? (
        <Etiqueta
          status="impedida"
          titulo={`Prazo da transferência: ${formatarInteiro(linha.prazoDias ?? 0)} dias`}
        >
          <IconClockExclamation aria-hidden className="size-3.5" />
          {envio.rotulo} · {envio.aviso?.toLowerCase()}
        </Etiqueta>
      ) : (
        <span className="text-muted-foreground text-xs">{envio.rotulo}</span>
      )}
    </div>
  );
}

export function OlhinhoDoPedido({ linha }: { linha: LinhaDoPedido }) {
  const { pedido } = linha;
  return (
    <BotaoDoOlho
      item={pedido.placa}
      hrefDaFicha={`/frota/placas/${pedido.placa}`}
      titulo={<Placa placa={pedido.placa} tamanho="m" />}
      detalhes={[
        { rotulo: "Enviada por", valor: pedido.deGestor },
        { rotulo: "Motivo do envio", valor: pedido.motivo },
        {
          rotulo: "CR vigente",
          valor:
            linha.crs === null
              ? "Não lido agora"
              : linha.crs.length === 0
                ? "Sem CR vigente"
                : linha.crs.map((c) => c.codigo).join(", "),
        },
        { rotulo: "Operação", valor: linha.operacao ?? "Sem operação" },
        { rotulo: "Pendências", valor: String(pedido.pendenciasConhecidas.length) },
      ]}
    />
  );
}

export function PendenciasDoPedido({ linha }: { linha: LinhaDoPedido }) {
  const { pedido } = linha;
  return pedido.pendenciasConhecidas.length === 0 ? (
    <span className="text-muted-foreground">Nenhuma</span>
  ) : (
    <ul className="list-disc pl-4">
      {pedido.pendenciasConhecidas.map((p) => (
        <li key={p.id}>{p.texto}</li>
      ))}
    </ul>
  );
}
