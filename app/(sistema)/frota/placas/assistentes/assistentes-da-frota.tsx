"use client";

import { IconPlus } from "@tabler/icons-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AcoesDaFicha } from "@/components/ficha/acoes-da-ficha";
import { ProvedorDoUsuario } from "@/components/navegacao/usuario-da-sessao";
import { Button } from "@/components/ui/button";
import { useAssistenteNaUrl } from "@/components/wizard/use-assistente-na-url";
import type { DadosDosAssistentes, ItemCriado, PlacaGravada } from "@/lib/dados/escrita-tipos";
import { mesclarCatalogos } from "@/lib/dados/catalogos-locais";
import {
  etapaDoRecebimento,
  podeCancelarPedido,
  MENSAGEM_DE_TIPO_QUE_NAO_ENTREGA,
  motivoDeNaoEntregar,
  type PedidoDeTransferencia,
  podeDisponibilizarPlaca,
  podeEntregar,
} from "@/lib/dominio/custodia";
import { NOMES_DOS_TIPOS } from "@/lib/dados/placas-tipos";
import { normalizarPlaca, placaNormalizadaValida } from "@/lib/dominio/placa";
import { SIGLAS_DE_BAIXA } from "@/lib/dominio/status";
import { CadastrarPlaca } from "./cadastrar-placa";
import { CancelarPedido } from "./cancelar-pedido";
import { ConcluirRecebimento } from "./concluir-recebimento";
import { CorrigirPlaca } from "./corrigir-placa";
import { DesatrelarImplemento } from "./desatrelar-implemento";
import { DevolverPlaca } from "./devolver-placa";
import { DisponibilizarPlaca } from "./disponibilizar-placa";
import { EngatarImplemento } from "./engatar-implemento";
import { EntregarAoOperacional } from "./entregar-ao-operacional";
import { EscolherAPlaca } from "./escolher-a-placa";
import { MudarSituacao } from "./mudar-situacao";
import { ReceberPlaca } from "./receber-placa";

// O hospedeiro dos assistentes da Frota: abre o que a URL pede (`?assistente=`), na lista de
// placas, na ficha e pelo Ctrl+K. Guarda o que o assistente aberto recebeu: depois de gravar, a tela
// atualiza por baixo e a mensagem "concluído" não pode sumir junto com o pedido que acabou de ser
// atendido.

const semAssinatura = () => () => {};

const ABRA_A_FICHA = (acao: string) =>
  `Abra a ficha da placa (ou busque a placa na lista) e use ${acao} nela.`;
const BAIXADA = (placa: string) => `A placa ${placa} está baixada e não aceita esta ação.`;

/** Guarda o primeiro valor pronto enquanto o assistente está aberto; ao fechar, solta. */
function useGuardadoEnquantoAberto<T>(aberto: boolean, agora: T | null): T | null {
  const [guardado, setGuardado] = useState<T | null>(null);
  if (!aberto && guardado !== null) setGuardado(null);
  else if (aberto && guardado === null && agora !== null) setGuardado(agora);
  return aberto ? (guardado ?? agora) : null;
}

/** Os ids das ações da ficha e o assistente (`?assistente=`) que cada uma abre. */
const ASSISTENTE_DA_ACAO: Record<string, string> = {
  "frota.receber-placa": "receber-placa",
  "frota.concluir-recebimento": "concluir-recebimento",
  "frota.entregar-ao-operacional": "entregar-ao-operacional",
  "frota.disponibilizar-placa": "disponibilizar-placa",
  "frota.mudar-situacao": "mudar-situacao",
  "frota.engatar-implemento": "engatar-implemento",
  "frota.desatrelar-implemento": "desatrelar-implemento",
  "frota.corrigir-placa": "corrigir-placa",
  "frota.cancelar-pedido": "cancelar-pedido",
  "frota.devolver-placa": "devolver-placa",
};

export function AssistentesDaFrota({
  dados,
  placaDaFicha,
  comBotaoDeCadastrar = false,
  acoesDaFicha,
}: {
  dados: DadosDosAssistentes;
  /** Na ficha: a placa da tela (os assistentes de custódia agem sobre ela). */
  placaDaFicha?: string;
  /** Na lista: o botão "Cadastrar placa". */
  comBotaoDeCadastrar?: boolean;
  /** Na ficha: as ações do momento (já filtradas por perfil e pela situação da placa). */
  acoesDaFicha?: readonly { id: string; nome: string }[];
}) {
  const rota = usePathname();
  const parametros = useSearchParams();
  const router = useRouter();
  const noNavegador = useSyncExternalStore(
    semAssinatura,
    () => true,
    () => false,
  );
  const cadastrar = useAssistenteNaUrl("cadastrar-placa");
  const receber = useAssistenteNaUrl("receber-placa");
  const concluir = useAssistenteNaUrl("concluir-recebimento");
  const entregar = useAssistenteNaUrl("entregar-ao-operacional");
  const disponibilizar = useAssistenteNaUrl("disponibilizar-placa");
  const mudarSituacao = useAssistenteNaUrl("mudar-situacao");
  const engatar = useAssistenteNaUrl("engatar-implemento");
  const desatrelar = useAssistenteNaUrl("desatrelar-implemento");
  const corrigir = useAssistenteNaUrl("corrigir-placa");
  const cancelar = useAssistenteNaUrl("cancelar-pedido");
  const devolver = useAssistenteNaUrl("devolver-placa");
  const botao = useRef<HTMLButtonElement>(null);
  const [criados, setCriados] = useState<ItemCriado[]>([]);
  const catalogos = useMemo(
    () => mesclarCatalogos(dados.catalogos, criados),
    [dados.catalogos, criados],
  );
  const aoItemCriado = (item: ItemCriado) => setCriados((atuais) => [...atuais, item]);

  const placaDaUrl = parametros.get("placa");
  const placaPedida =
    placaDaFicha ??
    (placaDaUrl !== null && placaNormalizadaValida(normalizarPlaca(placaDaUrl))
      ? normalizarPlaca(placaDaUrl)
      : null);

  function escolherPlaca(placa: string) {
    const novos = new URLSearchParams(parametros.toString());
    novos.set("placa", placa);
    router.replace(`${rota}?${novos.toString()}`, { scroll: false });
  }

  const alvo =
    dados.placaAlvo !== null && dados.placaAlvo.placa === placaPedida ? dados.placaAlvo : null;
  const paraMim = (pedido: PedidoDeTransferencia | null) =>
    pedido !== null && dados.gestorId !== null && pedido.paraGestorId === dados.gestorId;
  const etapa = paraMim(dados.pedido) ? etapaDoRecebimento(dados.pedido) : null;
  const comPedido = (qual: "receber" | "concluir") =>
    alvo && dados.pedido && etapa === qual ? { placa: alvo, pedido: dados.pedido } : null;

  const receberGuardado = useGuardadoEnquantoAberto(receber.aberto, comPedido("receber"));
  const concluirGuardado = useGuardadoEnquantoAberto(concluir.aberto, comPedido("concluir"));
  const devolverGuardado = useGuardadoEnquantoAberto(devolver.aberto, comPedido("concluir"));
  const cancelavel =
    alvo !== null &&
    dados.pedido !== null &&
    dados.gestorId !== null &&
    podeCancelarPedido(dados.pedido, dados.gestorId).ok;
  const cancelarGuardado = useGuardadoEnquantoAberto(
    cancelar.aberto,
    cancelavel && alvo && dados.pedido ? { placa: alvo, pedido: dados.pedido } : null,
  );
  const entregarGuardada = useGuardadoEnquantoAberto<PlacaGravada>(
    entregar.aberto,
    alvo && podeEntregar(alvo.sigla, alvo.tipo) ? alvo : null,
  );
  const disponibilizarGuardada = useGuardadoEnquantoAberto<PlacaGravada>(
    disponibilizar.aberto,
    alvo && podeDisponibilizarPlaca({ sigla: alvo.sigla, pedidoAberto: dados.pedido !== null })
      ? alvo
      : null,
  );

  const naoBaixada = alvo !== null && !SIGLAS_DE_BAIXA.includes(alvo.sigla);
  const mudarGuardada = useGuardadoEnquantoAberto<PlacaGravada>(
    mudarSituacao.aberto,
    naoBaixada ? alvo : null,
  );
  const engatarGuardada = useGuardadoEnquantoAberto<PlacaGravada>(
    engatar.aberto,
    naoBaixada && alvo.tipo === "cavalo" ? alvo : null,
  );
  const desatrelarGuardada = useGuardadoEnquantoAberto(
    desatrelar.aberto,
    naoBaixada && alvo.tipo === "cavalo" && dados.conjuntoDaPlaca !== null
      ? { placa: alvo, conjunto: dados.conjuntoDaPlaca }
      : null,
  );
  const corrigirGuardada = useGuardadoEnquantoAberto<PlacaGravada>(
    corrigir.aberto,
    naoBaixada ? alvo : null,
  );

  const abridores: Record<string, () => void> = {
    "mudar-situacao": mudarSituacao.abrir,
    "engatar-implemento": engatar.abrir,
    "desatrelar-implemento": desatrelar.abrir,
    "corrigir-placa": corrigir.abrir,
    "receber-placa": receber.abrir,
    "concluir-recebimento": concluir.abrir,
    "entregar-ao-operacional": entregar.abrir,
    "disponibilizar-placa": disponibilizar.abrir,
    "cancelar-pedido": cancelar.abrir,
    "devolver-placa": devolver.abrir,
  };
  function aoAbrirDaFicha(id: string) {
    const assistente = ASSISTENTE_DA_ACAO[id];
    if (assistente) abridores[assistente]?.();
  }

  const semPlaca = placaPedida === null;
  const nomeDaPlaca = placaPedida ?? "";
  const naoAchou = `Não achamos a placa ${nomeDaPlaca}. Confira a placa ou escolha outra na lista.`;

  return (
    <ProvedorDoUsuario usuario={dados.usuario}>
      {comBotaoDeCadastrar ? (
        <Button ref={botao} onClick={cadastrar.abrir} aria-haspopup="dialog">
          <IconPlus data-icon="inline-start" />
          Cadastrar placa
        </Button>
      ) : null}
      {acoesDaFicha && acoesDaFicha.length > 0 ? (
        <AcoesDaFicha acoes={acoesDaFicha} aoAbrir={aoAbrirDaFicha} />
      ) : null}

      {noNavegador && cadastrar.aberto ? (
        <CadastrarPlaca
          dados={dados}
          catalogos={catalogos}
          aoItemCriado={aoItemCriado}
          aoFechar={cadastrar.fechar}
          focoFinal={botao}
        />
      ) : null}

      {noNavegador && receber.aberto ? (
        receberGuardado ? (
          <ReceberPlaca
            key={receberGuardado.placa.placa}
            placa={receberGuardado.placa}
            pedido={receberGuardado.pedido}
            aoFechar={receber.fechar}
          />
        ) : (
          <EscolherAPlaca
            titulo="Receber placa"
            opcoes={semPlaca ? dados.placasParaReceber : []}
            vazio={
              semPlaca
                ? "Nenhuma placa espera por você. Quando um gestor disponibilizar uma placa para você, ela aparece aqui e em Para receber."
                : alvo === null
                  ? naoAchou
                  : etapa === "concluir"
                    ? `A placa ${nomeDaPlaca} já foi recebida. Use Concluir recebimento para responder as pendências.`
                    : `A placa ${nomeDaPlaca} não tem pedido de transferência esperando por você.`
            }
            aoEscolher={escolherPlaca}
            aoFechar={receber.fechar}
          />
        )
      ) : null}

      {noNavegador && concluir.aberto ? (
        concluirGuardado ? (
          <ConcluirRecebimento
            key={concluirGuardado.placa.placa}
            placa={concluirGuardado.placa}
            pedido={concluirGuardado.pedido}
            aoFechar={concluir.fechar}
          />
        ) : (
          <EscolherAPlaca
            titulo="Concluir recebimento"
            opcoes={semPlaca ? dados.placasParaConcluir : []}
            vazio={
              semPlaca
                ? "Nenhuma placa recebida espera conclusão. Primeiro, use Receber placa."
                : alvo === null
                  ? naoAchou
                  : etapa === "receber"
                    ? `A placa ${nomeDaPlaca} ainda não foi recebida. Use Receber placa antes.`
                    : `A placa ${nomeDaPlaca} não tem recebimento para concluir.`
            }
            aoEscolher={escolherPlaca}
            aoFechar={concluir.fechar}
          />
        )
      ) : null}

      {noNavegador && entregar.aberto ? (
        entregarGuardada ? (
          <EntregarAoOperacional
            key={entregarGuardada.placa}
            placa={entregarGuardada}
            catalogos={catalogos}
            criaveis={dados.criaveis}
            aoItemCriado={aoItemCriado}
            aoFechar={entregar.fechar}
          />
        ) : (
          <EscolherAPlaca
            titulo="Entregar ao Operacional"
            opcoes={semPlaca ? dados.placasParaEntregar : []}
            vazio={
              semPlaca
                ? "Nenhum cavalo ou caminhão está em pátio ou em trânsito vazio. Só estes podem ser entregues ao Operacional."
                : alvo === null
                  ? naoAchou
                  : motivoDeNaoEntregar({ sigla: alvo.sigla, tipo: alvo.tipo }) ===
                      MENSAGEM_DE_TIPO_QUE_NAO_ENTREGA
                    ? `A placa ${nomeDaPlaca} é ${NOMES_DOS_TIPOS[alvo.tipo].toLowerCase()}. ${MENSAGEM_DE_TIPO_QUE_NAO_ENTREGA}`
                    : `A placa ${nomeDaPlaca} está em ${alvo.sigla}. Só placas em PÁT ou ETv podem ser entregues ao Operacional.`
            }
            aoEscolher={escolherPlaca}
            aoFechar={entregar.fechar}
          />
        )
      ) : null}

      {noNavegador && disponibilizar.aberto ? (
        disponibilizarGuardada ? (
          <DisponibilizarPlaca
            key={disponibilizarGuardada.placa}
            placa={disponibilizarGuardada}
            catalogos={catalogos}
            aoFechar={disponibilizar.fechar}
          />
        ) : (
          <EscolherAPlaca
            titulo="Disponibilizar placa"
            opcoes={[]}
            vazio={
              semPlaca
                ? "Abra a ficha da placa (ou busque a placa na lista) e use Disponibilizar placa nela."
                : alvo === null
                  ? naoAchou
                  : dados.pedido !== null
                    ? `A placa ${nomeDaPlaca} já tem um pedido de transferência aberto. Espere a resposta de quem vai receber.`
                    : `A placa ${nomeDaPlaca} está baixada e não pode ser disponibilizada.`
            }
            aoEscolher={escolherPlaca}
            aoFechar={disponibilizar.fechar}
          />
        )
      ) : null}

      {noNavegador && mudarSituacao.aberto ? (
        mudarGuardada ? (
          <MudarSituacao
            key={mudarGuardada.placa}
            placa={mudarGuardada}
            conjunto={dados.conjuntoDaPlaca}
            aoFechar={mudarSituacao.fechar}
          />
        ) : (
          <EscolherAPlaca
            titulo="Mudar situação"
            opcoes={[]}
            vazio={
              semPlaca
                ? ABRA_A_FICHA("Mudar situação")
                : alvo === null
                  ? naoAchou
                  : BAIXADA(nomeDaPlaca)
            }
            aoEscolher={escolherPlaca}
            aoFechar={mudarSituacao.fechar}
          />
        )
      ) : null}

      {noNavegador && cancelar.aberto ? (
        cancelarGuardado ? (
          <CancelarPedido
            key={cancelarGuardado.placa.placa}
            placa={cancelarGuardado.placa}
            pedido={cancelarGuardado.pedido}
            aoFechar={cancelar.fechar}
          />
        ) : (
          <EscolherAPlaca
            titulo="Cancelar pedido"
            opcoes={[]}
            vazio={
              semPlaca
                ? "Abra a ficha da placa que você disponibilizou e use Cancelar pedido nela."
                : alvo === null
                  ? naoAchou
                  : `A placa ${nomeDaPlaca} não tem pedido seu esperando o outro gestor. Depois que ele recebe, o pedido não se cancela mais.`
            }
            aoEscolher={escolherPlaca}
            aoFechar={cancelar.fechar}
          />
        )
      ) : null}

      {noNavegador && engatar.aberto ? (
        engatarGuardada ? (
          <EngatarImplemento
            key={engatarGuardada.placa}
            placa={engatarGuardada}
            conjunto={dados.conjuntoDaPlaca}
            livres={dados.implementosLivres}
            aoFechar={engatar.fechar}
          />
        ) : (
          <EscolherAPlaca
            titulo="Engatar implemento"
            opcoes={[]}
            vazio={
              semPlaca
                ? ABRA_A_FICHA("Engatar implemento")
                : alvo === null
                  ? naoAchou
                  : naoBaixada
                    ? `A placa ${nomeDaPlaca} não é um cavalo. Só o cavalo recebe implementos.`
                    : BAIXADA(nomeDaPlaca)
            }
            aoEscolher={escolherPlaca}
            aoFechar={engatar.fechar}
          />
        )
      ) : null}

      {noNavegador && desatrelar.aberto ? (
        desatrelarGuardada ? (
          <DesatrelarImplemento
            key={desatrelarGuardada.placa.placa}
            placa={desatrelarGuardada.placa}
            conjunto={desatrelarGuardada.conjunto}
            aoFechar={desatrelar.fechar}
          />
        ) : (
          <EscolherAPlaca
            titulo="Desatrelar implemento"
            opcoes={[]}
            vazio={
              semPlaca
                ? ABRA_A_FICHA("Desatrelar implemento")
                : alvo === null
                  ? naoAchou
                  : `A placa ${nomeDaPlaca} não tem implemento engatado para desatrelar.`
            }
            aoEscolher={escolherPlaca}
            aoFechar={desatrelar.fechar}
          />
        )
      ) : null}

      {noNavegador && corrigir.aberto ? (
        corrigirGuardada ? (
          <CorrigirPlaca
            key={corrigirGuardada.placa}
            placa={corrigirGuardada}
            catalogos={catalogos}
            aoFechar={corrigir.fechar}
          />
        ) : (
          <EscolherAPlaca
            titulo="Corrigir placa"
            opcoes={[]}
            vazio={
              semPlaca
                ? ABRA_A_FICHA("Corrigir placa")
                : alvo === null
                  ? naoAchou
                  : BAIXADA(nomeDaPlaca)
            }
            aoEscolher={escolherPlaca}
            aoFechar={corrigir.fechar}
          />
        )
      ) : null}

      {noNavegador && devolver.aberto ? (
        devolverGuardado ? (
          <DevolverPlaca
            key={devolverGuardado.placa.placa}
            placa={devolverGuardado.placa}
            pedido={devolverGuardado.pedido}
            aoFechar={devolver.fechar}
          />
        ) : (
          <EscolherAPlaca
            titulo="Devolver placa"
            opcoes={semPlaca ? dados.placasParaConcluir : []}
            vazio={
              semPlaca
                ? "Nenhuma placa recebida espera por você. Só se devolve a placa depois de recebê-la."
                : alvo === null
                  ? naoAchou
                  : etapa === "receber"
                    ? `A placa ${nomeDaPlaca} ainda não foi recebida. Use Receber placa antes de devolvê-la.`
                    : `A placa ${nomeDaPlaca} não tem recebimento seu para devolver.`
            }
            aoEscolher={escolherPlaca}
            aoFechar={devolver.fechar}
          />
        )
      ) : null}
    </ProvedorDoUsuario>
  );
}
