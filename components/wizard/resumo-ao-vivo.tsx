import type { ReactNode } from "react";

export interface LinhaDoResumo {
  rotulo: string;
  /** Texto, número ou um nó (a moeda, uma etiqueta). Vazio (`""`, nulo) aparece como traço. */
  valor: ReactNode;
}

export interface SecaoDoResumo {
  titulo: string;
  linhas: readonly LinhaDoResumo[];
}

const estaVazio = (valor: ReactNode) => valor === "" || valor === null || valor === undefined;

/**
 * O resumo ao vivo: o que a pessoa já informou, seção por seção, que se atualiza a cada tecla.
 * É só leitura (nada aqui anuncia mudança ao leitor de tela; o foco está no campo, não aqui).
 */
export function ResumoAoVivo({
  secoes,
  modo = "lateral",
}: {
  secoes: readonly SecaoDoResumo[];
  /**
   * `lateral`: o resumo em cartão (gaveta do celular). `coluna`: a coluna de 300 px à direita dos
   * campos, de ponta a ponta. `conferir`: os "Dados" do passo de conferência.
   */
  modo?: "lateral" | "coluna" | "conferir";
}) {
  const conferir = modo === "conferir";
  const Raiz = conferir ? "section" : "aside";
  return (
    <Raiz
      aria-label={conferir ? "Dados" : "Resumo"}
      className={
        modo === "coluna"
          ? "border-border bg-muted/40 flex h-full flex-col gap-4 border-l p-5"
          : "border-border bg-card flex flex-col gap-4 rounded-xl border p-4"
      }
    >
      <h2 className="text-sm font-semibold">{conferir ? "Dados" : "Resumo"}</h2>
      {secoes.length === 0 ? (
        <p className="text-muted-foreground text-sm">Preencha os campos e o resumo aparece aqui.</p>
      ) : (
        secoes.map((secao) => (
          <section key={secao.titulo} className="flex flex-col gap-2">
            <h3 className="text-muted-foreground text-xs font-medium">{secao.titulo}</h3>
            <dl className="flex flex-col gap-1.5 text-sm">
              {secao.linhas.map((linha) => (
                <div key={linha.rotulo} className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground shrink-0">{linha.rotulo}</dt>
                  {estaVazio(linha.valor) ? (
                    <dd data-vazio="" className="text-muted-foreground">
                      —
                    </dd>
                  ) : (
                    <dd className="min-w-0 text-right break-words">{linha.valor}</dd>
                  )}
                </div>
              ))}
            </dl>
          </section>
        ))
      )}
    </Raiz>
  );
}
