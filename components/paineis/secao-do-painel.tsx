import { hojeEmSaoPaulo } from "@/components/formato/data";
import { ValorFormatado } from "@/components/formato/valor";
import { FaixaDeKpis } from "@/components/layout/faixa-de-kpis";
import { ProvedorDoUsuario } from "@/components/navegacao/usuario-da-sessao";
import { type IdDoPainel, lerPainel } from "@/lib/dados/paineis";
import {
  ASSISTENTES_DOS_PAINEIS,
  type IdDoAssistenteDoPainel,
} from "@/lib/dominio/esquemas/paineis";
import { enderecoDoPainel, type EstadoDoPainel } from "@/lib/navegacao/painel";
import { temPermissao } from "@/lib/seguranca/exigir-permissao";
import { exigirSessao } from "@/lib/seguranca/sessao-do-servidor";
import { BotaoDoAssistenteDoPainel } from "./assistente-do-painel";
import { TabelaDoPainel } from "./tabela-do-painel";

// Uma seção de painel dentro de outra tela (os abastecimentos lançados à mão, no Abastecimento): os
// assistentes, os KPIs e a tabela com o olho, lidos da mesma função única do banco.

const ESTADO: EstadoDoPainel = { mes: null, filtro: null, busca: "", pagina: 1, tam: 20 };

export async function SecaoDoPainel({
  id,
  rota,
  assistentes = [],
}: {
  id: IdDoPainel;
  rota: string;
  assistentes?: readonly IdDoAssistenteDoPainel[];
}) {
  const hoje = hojeEmSaoPaulo(new Date());
  const [leitura, sessao] = await Promise.all([lerPainel(id, ESTADO, hoje), exigirSessao()]);
  const permitidos = assistentes.filter((a) =>
    temPermissao(sessao.perfil, ASSISTENTES_DOS_PAINEIS[a].permissao),
  );
  return (
    <ProvedorDoUsuario usuario={sessao.usuarioId}>
      <section
        aria-label={leitura.tabela.titulo || "Lançados à mão"}
        className="flex flex-col gap-3"
      >
        {permitidos.length > 0 ? (
          <div role="group" aria-label="Ações da seção" className="flex flex-wrap gap-2">
            {permitidos.map((a) => (
              <BotaoDoAssistenteDoPainel key={a} id={a} opcoes={leitura.opcoes} hoje={hoje} />
            ))}
          </div>
        ) : null}
        {leitura.origem === "exemplo" ? (
          <p role="note" className="text-muted-foreground text-sm">
            Dados de exemplo: a função {leitura.funcao} ainda não existe no banco.
          </p>
        ) : null}
        <FaixaDeKpis
          kpis={leitura.kpis.map((k) => ({
            id: k.id,
            rotulo: k.rotulo,
            valor: <ValorFormatado valor={k.valor} formato={k.formato} className="text-left" />,
          }))}
        />
        {leitura.origem === "sem-fonte" ? (
          <p className="text-muted-foreground text-sm">
            Sem dados ainda: depende de {leitura.funcao}.
          </p>
        ) : (
          <TabelaDoPainel
            tabela={leitura.tabela}
            enderecoDaPagina={(pagina) => enderecoDoPainel(rota, { ...ESTADO, pagina })}
            enderecoDoTamanho={(tam) => enderecoDoPainel(rota, { ...ESTADO, tam })}
          />
        )}
      </section>
    </ProvedorDoUsuario>
  );
}
