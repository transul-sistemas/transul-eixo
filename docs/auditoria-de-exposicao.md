# Auditoria de exposição do repositório

Feita em 11/11/2026 (Alexandre). **O repositório continua público (decisão dele): não vira privado e o histórico
não é reescrito.** Esta auditoria é **só leitura**. **Nenhum valor encontrado aparece aqui**: só a família do
achado, a quantidade, o caminho, o commit em que apareceu e a natureza do dado.

## Escopo e método

- **Histórico inteiro:** 562 commits, 52 referências (17 tags, 24 branches `worktree-agent-*`, as demais são a
  `main` e cópias remotas) e **2.791 arquivos distintos** de todas as versões (inclusive os apagados depois).
- **Método:** padrões de segredo (chaves JWT, `sb_secret_`/`sb_publishable_`, chaves privadas, tokens de
  GitHub, AWS, Slack, OpenAI e Google, strings de conexão com senha, atribuições de senha, segredo e `X-Token`
  com valor literal), de dado pessoal (CPF com e sem formatação, com conferência do dígito; CNPJ; telefone;
  e-mail) e de dinheiro (valores completos a partir de dez mil reais e abreviados em mi, mil e bi); **nomes** de pessoa,
  motorista, acionista, cliente e operação, por **dicionário tirado do banco local** (sem imprimir). Arquivos
  binários zip e xlsx foram abertos por dentro.
- **Limites:** nomes só são achados se estiverem no banco local; primeiros nomes isolados e apelidos só por
  busca manual (feita para dois conhecidos). Valores sem o símbolo R$ não entram na contagem de dinheiro.

## Resultado: nenhum segredo

| Família | Ocorrências no histórico | Leitura |
| --- | --- | --- |
| Chave JWT (`service_role`, `anon`) | **0** | nenhuma chave do Supabase |
| Chave `sb_secret_` ou `sb_publishable_` | **0** | |
| Chave privada | **0** | |
| Token de GitHub, AWS, Slack, OpenAI, Google | **0** | |
| `Client Secret` e `X-Token` com valor literal | **0** | a configuração só traz `env(...)` |
| String de conexão com senha | 25, em 3 arquivos | **todas com marcador no lugar da senha**; ver endereços abaixo |
| Atribuição de senha ou segredo com valor | 43, em 3 arquivos | **marcadores e fixtures de teste**; a única "literal" é uma senha de 11 caracteres de propósito, num teste que prova o mínimo de 12 |

**Conclusão: nada neste repositório precisa ser rotacionado.** O que Alexandre contou sobre credenciais antigas
expostas do Sankhya aconteceu **fora** deste repositório (a integração antiga e o chat): a varredura não achou
`Client Secret` nem `X-Token` aqui, em nenhum commit, branch ou tag.

**Endereços de banco na nuvem (não são credenciais, mas dizem onde o banco está):** `docs/publicacao-de-teste.md`
(3 strings de conexão, com marcador no lugar da senha), `scripts/db-dev-dados.test.ts` (16 ocorrências somando as versões do arquivo: 8 locais e 8 da nuvem) e `scripts/demo-dados.test.ts` (6: 2 locais e 4 da nuvem). Elas mostram o endereço do banco do
projeto da v1 e o do pooler do Eixo. Se alguma senha de banco da nuvem já foi colada fora do `.env.local`, a
rotação é de Alexandre; o repositório não prova isso.

## Dado pessoal

| Família | Ocorrências | Onde | Leitura |
| --- | --- | --- | --- |
| CPF | 88 (76 formatados e 12 soltos), em 12 arquivos | só **testes** (`lib/dominio/*.test.ts`, `lib/dados/pessoas.test.ts`, `scripts/demo-dados.test.ts`, `supabase/tests/10`, `30`, `31`, `35`, `36` e `40`) | fixtures; a maioria passa na conferência do dígito (precisa, para o teste de validação); não dá para provar que nenhum é de pessoa real |
| CNPJ | 25, em 5 arquivos | só testes (`e2e-banco/parceiros.spec.ts`, `lib/dominio/cpf-cnpj.test.ts`, `lib/dominio/esquemas/parceiros.test.ts`, `supabase/tests/10` e `30`) | fixtures |
| Telefone | **0** | | |
| E-mail do domínio da empresa | 9 | `docs/relatorios/2026-11-05-supabase-na-nuvem-e-main-direta.md` (2), `querys/01-tornar-administrador.sql` (2), `querys/02-tornar-alexandre-administrador.sql` (3), `components/navegacao/barra-lateral.test.tsx` (2) | e-mails reais de pessoas da empresa, em texto |
| E-mail de exemplo ou de teste | 50+ | testes, `supabase/config.toml`, `scripts/dev-usuario.ts` | em sua maioria de domínios fictícios (`eixo.local`, `eixo.teste`, `exemplo.com`) |
| **Autor dos commits** | **1 autor, 562 commits** | metadado do Git | o e-mail do autor é real e está em todo commit; **não sai sem reescrever o histórico** |

## Nomes (pessoa, motorista, acionista, cliente, operação)

Pelo dicionário do banco local, no estado atual:

- **Pessoa (nome completo):** 4 nomes distintos em 5 arquivos (`docs/decisoes.md`, `e2e-banco/catalogos-e-acesso.spec.ts`,
  `e2e-banco/parceiros.spec.ts`, `scripts/dev-usuario.ts`, `supabase/seed.sql`).
- **Primeiros nomes de pessoas reais, isolados:** 2, no backlog da 2.0 do `CLAUDE.md` (um cadastro a manter e um
  CPF a confirmar) e repetidos nas decisões. Os nomes não são repetidos aqui.
- **Cliente e operação:** 16 nomes distintos em 22 arquivos. Os maiores: `supabase/migrations/20261106100100_unidade_gerencial_operacao_e_filial.sql`
  (14 nomes: a carga das operações e unidades), `docs/decisoes.md` (7), `scripts/apoio/csv-de-cr-ficticio.ts` (6),
  `supabase/seed.sql` (3), `supabase/tests/60-operacao-por-montagem.test.sql` e `67-unidade-gerencial-e-cr.test.sql`
  (3 cada), `docs/sankhya/mapa.md` (2).
- **Acionista:** nenhum nome de acionista foi achado pelo dicionário (acionistas ainda não estão no banco local
  com nome próprio).

## Dinheiro real (receita, despesa, margem) no estado atual

| Arquivo | Valores completos grandes | Abreviados (mi, mil) | Natureza |
| --- | --- | --- | --- |
| `docs/cr-regras.md` | 9 | 5 | **Receita** de CT-e e de NFS-e de dois meses, total e por série, e a diferença entre as duas regras (seção "Onde o Eixo ainda diverge") |
| `docs/v1-frutos-e-licoes.md` | 0 | 5 | **Custo** absorvido por carretas cedidas a agregados; **receita** de NFS-e e de CT-e sem acerto; receita da série V (seções "O que a v1 deixou aberto" e "Regra de quais CT-e entram na receita") |
| `docs/projeto-tecnico.md` | 0 | 1 | Na seção "Identidade visual": provável falso positivo (conferir) |
| `docs/prototipos/**` | 7 | 0 | **Fictício** (exemplos dos protótipos), fora desta contagem |

Não há **margem** nem **resultado** reais por operação nos documentos, nem **códigos de natureza** nem **contas**.
**No histórico**, as mesmas contas aparecem em versões antigas dos mesmos arquivos (por exemplo, 23 valores grandes
em `docs/cr-regras.md` somando todas as versões): tirar os números do estado atual **não os apaga do histórico**.

**Planilha `docs/sankhya/Eixo_Dados_do_Sankhya.xlsx`:** é o **catálogo de campos** do ERP (9 abas, 4.506 textos
distintos: `VIEWS`, `VEICULOS`, `PARCEIRO_EMPRESAS`, `CENTRO DE RESULTADO`, `ABASTECIMENTO`, `FINANCEIRO`,
`FUNCIONARIOS`, `VIAGEM` e `Perguntas`), com as perguntas e respostas do responsável do Sankhya e o SQL das 14
views. **Não tem dado**: nenhuma placa, data, número, CPF, CNPJ ou e-mail nas abas de campos. É **estrutura do ERP**
(nomes de tabelas e campos), pública.

## Proposta de sanitização (NÃO aplicada; opção de Alexandre)

Cada opção vale para os três documentos com dinheiro real (`docs/cr-regras.md`, `docs/v1-frutos-e-licoes.md`
e, se for o caso, `docs/projeto-tecnico.md`):

| Opção | O que faz | Exemplo (sem valor real) | Custo |
| --- | --- | --- | --- |
| **A. Percentual** | Troca o valor por proporção | "as NFS-e são cerca de 5% da receita do mês" | Perde a escala, mantém o argumento |
| **B. Faixa** | Troca o valor por intervalo | "entre um e cinco milhões de reais por mês" | Perde a precisão, dá a ordem de grandeza |
| **C. Fictício** | Troca por números inventados com a mesma proporção | "40 mil de um total de 800 mil, números inventados" | Precisa avisar "valores fictícios" |
| **D. Manter** | Mantém, e passa a valer a regra nova só para o que for escrito daqui em diante | | O histórico já tem tudo de qualquer jeito |

**Recomendação:** **A** para as comparações de regra (a diferença entre as duas regras de CT-e é 5%, não precisa do
reais) e **B** para a escala do problema (custo absorvido, "milhões por ano"). Para o **histórico** só reescrever
resolveria, e Alexandre decidiu não reescrever. Fora dos documentos: trocar os **e-mails do domínio da empresa** por
`eixo.teste` em `querys/01` e `02`, no relatório de 05/11 e em `barra-lateral.test.tsx`; trocar os **endereços da
nuvem** por marcadores em `docs/publicacao-de-teste.md` e nos dois testes de scripts; trocar os **nomes de
operação e cliente** por códigos nas fixtures e nos documentos (a carga real das operações fica no banco, nunca
na migration). **Autor dos commits:** usar o e-mail `noreply` do GitHub nos commits daqui em diante (o que já saiu
fica no histórico).

## A regra nova

**Documentação não leva CPF, CNPJ, chave, nome de pessoa, de acionista nem de cliente; valores reais de receita,
despesa ou margem só em percentual ou fictício.** O teste `lib/qualidade/documentos-sem-dado-sensivel.test.ts` falha
se um documento tiver padrão de CPF, de CNPJ ou de chave, ou valor monetário grande. Como os documentos de hoje já
têm valores grandes (tabela acima), o teste guarda uma **lista de pendências de sanitização** (como a do olhinho):
**ela só encolhe**; documento novo não entra com valor, e os que estão na lista não podem ter mais do que têm.

## O que Alexandre precisa decidir

1. **Sanitizar os números dos 2 documentos** (e, se for o caso, o 3º): opção A, B, C ou D?
2. **E-mail do autor dos commits:** passar a usar o e-mail `noreply` do GitHub daqui em diante?
3. **E-mails da empresa em texto** (5 arquivos): trocar por `eixo.teste`?
4. **Nomes de operação e cliente** na migration `20261106100100`, no seed, nas fixtures e nos documentos: manter ou trocar
   por códigos?
5. **Endereços de banco da nuvem** em `docs/publicacao-de-teste.md` e nos dois testes: trocar por marcadores? E
   **rotacionar a senha do banco** do projeto da v1 e do projeto do Eixo, se alguma vez foi colada fora do `.env.local`
   (a rotação é dele).
6. **CPFs e CNPJs de fixture** (valores com dígito válido em 12 arquivos de teste): aceitar ou trocar por
   gerados?
7. **A planilha do catálogo do Sankhya** (estrutura do ERP, sem dado): manter pública ou mover?
