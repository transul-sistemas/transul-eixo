# Ficha: Frota › Acompanhamento › status do motorista (realizado × escala)

Escrita em 11/11/2026. **Só desenho.** Referência de layout: artefato do Acompanhamento, `Main.dc.html` (linha fina do
motorista) e `Detalhe-motorista.dc.html` (dados fictícios). Regra de dois motoristas por conjunto: **fora da primeira
versão** (decisão de Alexandre, 11/11/2026).

## 1. A pergunta que a tela responde

"O motorista deste conjunto trabalhou, folgou ou faltou em cada dia, o que está programado na escala, e a escala vai
deixar algum conjunto sem motorista?"

## 2. Quem usa e que decisão toma

- **Gestor de frota que também vê Pessoas**: liga o que o conjunto fez ao que o motorista fez. Se o conjunto ficou
  parado (FOg, FEr, SMo), vê a causa na linha de baixo. Decide quem indicar de substituto.
- **Líder da operação**: recebe a tarefa quando as férias de um motorista começam sem substituto.
- **Quem não vê Pessoas**: não vê a linha, a aba nem a coluna; **elas não existem** para ele (não ficam vazias).

## 3. A ação principal e as ações de cada estado

Ação principal: **Indicar substituto** (cria a escala do substituto e fecha a tarefa).

| Estado | O que a pessoa vê | Ação oferecida |
| --- | --- | --- |
| Carregando | Linha fina em esqueleto | nenhuma |
| Vazio (conjunto sem motorista vinculado) | "Sem motorista vinculado. Quando houver um vínculo, a linha mostra o status de cada dia." | **Vincular motorista** (abre o wizard de vínculo em Pessoas) |
| Erro | "Não foi possível carregar o motorista." | **Tentar de novo** |
| Sem permissão | A linha, a aba e a coluna não aparecem | **Pedir acesso a Pessoas** (só no Ctrl+K) |
| Sem dados ainda | Dia sem lançamento do motorista: contorno tracejado azul com "—" | **Lançar o dia do motorista** |
| Dado parcial | Escala existe, mas realizado do dia ainda não | **Lançar o dia do motorista** |
| Férias sem substituto | Aviso âmbar "Férias programadas sem substituto" | **Indicar substituto** ou **Criar tarefa para o líder da operação** |

## 4. O elemento de assinatura

A **linha fina do motorista** sob cada conjunto, com o código do dia em contorno **liso quando realizado** e
**pontilhado quando é escala** (TBV, TBE, FOL, FÉR, ATS, FRD, FLT, TBX), e o **calendário do mês** na aba Motorista.
Mais a **causa e efeito** visível: a sigla do conjunto (FEr, SMo) é o efeito; a do motorista é a causa. E o aviso de
férias sem substituto com o primeiro dia sem motorista ("a partir de 20/11 o conjunto fica sem motorista").

## 5. De onde vem o número

- Status diário do motorista e escala: **uma fonte só**. A v1 já tinha o status diário em uso (e pagando as diárias);
  a escala é outra forma de ver e lançar o mesmo dado (Pessoas › Escala, `pessoas.marcacao_da_escala`). No Eixo, hoje
  a escala usa T, F, FE, AT; a conversão para os códigos da v1 é parte do trabalho.
- Vínculo motorista-conjunto: `pessoas.vinculo` com vigência `[início, fim)`, **um motorista por conjunto** na
  primeira versão.
- Contadores ("Até hoje: 10 dias trabalhados, 1 folga, 0 faltas e 0 atestados"): vêm do banco; a tela não soma.
- Remuneração, diária e premiação: ocultas; só quem vê Pessoas e Resultados.
- Sem fonte para o realizado antes da ponte da folha: **Sem dados ainda: depende de Pessoas › Escala (códigos do
  motorista) e da folha**.

## 6. O vazio honesto

- "Sem motorista vinculado a este conjunto." Convida a **Vincular motorista**.
- "Nenhum dia lançado para o motorista em novembro. A escala mostra o programado em pontilhado." Convida a **Lançar o
  dia do motorista**.
- Nunca presume TBV: dia sem lançamento é "—", não trabalho.

## 7. A regra da v1 portada

- Códigos TBV (trabalhando em viagem), TBE (trabalhando em casa), TBX (trabalho extra), FOL, FÉR, ATS, FLT e FRD, o
  status diário do motorista **que paga as diárias**: `docs/propostas/2026-10-13-motoristas-turno-escala.md` (v1,
  achado 3). O Eixo mantém os códigos (decisão de 11/11/2026).
- Regra "a Escala não pode ser uma segunda tabela de presença": mesmo documento. O Eixo aplica em banco: uma tabela,
  duas vistas.
- Dois motoristas por conjunto com turno (v1, proposta de 13/10, nunca construída): **fora da primeira versão**. O
  desenho deixa a coluna `turno` prevista, e a tela mostra um só.

## 8. Por que a tela não é uma tabela comum

Uma tabela mostraria a presença do motorista numa lista de Pessoas. Aqui ele é lido **junto do conjunto, dia a dia**,
com realizado e escala distintos, e a tela transforma uma folga futura em consequência: "este conjunto vai ficar parado
em 20/11", com tarefa e prazo.

---

## Rota e estado

- Rota proposta: linha opcional na grade (`?motorista=1`, caixa "Mostrar a linha do motorista") e aba "Motorista" da
  barra lateral de `/frota/acompanhamento`. Módulo Frota, com recorte por permissão de Pessoas.
- Quem vê: Administrador, Diretoria e quem tem `pessoas.ver`. Gestor de frota hoje **não** vê Pessoas
  (`lib/navegacao/perfis.ts`): decidir se a visão do motorista é liberada ao Gestor para os conjuntos da carteira.
- Estado no catálogo: **esqueleto**.

## Estados e rótulos de vigência

O vínculo do motorista: "Vigente desde 01/10/2026" (verde, ícone). Ao trocar de motorista, o anterior fica "Encerrado
em dd/mm/aaaa" (vermelho suave). Escala futura: pontilhado com o rótulo "escala".

## Atalhos

Ctrl+K: "Indicar substituto", "Abrir escala". Na grade, `M` liga e desliga a linha do motorista (proposta).

## Dúvidas e hipóteses

- (H) Um motorista por conjunto na primeira versão; o turno fica para a 2.0.
- Dúvida: o Gestor de frota passa a ver o motorista (leitura) dos conjuntos da própria carteira? Hipótese: sim, só
  leitura e só o código do dia, sem remuneração.
- (H) A tarefa "indicar substituto" nasce 10 dias antes do primeiro dia de férias sem substituto; o prazo é hipótese.
