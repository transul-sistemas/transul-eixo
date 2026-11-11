# Ficha: Frota › Acompanhamento › Legenda e siglas

Escrita em 11/11/2026. **Só desenho.** Referência de layout: artefato do Acompanhamento, `Legenda.dc.html` (dados
fictícios). Fonte da régua: `docs/glossario.md` ("Status da placa").

## 1. A pergunta que a tela responde

"O que significa cada sigla e cada marca que eu vejo na grade, e qual é a diferença entre a sigla do conjunto e a do
motorista?"

## 2. Quem usa e que decisão toma

- **Gestor de frota novo na carteira**: aprende as siglas antes de lançar o primeiro dia e escolhe a certa
  (MAv ou MAN? PÁT ou DOp?).
- **Diretoria**: confere o que "Impedida" e "Atenção" agrupam antes de ler a disponibilidade do dia.
- **Quem imprime**: leva a legenda impressa ao pátio ou à reunião de operação.
- Decisão que muda: lançar a sigla certa, não a parecida.

## 3. A ação principal e as ações de cada estado

Ação principal: **Buscar sigla ou palavra**. Segunda: **Imprimir legenda** (salvar em PDF).

| Estado | O que a pessoa vê | Ação oferecida |
| --- | --- | --- |
| Carregando | Esqueleto dos grupos | nenhuma |
| Vazio (busca sem resultado) | "Nenhuma sigla com 'xyz'." | **Limpar a busca** |
| Erro | "Não foi possível montar a legenda." | **Tentar de novo** |
| Sem permissão | Não existe: a legenda é leitura aberta a quem vê a Frota | **Pedir acesso à Frota** |
| Sem dados ainda | Não se aplica: a legenda vem da régua, não de dado de operação | nenhuma |
| Dado parcial (sigla sem descrição) | Impossível: um teste falha o CI | nenhuma |

## 4. O elemento de assinatura

**A legenda gerada da régua de status**, nunca digitada: toda sigla tem nome, grupo e significado, e **um teste falha
se faltar um deles**. Os **tons de verde** explicados ("quanto mais escuro, mais perto de gerar receita": ETc, depois
DEs e CAr, ETv, ACe ADe CAn, DOp). A seção **"o motorista e o conjunto"**: a sigla do conjunto (FOg, FEr, SMo) é o
efeito; a do motorista (TBV, TBE, TBX, FOL, FÉR, FRD, ATS, FLT) é a causa. E as **marcas da célula**: "lançar",
programado, selo de quantidade, "!" de escala sem substituto.

## 5. De onde vem o número

Não há número de operação. O conteúdo vem do catálogo da régua (25 siglas, cada uma marcada como válida para
conjunto, solo ou ambos, e o chip: Em atividade, Impedida, Atenção, Pátio, Fora) e do catálogo dos códigos do
motorista. Nome do conjunto: tabela de nomenclatura (Simples: 1 semirreboque de 1 a 6 eixos; Bitrem: 2 de 2 eixos;
Bitrezão: 2 de 3 eixos; Rodotrem: 2 de 2 eixos com dolly no meio; Caminhão: sem implemento). Tom: tokens de status do
Eixo (nada de cor escrita à mão).

## 6. O vazio honesto

- Busca sem resultado: "Nenhuma sigla ou palavra encontrada com 'xyz'. Tente o nome da situação, como 'folga'."
  Botão: **Limpar a busca**.
- Não existe tela vazia da legenda; se o catálogo viesse vazio, o CI já teria falhado.

## 7. A regra da v1 portada

- A v1 tinha 15 siglas e a lista de "bem parado" à parte: `docs/propostas/2026-10-02-status-diario.md`. O Eixo
  unifica numa régua de 25 siglas (o VAz saiu em 03/11/2026: PÁT cobre qualquer ativo parado).
- Códigos do motorista TBV, TBE, FOL, FÉR, ATS, FRD, FLT, TBX: `docs/propostas/2026-10-13-motoristas-turno-escala.md`
  (v1). Decisão de Alexandre em 11/11/2026: usar os mesmos códigos.
- O Eixo melhora: a legenda é gerada (a v1 mantinha a lista à mão em mais de um lugar) e a sigla **sempre aparece
  escrita**, ninguém distingue só pela cor.

## 8. Por que a tela não é uma tabela comum

Uma tabela de siglas seria digitada e envelheceria. Esta é gerada da régua, tem busca, aparece também ao passar o
mouse ou tocar em qualquer sigla da grade, explica o **efeito e a causa** entre motorista e conjunto e imprime em PDF
com os mesmos tons.

---

## Rota e estado

- Rota proposta: `/frota/acompanhamento/legenda` (e o botão "? Legenda" do cabeçalho da grade abre a mesma página em
  painel). Módulo Frota.
- Quem vê: Administrador, Diretoria, Gestor de frota.
- Estado no catálogo: **esqueleto** (proposta; hoje a legenda é uma linha curta sob a grade).

## Estados e rótulos de vigência

Sem vínculo com data. A observação "DOp não é lançada no dia: nasce da entrega ao Operacional" e "ALU, EMP, VEN, SUC e
VND nascem da posse e da baixa" ficam visíveis ao lado das siglas.

## Atalhos

Ctrl+K: "Abrir legenda e siglas". `/` foca a busca; Esc limpa a busca; Ctrl+P imprime (a folha de impressão esconde
a barra lateral e os filtros).

## Dúvidas e hipóteses

- (H) A legenda do motorista fica na mesma página, em seção própria, em vez de página separada.
- (H) O agrupamento da legenda segue os cinco grupos do wizard; o do artefato de referência (que põe FOg, FEr e SMo em
  "falta de motorista") é só inspiração e foi ajustado para os grupos aprovados.
