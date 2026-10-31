import { IconSearchOff } from "@tabler/icons-react";
import { LinkComRetorno } from "@/components/tabela/link-com-retorno";
import { VoltarALista } from "./voltar-a-lista";

/**
 * Placa bem escrita que não existe: a ficha mostra o que houve e o que fazer, dentro do casco do
 * sistema (a resposta já começou a transmitir, então o status é 200; placa mal escrita dá 404).
 */
export function PlacaNaoEncontradaNaFicha({ placa }: { placa: string }) {
  return (
    <div className="flex flex-1 flex-col gap-5 px-4 py-6 sm:px-8">
      <div>
        <VoltarALista />
      </div>
      <div className="border-border bg-card flex max-w-[62ch] flex-col items-start gap-3 rounded-xl border p-6">
        <IconSearchOff aria-hidden className="text-muted-foreground size-8" />
        <h1 className="text-3xl font-semibold tracking-tight">Placa não encontrada</h1>
        <p className="text-muted-foreground">
          Não há cadastro para a placa {placa}. Confira se ela está escrita certa no endereço ou
          procure pela lista de placas.
        </p>
        <LinkComRetorno
          href="/frota/placas"
          rota={`/frota/placas/${placa}`}
          className="border-input bg-card hover:bg-muted focus-visible:ring-ring/50 inline-flex h-9 items-center rounded-lg border px-3 text-sm outline-none focus-visible:ring-3"
        >
          Ir para a lista de placas
        </LinkComRetorno>
      </div>
    </div>
  );
}
