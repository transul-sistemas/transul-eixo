import type { ReactNode } from "react";

/**
 * A linha do tempo em lista: cada situação com a data e a hora em que começou e quanto durou. É a
 * alternativa em texto da faixa colorida (a informação não depende só da cor nem do desenho).
 * Chega do mais recente ao mais antigo, como a raiz montar.
 */
export function EventosDaFicha({
  linhas,
}: {
  linhas: readonly { chave: string; quando: string; situacao: ReactNode; duracao: string }[];
}) {
  if (linhas.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Ainda não há situações registradas. Quando a situação mudar, o histórico aparece aqui.
      </p>
    );
  }
  return (
    <div className="border-border overflow-x-auto rounded-xl border">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <caption className="sr-only">Situações, da mais recente à mais antiga</caption>
        <thead>
          <tr className="bg-muted/40 text-left">
            <th scope="col" className="border-border border-b px-3 py-2 font-medium">
              Quando começou
            </th>
            <th scope="col" className="border-border border-b px-3 py-2 font-medium">
              Situação
            </th>
            <th scope="col" className="border-border border-b px-3 py-2 font-medium">
              Duração
            </th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => (
            <tr key={linha.chave}>
              <th
                scope="row"
                className="border-border border-b px-3 py-2 text-left font-normal whitespace-nowrap tabular-nums"
              >
                {linha.quando}
              </th>
              <td className="border-border border-b px-3 py-2 whitespace-nowrap">
                {linha.situacao}
              </td>
              <td className="border-border border-b px-3 py-2 whitespace-nowrap tabular-nums">
                {linha.duracao}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
