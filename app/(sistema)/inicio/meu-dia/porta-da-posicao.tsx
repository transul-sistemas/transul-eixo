"use client";

import { Dialog } from "@base-ui/react/dialog";
import { IconAlertTriangle, IconMapPin } from "@tabler/icons-react";
import { useRef, useState } from "react";
import { formatarData } from "@/components/formato/data";
import { formatarInteiro } from "@/components/formato/numero";
import { Placa } from "@/components/placa";
import { Button } from "@/components/ui/button";
import { CLASSE_DO_CAMPO } from "@/components/wizard/campos";
import type {
  CidadeDaPosicao,
  ConjuntoDaPosicao,
  PosicoesDoDia,
} from "@/lib/dados/posicao-do-dia-tipos";
import {
  contadorDaPorta,
  respostaContinua,
  respostaNaFilial,
  type RespostaValidada,
} from "@/lib/dominio/posicao-do-dia";
import { novaChaveDeEnvio } from "@/lib/wizard/chave-de-envio";
import { buscarCidadesAcao, conferirDistanciaAcao, registrarPosicaoAcao } from "./acoes-da-posicao";

// Posição do dia (M2): a porta obrigatória do Meu dia. Um popup central que não fecha (Esc e clique fora
// não fecham) até cada conjunto ter resposta: "Continua em <cidade de ontem>", "No pátio da filial",
// "Mudou de cidade" (busca na tabela de cidades, com o alerta de distância improvável) ou "Sem sinal"
// (com motivo). Cada resposta grava na hora (nucleo.registrar_posicao_do_dia), então fechar a aba não
// perde nada: o rascunho é o próprio banco. Só o líder libera a porta (fora desta tela).

const lugar = (c: { cidade: string | null; uf: string | null } | null) =>
  c?.cidade ? `${c.cidade}/${c.uf ?? ""}` : null;

type Modo = { tipo: "botoes" } | { tipo: "buscar" } | { tipo: "sem-sinal" };

interface Alerta {
  resposta: RespostaValidada;
  rotulo: string;
  km: number | null;
}

function LinhaDaPosicao({
  conjunto,
  dia,
  aoGravar,
}: {
  conjunto: ConjuntoDaPosicao;
  dia: string;
  aoGravar: (rotulo: string, versao: number) => void;
}) {
  const [modo, setModo] = useState<Modo>({ tipo: "botoes" });
  const [busca, setBusca] = useState("");
  const [cidades, setCidades] = useState<CidadeDaPosicao[]>([]);
  const [motivo, setMotivo] = useState("");
  const [alerta, setAlerta] = useState<Alerta | null>(null);
  const [erro, setErro] = useState<{ mensagem: string; repetir: () => void } | null>(null);
  const [gravando, setGravando] = useState(false);
  const pedidoDaBusca = useRef(0);
  const chave = useRef(novaChaveDeEnvio());
  const ontem = conjunto.ontem;
  const respondido = conjunto.hoje !== null;

  async function gravar(resposta: RespostaValidada, rotulo: string) {
    if (gravando) return; // clique duplo: uma gravação só
    setGravando(true);
    setErro(null);
    const r = await registrarPosicaoAcao({ chaveDeEnvio: chave.current, dados: resposta }).catch(
      () => ({ ok: false as const, erro: { codigo: "falha" as const, mensagem: "" } }),
    );
    setGravando(false);
    if (r.ok) {
      chave.current = novaChaveDeEnvio();
      setModo({ tipo: "botoes" });
      setAlerta(null);
      aoGravar(rotulo, (resposta.versao ?? 0) + 1);
      return;
    }
    setErro({
      mensagem:
        r.erro.mensagem ||
        "Não foi possível gravar a posição agora. Nada foi perdido: tente de novo.",
      repetir: () => void gravar(resposta, rotulo),
    });
  }

  async function buscar(texto: string) {
    setBusca(texto);
    const pedido = ++pedidoDaBusca.current; // a busca digitada cancela a resposta anterior
    if (texto.trim().length < 2) return setCidades([]);
    const r = await buscarCidadesAcao(texto);
    if (pedido !== pedidoDaBusca.current) return;
    setCidades(r.ok ? r.linha : []);
  }

  async function escolherCidade(cidade: CidadeDaPosicao) {
    const resposta: RespostaValidada = {
      ativoId: conjunto.ativo_id,
      dia,
      cidadeId: cidade.id,
      semSinal: false,
      motivo: null,
      sigla: conjunto.sigla,
      confirmouAlerta: false,
      versao: conjunto.hoje?.versao ?? null,
    };
    const rotulo = `${cidade.nome}/${cidade.uf}`;
    if (ontem?.cidade_id && ontem.cidade_id !== cidade.id) {
      const d = await conferirDistanciaAcao({ de: ontem.cidade_id, para: cidade.id });
      if (d.ok && d.linha.improvavel) {
        setAlerta({ resposta, rotulo, km: d.linha.km });
        return;
      }
    }
    void gravar(resposta, rotulo);
  }

  const continua = respostaContinua(conjunto, dia);
  const naFilial = respostaNaFilial(conjunto, dia);
  return (
    <li
      data-posicao={conjunto.placa}
      data-respondido={respondido ? "" : undefined}
      className="border-border grid gap-3 border-b px-4 py-3 last:border-b-0 lg:grid-cols-[14rem_12rem_1fr]"
    >
      <div className="flex flex-col gap-1">
        <Placa placa={conjunto.placa} tamanho="p" />
        <span className="text-muted-foreground text-xs">
          {conjunto.conjunto ?? "Sem implemento"}
          {conjunto.sigla ? ` · ${conjunto.sigla}` : ""}
        </span>
      </div>
      <div className="text-sm">
        <span className="text-muted-foreground block text-xs">Ontem</span>
        {ontem === null ? "Sem registro" : ontem.sem_sinal ? "Sem sinal" : lugar(ontem)}
      </div>
      <div className="flex flex-col gap-2 text-sm">
        {respondido && modo.tipo === "botoes" ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-status-em-atividade-suave inline-flex items-center gap-1 rounded-full px-2 py-0.5">
              <IconMapPin aria-hidden className="size-4" />
              {conjunto.hoje?.sem_sinal ? "Sem sinal" : (lugar(conjunto.hoje) ?? "Respondido")}
            </span>
            <Button variant="outline" size="sm" onClick={() => setModo({ tipo: "buscar" })}>
              Corrigir
            </Button>
          </div>
        ) : null}
        {!respondido && modo.tipo === "botoes" ? (
          <div className="flex flex-wrap gap-2">
            {continua && ontem ? (
              <Button
                size="sm"
                aria-disabled={gravando || undefined}
                onClick={() => void gravar(continua, lugar(ontem) ?? "")}
              >
                Continua em {lugar(ontem)}
              </Button>
            ) : null}
            {naFilial && conjunto.cidade_da_filial ? (
              <Button
                size="sm"
                variant="outline"
                aria-disabled={gravando || undefined}
                onClick={() =>
                  void gravar(
                    naFilial,
                    `${conjunto.cidade_da_filial?.nome ?? ""}/${conjunto.cidade_da_filial?.uf ?? ""}`,
                  )
                }
              >
                No pátio da filial
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onClick={() => setModo({ tipo: "buscar" })}>
              Mudou de cidade
            </Button>
            <Button size="sm" variant="outline" onClick={() => setModo({ tipo: "sem-sinal" })}>
              Sem sinal
            </Button>
          </div>
        ) : null}
        {modo.tipo === "buscar" && alerta === null ? (
          <div className="flex flex-col gap-1">
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs">Cidade de hoje</span>
              <input
                autoFocus
                value={busca}
                onChange={(e) => void buscar(e.target.value)}
                placeholder="Digite 2 letras ou mais"
                className={CLASSE_DO_CAMPO}
              />
            </label>
            {cidades.length > 0 ? (
              <ul aria-label="Cidades encontradas" className="flex flex-col">
                {cidades.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => void escolherCidade(c)}
                      className="hover:bg-muted w-full rounded px-2 py-1 text-left"
                    >
                      {c.nome}/{c.uf}
                    </button>
                  </li>
                ))}
              </ul>
            ) : busca.trim().length >= 2 ? (
              <p className="text-muted-foreground text-xs">
                Nenhuma cidade com esse nome. Confira a grafia.
              </p>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              className="w-fit"
              onClick={() => setModo({ tipo: "botoes" })}
            >
              Voltar
            </Button>
          </div>
        ) : null}
        {alerta ? (
          <div role="alert" className="bg-status-atencao-suave flex flex-col gap-2 rounded-lg p-2">
            <span className="flex items-center gap-1">
              <IconAlertTriangle aria-hidden className="size-4" />
              {alerta.km === null
                ? `${alerta.rotulo}: distância improvável para 1 dia.`
                : `${formatarInteiro(alerta.km)} km de ontem: improvável em 1 dia.`}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() =>
                  void gravar({ ...alerta.resposta, confirmouAlerta: true }, alerta.rotulo)
                }
              >
                Está certo
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAlerta(null)}>
                Corrigir
              </Button>
            </div>
          </div>
        ) : null}
        {modo.tipo === "sem-sinal" ? (
          <div className="flex flex-col gap-1">
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs">Por que está sem sinal</span>
              <input
                autoFocus
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className={CLASSE_DO_CAMPO}
              />
            </label>
            <div className="flex gap-2">
              <Button
                size="sm"
                aria-disabled={motivo.trim() === "" || gravando || undefined}
                onClick={() => {
                  if (motivo.trim() === "") return;
                  void gravar(
                    {
                      ativoId: conjunto.ativo_id,
                      dia,
                      cidadeId: null,
                      semSinal: true,
                      motivo: motivo.trim(),
                      sigla: conjunto.sigla,
                      confirmouAlerta: false,
                      versao: conjunto.hoje?.versao ?? null,
                    },
                    "Sem sinal",
                  );
                }}
              >
                Gravar sem sinal
              </Button>
              <Button size="sm" variant="outline" onClick={() => setModo({ tipo: "botoes" })}>
                Voltar
              </Button>
            </div>
          </div>
        ) : null}
        {gravando ? (
          <span role="status" className="text-muted-foreground text-xs">
            Gravando…
          </span>
        ) : null}
        {erro ? (
          <div role="alert" className="flex flex-wrap items-center gap-2 text-xs">
            <span>{erro.mensagem}</span>
            <Button size="sm" variant="outline" onClick={erro.repetir}>
              Tentar de novo
            </Button>
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function PortaDaPosicao({
  posicoes,
  aoConcluir,
}: {
  posicoes: PosicoesDoDia;
  aoConcluir: () => void;
}) {
  const [conjuntos, setConjuntos] = useState(posicoes.conjuntos);
  const { respondidos, total, podeConcluir } = contadorDaPorta(conjuntos);
  const faltam = total - respondidos;
  function marcar(ativoId: string, rotulo: string, versao: number) {
    setConjuntos((atuais) =>
      atuais.map((c) => {
        if (c.ativo_id !== ativoId) return c;
        const [cidade, uf] = rotulo === "Sem sinal" ? [null, null] : rotulo.split("/");
        return {
          ...c,
          hoje: {
            posicao_id: c.hoje?.posicao_id ?? "",
            versao,
            cidade_id: null,
            cidade: cidade ?? null,
            uf: uf ?? null,
            sem_sinal: rotulo === "Sem sinal",
            motivo: null,
            confirmou_alerta: false,
          },
        };
      }),
    );
  }
  return (
    // Porta obrigatória: Esc e clique fora não fecham (onOpenChange ignora o fechar).
    <Dialog.Root open onOpenChange={() => undefined} modal>
      <Dialog.Portal>
        <Dialog.Backdrop className="bg-foreground/40 fixed inset-0 z-50" />
        <Dialog.Popup
          data-assistente="posicao-do-dia"
          data-porta-obrigatoria=""
          className="bg-background fixed inset-2 z-50 flex flex-col overflow-hidden rounded-xl border shadow-lg outline-none sm:inset-4 lg:inset-auto lg:top-1/2 lg:left-1/2 lg:h-[min(90dvh,820px)] lg:w-[min(1040px,calc(100vw-3rem))] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-2xl"
        >
          <div className="border-border flex flex-col gap-1 border-b px-4 py-3 sm:px-6">
            <Dialog.Title className="text-lg font-semibold">
              Onde estão os seus conjuntos hoje?
            </Dialog.Title>
            <Dialog.Description className="text-muted-foreground text-sm">
              Posição do dia de {formatarData(posicoes.dia)}. Obrigatório para continuar.
            </Dialog.Description>
          </div>
          <div className="bg-muted/60 flex flex-wrap items-center gap-3 px-4 py-2 text-sm sm:px-6">
            <span data-testid="contador-da-posicao" className="font-semibold">
              {formatarInteiro(respondidos)} de {formatarInteiro(total)} preenchidos
            </span>
            <progress
              max={Math.max(total, 1)}
              value={respondidos}
              aria-label="Conjuntos com posição"
              className="accent-acao h-2 w-40"
            />
          </div>
          <ol aria-label="Conjuntos da sua carteira" className="min-h-0 flex-1 overflow-y-auto">
            {conjuntos.map((c) => (
              <LinhaDaPosicao
                key={c.ativo_id}
                conjunto={c}
                dia={posicoes.dia}
                aoGravar={(rotulo, versao) => marcar(c.ativo_id, rotulo, versao)}
              />
            ))}
          </ol>
          <div className="border-border flex flex-wrap items-center gap-2 border-t px-4 py-3 sm:px-6">
            <span className="text-muted-foreground mr-auto text-xs">
              A posição é da placa, em nível de cidade. Cada resposta grava na hora.
            </span>
            <Button
              aria-disabled={!podeConcluir || undefined}
              onClick={() => {
                if (podeConcluir) aoConcluir();
              }}
            >
              {podeConcluir
                ? "Concluir posição do dia"
                : `Falta${faltam === 1 ? "" : "m"} ${formatarInteiro(faltam)} conjunto${faltam === 1 ? "" : "s"}`}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
