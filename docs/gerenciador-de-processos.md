# Gerenciador de processos

Escrito em 11/11/2026 (Alexandre, conversa de planejamento). **Só desenho: nada aqui está construído.** As
hipóteses H1 a H7 estão em `docs/decisoes.md` (11/11/2026) e esperam confirmação. O plano de fatias está
em `docs/superpowers/plans/2026-11-11-processos-e-vinculos.md`.

## Por que existe

O Eixo é a versão 2 da v1. Não copiamos a v1: ela é o gabarito de processos e de regras (`docs/propostas`,
`DIAGNOSTICO_SISTEMA`, dicionário de indicadores). Portamos **regras**, não tabelas. O que a v1 fazia
errado, corrigimos: uma fonte única por etapa, papel rígido por subsistema e "ajuste manual" feito fora do
sistema.

Toda ação em várias etapas (transferir placa, confirmar a carteira, lançar o dia, dar baixa) é um
**processo**: uma tarefa com dono, prazo e histórico. O wizard é a face da tarefa.

## Conceitos

| Conceito | O que é |
| --- | --- |
| Processo | A definição de um fluxo, **versionada e guardada como dado** (não como código). |
| Passo | Uma etapa do processo: quem age, o que preenche, o que vem depois. |
| Transição | A ligação entre dois passos, com a condição que a libera. |
| Instância | Um caso em andamento de um processo. O assunto é uma placa, uma operação ou um mês. |
| Tarefa | A vez de alguém numa instância: uma pessoa ou a fila de um papel num escopo, com `vence_em` e situação. |
| Evento | Linha do log imutável: quem fez o quê, quando, com que dados. Nunca se edita nem se apaga. |
| Delegação (substituição) | De quem, para quem, início, fim e âmbito. Vale só dentro do período. |
| Responsável | A matriz processo × passo × papel × escopo, também versionada. |

## Três vínculos entre pessoa e função, mais a substituição

| Vínculo | Responde | Exemplo |
| --- | --- | --- |
| **Perfil** | Que áreas do sistema a pessoa abre. | Gestor de frota, Operacional, Diretoria |
| **Papel** | A função de negócio. Amplia `config.papel`. | Gestor de frota, líder de operação, operador de pátio, analista de cadastro, financeiro |
| **Vínculo** | Sobre o que a pessoa responde. | Carteira, operação, filial |
| **Substituição** | Quem cobre quem, e por quanto tempo. | Férias: a carteira da pessoa A vai para a B de 10 a 24 |

Perfil abre a porta; papel diz a função; vínculo diz o escopo. A tarefa usa os três.

## Camada por cima do que existe

As tabelas de negócio continuam a verdade do fato: `transferencia`, `custodia`, `chegada`,
`ordem_de_carregamento`, `confirmacao_da_carteira` e `fila_de_excecoes`. As tarefas **nascem dos estados
delas**, sem reescrevê-las. O gerenciador não vira uma segunda fonte do mesmo fato.

Schema novo `processos`, com as tabelas `processo`, `passo`, `transicao`, `instancia`, `tarefa`, `evento` e
`delegacao`. A RLS segue o escopo de quem vê (módulo × ação × escopo, como no resto do Eixo).

Funções atômicas, cada uma com chave de envio (idempotência) e versão (edição concorrente):

| Função | Faz |
| --- | --- |
| `iniciar_processo` | Abre a instância e cria as primeiras tarefas. |
| `avancar` | Conclui a tarefa, grava o evento e cria a próxima. |
| `minhas_tarefas` | Devolve a caixa da pessoa (as dela e as das filas dos papéis dela). |
| `tarefas_da_fila` | Devolve a fila de um papel num escopo. |
| `pegar_tarefa` | Uma pessoa assume uma tarefa da fila. Só uma consegue. |
| `reatribuir` | Troca o dono da tarefa, com motivo. |
| `delegar` | Cria a substituição com período. |

Sem motor BPMN externo agora: o desenho cabe em tabelas e funções do próprio banco.

## O wizard é o rosto da tarefa

- Abre **do cartão da tarefa**, com o contexto já preenchido.
- Cada passo diz **por que você vê isto** e **o que acontece depois**.
- **Rascunho no banco**, não só no navegador: a pessoa retoma em outro computador.
- **Modo rápido** para quem repete a mesma tarefa: faz em lote, com "X de Y" no fim.
- O passo final mostra o **resumo do antes e do depois** e oferece **desfazer** quando for possível.

## Regras

1. A tarefa cai para o **dono do objeto** (carteira, destino).
2. Sem dono, vai para a **fila do papel**, e alguém a pega.
3. **Quatro olhos** em baixa de placa e em acerto: quem pede não aprova.
4. **Trilha de eventos** completa e imutável.
5. **Mineração de processo**: tempo por etapa, prazo vencido e gargalos aparecem no Painel de processos.
6. Prazo vencido **sinaliza e nunca cancela** (H4).
7. O Administrador reatribui, mas não age em nome de ninguém (H5).
8. Notificação primeiro dentro do sistema; e-mail só depois do SMTP (H7).

## Catálogo inicial, por valor

1. Transferência de placa.
2. Confirmação mensal da carteira.
3. Exceções e cadastro pendente.
4. Lançar o dia.
5. Entrega ao Operacional e retorno.
6. Baixa de placa.
7. Trocar CR (ver `docs/vinculos-com-historia.md`).
8. Fechamento mensal da operação.
9. Depois: acerto de acionista (depende da ponte do Sankhya).

Prazos iniciais (hipótese H4): receber placa em 5 dias; confirmar a carteira até o dia 5 do mês seguinte;
lançar o dia até as 10h do dia seguinte.

## Telas novas

Todas nascem como esqueleto (ver `docs/esqueleto-global.md`).

- **Início › Tarefas**: a caixa, por pessoa e por fila.
- **Administração › Processos e responsáveis**: a definição dos processos e a matriz de responsáveis.
- **Administração › Painel de processos**: tempo por etapa, prazos vencidos e gargalos.

## O que não muda

A fila atual do plano continua: integrar os branches pendentes, esqueleto global, Lançar o dia +
Movimento, Abastecimento v2 e o resto da Parte B. As fatias P1 a P5 entram no plano sem reescrever o que
já existe (a caixa de Tarefas é a Parte B generalizada).
