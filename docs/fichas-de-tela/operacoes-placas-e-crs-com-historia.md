# Ficha: Operações › ficha da operação › Placas e CRs com história

Escrita em 11/11/2026. **Só desenho.** Desenho de origem: `docs/vinculos-com-historia.md` ("Visual" e "O que falta", item
iv). Referência de layout: artefato de Tarefas e Trocar CR, `Operacao-historico.dc.html` (dados fictícios; operações A, B,
C e D são exemplo).

## 1. A pergunta que a tela responde

"Que placas e CRs esta operação tem hoje, quais já passaram por ela, de onde vieram e para onde foram?"

A pergunta do dia a dia: "a placa que saiu em outubro ainda pesa no resultado de setembro desta operação?" (sim: a
operação guarda a placa até a troca).

## 2. Quem usa e que decisão toma

- **Diretoria**: lê entradas e saídas do ano e confere que o resultado de cada mês segue a placa que a operação tinha
  naquele mês. Decide onde reforçar frota.
- **Administrador**: confere a divergência entre a operação do CR e a da placa.
- **Gestor de frota**: **não vê Operações** (decisão de 10/11/2026); recebe o mesmo dado na aba CRs da ficha da placa.
- **Líder da operação** (perfil de negócio, quando existir acesso): confirma a chegada de uma placa.

## 3. A ação principal e as ações de cada estado

Ação principal: **Filtrar o histórico** (chips "Só vigentes", "Incluir histórico", "Entradas e saídas do mês"). Para quem
tem permissão de escrita: **Trocar CR** a partir do olho da linha.

| Estado | O que a pessoa vê | Ação oferecida |
| --- | --- | --- |
| Carregando | Esqueleto dos quatro números e da tabela | nenhuma |
| Vazio (operação sem placa) | "Nenhuma placa vinculada a esta operação." | **Vincular CR** |
| Vazio (só vigentes, sem nenhuma) | "Nenhuma placa vigente hoje." | **Incluir histórico** |
| Erro | "Não foi possível carregar as placas e CRs." | **Tentar de novo** |
| Sem permissão | A aba não aparece; para quem vê Operações sem Resultados, sem valores | **Pedir acesso** |
| Sem dados ainda | Coluna de resultado: "Sem dados ainda: depende da ponte do Sankhya (viagens e despesas)" | **Ver as exceções da operação** |
| Divergência | Placa cuja operação difere da do CR vigente, com selo "diverge" | **Resolver na fila de exceções** |

## 4. O elemento de assinatura

**Vigente em verde e encerrado em vermelho suave, na mesma tabela**, com a coluna "Na operação" (20/02 → hoje; 05/01 →
12/10) e "Onde foi ou de onde veio" ("Foi para a Operação B (CR009). Ver a troca"; "Entrou vinda da Operação C (CR003)";
"Baixa por venda (VND). O CR continua com o histórico"). Quatro números no topo (placas vigentes, CRs vigentes, entraram
no ano, saíram no ano) e a miniatura **mês a mês** das placas na operação, com o mês em curso tracejado.

## 5. De onde vem o número

- Vínculo CR-operação com vigência para **todo CR** (frota, acionista, serviço): generalização de
  `nucleo.cr_de_servico_na_operacao` (fatia V0, caminho de menor risco). Hoje só o CR de serviço tem vigência;
  `nucleo.cr.operacao_id` é rótulo sem história (`docs/cr-regras.md`, divergência 1).
- Placa na operação por data: função única "CR > placa > operação na data D" (C0). Placas vigentes e CRs vigentes: a
  contagem vem do banco.
- Resultado por mês: cascata de Operações (`nucleo.cr_da_operacao_no_mes` e `despesa_na_competencia`), a competência
  gerencial com corte no dia 10; despesa em CR inativo continua contando (H8).
- Até a V0: **Sem dados ainda: depende da vigência do vínculo CR-operação (V0)** para o histórico de CR de frota e de
  acionista.

## 6. O vazio honesto

- Sem histórico: "Esta operação ainda não tem histórico de placas e CRs. O histórico começa a ser guardado a partir da
  próxima troca de CR." Convida a **Trocar CR** (se permitido).
- Operação nova sem placa: "Nenhuma placa vinculada. Vincule o CR de uma placa para a operação começar a contar."

## 7. A regra da v1 portada

- Resultado por operação a partir dos CRs e das placas: `DIAGNOSTICO_SISTEMA.md` e `docs/propostas/2026-10-13-frota-sem-placa.md`
  (v1). A v1 lia o CR de mais de um lugar (split-brain); o Eixo usa **uma função só**.
- A v1 não guardava a operação onde a placa **esteve**: a placa que saía "sumia" do histórico. O Eixo guarda: "a
  história pertence à operação".

## 8. Por que a tela não é uma tabela comum

Uma lista de placas da operação mostraria o agora. Esta mostra o **agora e o antes**, com vigência por CR, de onde a
placa veio e para onde foi, e liga cada linha à troca que a moveu. O resultado de cada mês fica na operação que a placa
tinha **naquele mês**, não na de hoje.

---

## Rota e estado

- Rota: aba "Placas e CRs" da ficha `/operacoes/lista/<id>` (`?aba=placas-e-crs&historico=1`). Módulo Operações (cor
  `#7C5CFF`). A ficha de hoje tem a aba Placas e a aba Mapa mental; a nova aba generaliza a primeira.
- Quem vê: Administrador e Diretoria. Gestor de frota e Operacional não veem Operações.
- Estado no catálogo: a lista é **pronta**; a aba com história é **esqueleto** (V0).

## Estados e rótulos de vigência

"Vigente desde 12/10" (verde, ícone de relógio) e "Encerrado em 12/10" (vermelho suave, ícone de ponto final), **sempre
com rótulo e data**; a linha encerrada tem fundo suave e texto atenuado. Filtro "Só vigentes" ou "Incluir histórico";
contraste AA nos dois temas, com teste.

## Atalhos

Ctrl+K: "Placas e CRs da operação ...". Teclado: `H` alterna "Incluir histórico" (proposta); o olho de fim de linha
(`Ver detalhes de <placa>`) abre o painel lateral; Esc fecha e o foco volta ao botão.

## Dúvidas e hipóteses

- H1 (fechada): a placa segue o CR.
- (H) "Entraram no ano" e "saíram no ano" contam placas distintas, não movimentos.
- Dúvida: a baixa por venda (VND) aparece como "Encerrado" com a causa "baixa"; hipótese: sim, com o mesmo token.
