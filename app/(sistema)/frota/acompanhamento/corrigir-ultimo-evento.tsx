"use client";

import { Dialog } from "@base-ui/react/dialog";
import { type RefObject, useCallback, useEffect, useState } from "react";
import type { Resolver } from "react-hook-form";
import { formatarDataEHora } from "@/components/formato/data";
import { useUsuarioDaSessao } from "@/components/navegacao/usuario-da-sessao";
import { Button } from "@/components/ui/button";
import { Assistente } from "@/components/wizard/assistente";
import { Campo, CLASSE_DO_CAMPO } from "@/components/wizard/campos";
import type { UltimoEvento } from "@/lib/dados/ultimo-evento-tipos";
import { esquemaCorrigirUltimo } from "@/lib/dominio/esquemas/dia-cr-e-baixa";
import { NOMES_DAS_SIGLAS, type Sigla } from "@/lib/dominio/status";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import { errosDoResolvedor } from "../placas/assistentes/erros-do-resolvedor";
import { corrigirUltimoEventoAcao, ultimoEventoAcao } from "./acoes-do-dia";

// A2, Corrigir o último evento (assistente 7): aberto de dentro de "Lançar situação", em popup empilhado.
// Só o último evento ativo da placa; exclusão lógica com motivo (nada some do histórico) e, se quiser,
// a sigla certa no lugar (nucleo.corrigir_ultimo_evento).

interface Valores {
  motivo: string;
  novaSigla: string;
}

const DEFINICAO: DefinicaoDeAssistente = {
  id: "corrigir-ultimo-evento",
  titulo: "Corrigir o último evento",
  versaoDoEsquema: 1,
  passos: [
    { id: "correcao", titulo: "Correção", campos: ["motivo", "novaSigla"] },
    { id: "conferir", titulo: "Conferir", campos: [] },
  ],
};

type Leitura =
  | { tipo: "carregando" }
  | { tipo: "erro"; mensagem: string }
  | { tipo: "pronto"; evento: UltimoEvento | null };

function Aviso({
  titulo,
  texto,
  aoFechar,
  aoRepetir,
}: {
  titulo: string;
  texto: string;
  aoFechar: () => void;
  aoRepetir?: () => void;
}) {
  return (
    <Dialog.Root open onOpenChange={(a) => (a ? undefined : aoFechar())} modal>
      <Dialog.Portal>
        <Dialog.Backdrop className="bg-foreground/40 fixed inset-0 z-[60]" />
        <Dialog.Popup
          data-assistente="corrigir-ultimo-evento"
          className="bg-background border-border fixed top-1/2 left-1/2 z-[60] flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-xl border p-5 shadow-lg outline-none"
        >
          <Dialog.Title className="text-lg font-semibold">{titulo}</Dialog.Title>
          <Dialog.Description className="text-muted-foreground text-sm">{texto}</Dialog.Description>
          <div className="flex justify-end gap-2">
            {aoRepetir ? <Button onClick={aoRepetir}>Tentar de novo</Button> : null}
            <Button variant="outline" onClick={aoFechar}>
              Fechar
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function CorrigirUltimoEvento({
  ativoId,
  placa,
  siglas,
  aoFechar,
  aoGravar,
  focoFinal,
}: {
  ativoId: string;
  placa: string;
  siglas: readonly string[];
  aoFechar: () => void;
  aoGravar: () => void;
  focoFinal?: RefObject<HTMLElement | null>;
}) {
  const usuario = useUsuarioDaSessao();
  const [leitura, setLeitura] = useState<Leitura>({ tipo: "carregando" });
  const ler = useCallback(async () => {
    setLeitura({ tipo: "carregando" });
    const r = await ultimoEventoAcao(ativoId).catch(() => null);
    if (r?.ok) setLeitura({ tipo: "pronto", evento: r.linha });
    else
      setLeitura({
        tipo: "erro",
        mensagem: r?.erro.mensagem ?? "Não foi possível ler o último evento agora.",
      });
  }, [ativoId]);
  useEffect(() => {
    // A leitura do último evento é externa (Server Action): o estado só muda quando ela responde.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void ler();
  }, [ler]);

  if (leitura.tipo === "carregando")
    return (
      <Aviso
        titulo="Corrigir o último evento"
        texto="Carregando o último evento…"
        aoFechar={aoFechar}
      />
    );
  if (leitura.tipo === "erro")
    return (
      <Aviso
        titulo="Corrigir o último evento"
        texto={leitura.mensagem}
        aoFechar={aoFechar}
        aoRepetir={() => void ler()}
      />
    );
  const evento = leitura.evento;
  if (evento === null)
    return (
      <Aviso
        titulo="Corrigir o último evento"
        texto={`A placa ${placa} não tem evento para corrigir. Lance a situação do dia.`}
        aoFechar={aoFechar}
      />
    );
  const entrada = (v: Valores) => ({
    eventoId: evento.id,
    motivo: v.motivo,
    novaSigla: v.novaSigla === "" ? null : v.novaSigla,
  });
  const resolver: Resolver<Valores> = async (valores) => {
    const r = esquemaCorrigirUltimo.safeParse(entrada(valores));
    return r.success
      ? { values: valores, errors: {} }
      : {
          values: {},
          errors: errosDoResolvedor<Valores>(
            r.error.issues.map((i) => ({ path: i.path, message: i.message })),
          ),
        };
  };
  const nome = (s: string | null) =>
    s ? `${s} · ${NOMES_DAS_SIGLAS[s as Sigla] ?? s}` : "sem sigla";
  return (
    <Assistente<Valores>
      definicao={DEFINICAO}
      resolver={resolver}
      valoresIniciais={{ motivo: "", novaSigla: "" }}
      validarRascunho={() => null}
      usuario={usuario}
      registro={evento.id}
      variante="empilhado"
      rascunho={false}
      fecharAoGravar
      focoFinal={focoFinal}
      rotuloConcluir="Corrigir o último evento"
      mensagemConcluido="Último evento corrigido."
      aoGravar={aoGravar}
      aoConcluir={(v, chaveDeEnvio) =>
        corrigirUltimoEventoAcao({ chaveDeEnvio, dados: entrada(v) })
      }
      aoFechar={aoFechar}
      resumo={(v) => [
        {
          titulo: "Correção",
          linhas: [
            { rotulo: "Placa", valor: placa },
            { rotulo: "Evento", valor: `${nome(evento.sigla)} em ${formatarDataEHora(evento.em)}` },
            { rotulo: "No lugar", valor: v.novaSigla ? nome(v.novaSigla) : "Só desfazer" },
            { rotulo: "Motivo", valor: v.motivo },
          ],
        },
      ]}
      renderPasso={(_, form) => (
        <>
          <p className="text-sm">
            Último evento de {placa}: <b>{nome(evento.sigla)}</b> em {formatarDataEHora(evento.em)}.
            Ele sai do efeito, mas fica no histórico com o motivo.
          </p>
          <Campo rotulo="Motivo" erro={form.formState.errors.motivo?.message}>
            {(p) => <input {...p} {...form.register("motivo")} className={CLASSE_DO_CAMPO} />}
          </Campo>
          <Campo rotulo="Situação certa (opcional)" erro={form.formState.errors.novaSigla?.message}>
            {(p) => (
              <select {...p} {...form.register("novaSigla")} className={CLASSE_DO_CAMPO}>
                <option value="">Só desfazer</option>
                {siglas.map((s) => (
                  <option key={s} value={s}>
                    {nome(s)}
                  </option>
                ))}
              </select>
            )}
          </Campo>
        </>
      )}
    />
  );
}
