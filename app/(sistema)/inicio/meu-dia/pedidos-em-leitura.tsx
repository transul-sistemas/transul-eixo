import { IconEye } from "@tabler/icons-react";
import { Placa } from "@/components/placa";
import type { LinhaDoPedido } from "@/lib/dominio/meu-dia";
import { ColunaDoCr, ColunaDoEnvio, OlhinhoDoPedido, PendenciasDoPedido } from "./colunas-do-lote";

// A fila do Receber placas em modo leitura (Administrador): os mesmos dados do assistente, sem os
// botões de decidir. Só o gestor de destino decide (H5): o Administrador não age em nome de ninguém.

export const FRASE_DO_MODO_LEITURA =
  "Você vê a fila em modo leitura: só o gestor de destino decide cada placa.";

export function PedidosEmLeitura({ linhas, hoje }: { linhas: LinhaDoPedido[]; hoje: string }) {
  return (
    <section aria-label="Placas esperando o gestor de destino" className="flex flex-col gap-2">
      <p
        role="note"
        className="text-muted-foreground border-border flex items-center gap-2 rounded-lg border p-3 text-sm"
      >
        <IconEye aria-hidden className="size-4 shrink-0" />
        {FRASE_DO_MODO_LEITURA}
      </p>
      <div className="border-border overflow-x-auto rounded-xl border">
        <table className="w-full text-sm" aria-label="Placas para receber, em leitura">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Placa
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Enviada por
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Gestor de destino
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                CR vigente
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Pendências
              </th>
              <th scope="col" className="w-10 px-3 py-2">
                <span className="sr-only">Detalhes</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => (
              <tr
                key={linha.pedido.id}
                data-pedido={linha.pedido.placa}
                className="border-border border-t align-top"
              >
                <th scope="row" className="px-3 py-2 text-left font-normal">
                  <Placa placa={linha.pedido.placa} tamanho="m" />
                </th>
                <td className="px-3 py-2">
                  <ColunaDoEnvio linha={linha} hoje={hoje} />
                </td>
                <td className="px-3 py-2">{linha.pedido.paraGestor}</td>
                <td className="px-3 py-2">
                  <ColunaDoCr linha={linha} />
                </td>
                <td className="px-3 py-2">
                  <PendenciasDoPedido linha={linha} />
                </td>
                <td className="px-3 py-2">
                  <OlhinhoDoPedido linha={linha} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
