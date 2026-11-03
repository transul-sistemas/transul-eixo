"use client";

import { IconPlus } from "@tabler/icons-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AcoesDaFicha } from "@/components/ficha/acoes-da-ficha";
import { Button } from "@/components/ui/button";
import { useAssistenteNaUrl } from "@/components/wizard/use-assistente-na-url";
import type { DadosDosAssistentes } from "@/lib/dados/escrita-tipos";
import { mesclarCatalogos } from "@/lib/dados/catalogos-locais";
import type { ItemCriado } from "@/lib/dados/escrita-tipos";
import {
  MENSAGEM_DE_TIPO_QUE_NAO_DISPONIBILIZA,
  motivoDeNaoDisponibilizar,
  podeDisponibilizar,
} from "@/lib/dominio/custodia";
import { NOMES_DOS_TIPOS } from "@/lib/dados/placas-tipos";
import { normalizarPlaca, placaNormalizadaValida } from "@/lib/dominio/placa";
import { CadastrarPlaca } from "./cadastrar-placa";
import { DisponibilizarAoOperacional } from "./disponibilizar-ao-operacional";
import { EscolherAPlaca } from "./escolher-a-placa";
import { ReceberPlaca } from "./receber-placa";

// O hospedeiro dos três assistentes da Frota: abre o que a URL pede (`?assistente=`), na lista de
// placas, na ficha e pelo Ctrl+K. Guarda o que o assistente aberto recebeu: depois de gravar, a tela
// atualiza por baixo e a mensagem "concluído" não pode sumir junto com o pedido que acabou de ser
// atendido.

const semAssinatura = () => () => {};

/** Guarda o primeiro valor pronto enquanto o assistente está aberto; ao fechar, solta. */
function useGuardadoEnquantoAberto<T>(aberto: boolean, agora: T | null): T | null {
  const [guardado, setGuardado] = useState<T | null>(null);
  if (!aberto && guardado !== null) setGuardado(null);
  else if (aberto && guardado === null && agora !== null) setGuardado(agora);
  return aberto ? (guardado ?? agora) : null;
}

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
  const disponibilizar = useAssistenteNaUrl("disponibilizar");
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

  const prontoParaReceber =
    dados.placaAlvo !== null && dados.pedido !== null && dados.placaAlvo.placa === placaPedida
      ? { placa: dados.placaAlvo, pedido: dados.pedido, candidatos: dados.candidatosDoConjunto }
      : null;
  const receberGuardado = useGuardadoEnquantoAberto(receber.aberto, prontoParaReceber);
  const prontoParaDisponibilizar =
    dados.placaAlvo !== null &&
    dados.placaAlvo.placa === placaPedida &&
    podeDisponibilizar(dados.placaAlvo.sigla, dados.placaAlvo.tipo)
      ? dados.placaAlvo
      : null;
  const disponibilizarGuardada = useGuardadoEnquantoAberto(
    disponibilizar.aberto,
    prontoParaDisponibilizar,
  );

  function aoAbrirDaFicha(id: string) {
    if (id === "frota.receber-placa") receber.abrir();
    else if (id === "frota.disponibilizar-ao-operacional") disponibilizar.abrir();
  }

  const semPlaca = placaPedida === null;
  const nomeDaPlaca = placaPedida ?? "";

  return (
    <>
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
            candidatos={receberGuardado.candidatos}
            catalogos={catalogos}
            hoje={dados.hoje}
            aoItemCriado={aoItemCriado}
            aoFechar={receber.fechar}
          />
        ) : (
          <EscolherAPlaca
            titulo="Receber placa"
            opcoes={semPlaca ? dados.placasComPedido : []}
            vazio={
              semPlaca
                ? "Nenhuma placa tem pedido de transferência esperando por você. Quando um gestor transferir uma placa, ela aparece aqui."
                : dados.placaAlvo === null
                  ? `Não achamos a placa ${nomeDaPlaca}. Confira a placa ou escolha outra na lista.`
                  : `A placa ${nomeDaPlaca} não tem pedido de transferência pendente. Quando um gestor transferi-la, o pedido aparece aqui.`
            }
            aoEscolher={escolherPlaca}
            aoFechar={receber.fechar}
          />
        )
      ) : null}

      {noNavegador && disponibilizar.aberto ? (
        disponibilizarGuardada ? (
          <DisponibilizarAoOperacional
            key={disponibilizarGuardada.placa}
            placa={disponibilizarGuardada}
            catalogos={catalogos}
            aoItemCriado={aoItemCriado}
            aoFechar={disponibilizar.fechar}
          />
        ) : (
          <EscolherAPlaca
            titulo="Disponibilizar ao Operacional"
            opcoes={semPlaca ? dados.placasParaDisponibilizar : []}
            vazio={
              semPlaca
                ? "Nenhuma placa está em pátio, vazia ou em trânsito vazio. Só estas podem ser disponibilizadas ao Operacional."
                : dados.placaAlvo === null
                  ? `Não achamos a placa ${nomeDaPlaca}. Confira a placa ou escolha outra na lista.`
                  : motivoDeNaoDisponibilizar({
                        sigla: dados.placaAlvo.sigla,
                        tipo: dados.placaAlvo.tipo,
                      }) === MENSAGEM_DE_TIPO_QUE_NAO_DISPONIBILIZA
                    ? `A placa ${nomeDaPlaca} é ${NOMES_DOS_TIPOS[dados.placaAlvo.tipo].toLowerCase()}. ${MENSAGEM_DE_TIPO_QUE_NAO_DISPONIBILIZA}`
                    : `A placa ${nomeDaPlaca} está em ${dados.placaAlvo.sigla}. Só placas em PÁT ou ETv podem ser disponibilizadas ao Operacional.`
            }
            aoEscolher={escolherPlaca}
            aoFechar={disponibilizar.fechar}
          />
        )
      ) : null}
    </>
  );
}
