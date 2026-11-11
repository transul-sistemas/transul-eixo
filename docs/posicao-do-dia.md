# Posição do dia

Escrito em 11/11/2026 (Alexandre). **Só desenho: nada aqui está construído.** Referência visual (layout, não
código): `docs/prototipos/tarefas-e-vinculos/5-posicao-do-dia.html` (origem:
https://claude.ai/artifact/R4XnmLHR55bc17ra993Yy6, tela 5). Ficha de tela:
`docs/fichas-de-tela/inicio-posicao-do-dia.md`. Fatia: **M2** em
`docs/superpowers/plans/2026-11-11-processos-e-vinculos.md`. Faz parte do Meu dia (`docs/meu-dia.md`,
tarefa 2 de 3).

## O que é

Um **popup obrigatório** (uma "porta"), uma vez por dia, no primeiro acesso do **gestor de frota**. Ele lista
os **conjuntos da carteira** e **não fecha até todos serem respondidos**. A pergunta é: "Onde estão os seus
conjuntos hoje?".

**Quando abre (decisão de Alexandre, 11/11/2026):** **todos os dias**, no **primeiro acesso depois das 5h**
(fuso de São Paulo). Antes das 5h vale o dia anterior. O "dia" da posição é o do primeiro acesso depois das
5h; fim de semana e feriado contam.

## As respostas, por conjunto

| Resposta | O que faz | Quando usar |
| --- | --- | --- |
| **Continua em `<cidade de ontem>`** | **Um toque.** Repete a cidade de ontem | O caso comum (já vem preenchido pelo que o gestor informou ontem) |
| **Mudou de cidade** | Pede a **cidade e a UF**, por **busca na tabela de cidades** (não texto livre) | O conjunto andou |
| **Sem sinal** | Pede um **motivo** (obrigatório). **Vale como resposta**, e vira **pendência de posição** (uma tarefa) | O gestor não sabe onde está |

**Presets para manutenção e pátio:** quando a situação do conjunto é de manutenção (MAc, MAt, MAv, MAN, REF) ou
de pátio (PÁT), a resposta oferece **"Na oficina da filial X"** e **"No pátio da filial X"**, um toque, sem
buscar cidade (a cidade é a da filial). "Outro lugar" cai na busca de cidade.

**Situação do dia no mesmo passo:** cada linha traz a **situação do conjunto** (as siglas válidas), para o
gestor responder posição e situação juntos. A situação grava o evento de status (`nucleo.evento_de_status`)
pelas mesmas regras de hoje (o cavalo vale para o conjunto, o banco fecha as camadas de prioridade maior).
**A Posição do dia é individual por conjunto** (cada linha é gravada por si; o Lançar o dia em lote, A2, usa a
mesma sigla e a mesma hora para vários conjuntos, mas não substitui esta tela).

## Alerta de distância improvável

Ao responder "Mudou de cidade", o Eixo calcula a **distância por estrada** entre a cidade de ontem e a de hoje
e compara com **o que cabe em um dia**. Se não cabe, mostra o alerta em âmbar ("1.100 km de ontem pela estrada:
improvável em 1 dia") com dois botões: **Está certo** (grava, marcado como "confirmado pelo gestor") ou
**Corrigir** (volta à busca da cidade). Não bloqueia: é um aviso, e a decisão é do gestor.

- O limite é **parâmetro** em `config.parametro` (padrão sugerido: 900 km por dia, a confirmar), editável só
  pelo Administrador, com auditoria.
- **De onde vem a distância:** da tabela de rotas por par de cidades (`nucleo.rota_por_par_de_cidades`, fatia A4),
  quando o par já existe. Antes disso (M2 vem antes de A4), a distância é a **reta entre as coordenadas das
  cidades multiplicada por um fator de sinuosidade** (parâmetro, padrão 1,25), e a tela diz "distância estimada
  em linha reta". Nunca inventa: sem coordenada, **não alerta** e mostra "Sem dados ainda: depende da tabela de
  cidades".

## Rascunho, obrigatoriedade e liberação

- **Rascunho salvo** no banco (não só no navegador): "Salvar rascunho" guarda o que já foi respondido; ao voltar,
  o popup retoma de onde parou. O contador "5 de 6 preenchidos" e o botão "Falta 1 conjunto" mostram o que falta.
- **Não fecha até responder todos.** O botão de concluir fica desligado ("Falta 1 conjunto") e o Esc não
  fecha. A única saída sem responder é **sair do sistema**.
- **Liberação só pelo líder da operação**, **com motivo registrado** (por exemplo, "queda do sistema"). A liberação
  vale para aquele gestor e aquele dia e fica no histórico. O Administrador **não** libera em nome do líder (H5).
- O que ficou sem resposta por liberação vira **pendência de posição** (tarefa), nunca some.

## Privacidade (LGPD)

A posição é **da placa, em nível de cidade, nunca de pessoa**. Não há horário nem coordenada de GPS: um ponto
por conjunto por dia. O **acesso é por perfil** e por escopo (RLS): o gestor vê a posição da sua carteira; o
Operacional, a da sua filial; a Diretoria e o Administrador, a visão completa. O popup mostra o aviso: "A posição
é da placa, em nível de cidade, e não de uma pessoa. Quem pode ver o histórico é definido por perfil." Posição
nunca aparece na linha ou na aba do motorista.

## Modelo de dados proposto

Tudo em português, `snake_case`, com RLS, versão, exclusão lógica com motivo e `DELETE` recusado (a posição
**nunca se apaga**: corrigir é excluir logicamente com motivo e gravar a nova).

- `config.cidade` (id, nome, UF, estado, região, latitude, longitude): **definitiva**, carregada a partir de
  `cidades_brasil` do dump da v1 (`C:\Backups\transul_v1_completo.dump`, só leitura: **5.571 linhas**, colunas
  `id`, `nome`, `uf`, `estado`, `regiao`, `latitude`, `longitude`; só nomes de coluna e contagem).
- `nucleo.posicao_do_conjunto` (ativo do cavalo, dia, cidade, **origem** (`gestor`, `sankhya` ou `v1`), sem sinal,
  motivo, quem registrou e quando, confirmou o alerta, versão, exclusão lógica com motivo). **Chave única por
  conjunto, dia e origem** (entre as linhas não excluídas).
- `nucleo.liberacao_da_posicao` (gestor, dia, liberado por, motivo, quando): a porta aberta pelo líder.
- **Pendência de posição:** um tipo novo da fila de exceções (`posicao_pendente`), com dono (o gestor) e prazo
  (parâmetro).
- **Carga provisória da v1:** `staging.posicao_diaria` a partir de `vehicle_posicoes_diarias` (5.147 pontos, 165
  veículos, de 27/07 a 28/10/2026, nível de cidade), com origem `v1`; o `vehicle_id` vira placa na carga, e o script
  mostra só agregados.
- **Funções (M2):** `nucleo.posicoes_do_dia(p_dia)` (leitura: os conjuntos da carteira com a posição de ontem, o
  rascunho e o que falta); `nucleo.registrar_posicao_do_dia(...)` (atômica por conjunto, com chave de envio e
  versão, grava posição e situação do dia); `nucleo.liberar_posicao_do_dia(...)` (só o líder, motivo
  obrigatório); `nucleo.distancia_improvavel(...)` (somente leitura).

## Ligações

- **Rota na rodovia (A4):** passa a usar estas posições como **fonte principal** (a carga da v1 é só o histórico
  inicial). A4 **depende de M2**, não só do dump da v1.
- **Movimento (A2):** a posição do dia aparece na linha do tempo do conjunto.
- **Alerta de parado há N dias na mesma cidade:** a série de posições sinaliza o conjunto que não saiu (N é
  parâmetro); vira aviso na linha da grade, nunca bloqueio.
- **Operacional:** a filial vê a posição dos conjuntos da sua operação para o pátio e o totem.
- **Meu dia:** o popup é o passo 2 da fila guiada; ao concluir, abre "Confirmar carteira".

## Testes de aceite (M2)

- pgTAP: chave única por conjunto, dia e origem; corrigir exclui logicamente e grava a nova, `DELETE` recusado;
  RLS por perfil (gestor só a sua carteira; sem posição de motorista); só o líder libera, com motivo; "Sem sinal"
  gera a pendência uma única vez.
- Unitário: a regra das 5h (antes das 5h vale o dia anterior); a distância improvável (limite, fator, sem
  coordenada não alerta); o preset de oficina e de pátio usa a cidade da filial.
- e2e: o popup abre no primeiro acesso, não fecha com conjunto faltando, aceita "Sem sinal" com motivo, mostra o
  alerta e "Está certo" grava; checklist de fidelidade ao protótipo e capturas a 1366 claro e escuro.

**Parada com checkpoint:** a M2 tem tabelas e funções de banco novas (dado de localização de ativo, RLS):
para no checkpoint e espera o "aprovado" antes de aplicar no banco local.
