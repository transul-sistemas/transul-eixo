# Ficha: Administração › Auditoria (a trilha)

Escrita em 11/11/2026. A tela está no catálogo como **esqueleto**, embora a tabela `auditoria.evento` já exista e seja
preenchida por gatilho (`t90_auditoria`) em quase todas as tabelas. **Só desenho da tela.**

## 1. A pergunta que a tela responde

"Quem mudou este dado, quando, de quê para quê e por quê?"

Exemplos da TranSul: quem trocou o CR de uma placa, quem corrigiu o último evento de situação de um conjunto, quem mudou o
dia do corte da competência, quem concedeu uma permissão.

## 2. Quem usa e que decisão toma

- **Administrador**: investiga uma mudança suspeita (um CR que mudou de operação, uma permissão concedida) e decide se
  reverte por ação própria (nunca editando o fato).
- **Diretoria**: lê para aprovar ajustes e conferir o fechamento do mês.
- **Auditor interno ou financeiro (por convite)**: exporta o CSV da trilha de um mês para conferência externa.
- Gestor de frota e Operacional não veem esta tela; veem a **linha do tempo** da própria placa na ficha.

## 3. A ação principal e as ações de cada estado

Ação principal: **Buscar na trilha** (por tabela, registro, pessoa, período e ação). Segunda: **Exportar CSV**.

| Estado | O que a pessoa vê | Ação oferecida |
| --- | --- | --- |
| Carregando | Esqueleto da lista com 20 linhas | nenhuma |
| Vazio (filtro sem evento) | "Nenhuma mudança com estes filtros." | **Limpar filtros** |
| Vazio (período sem mudança) | "Nenhuma mudança registrada neste período." | **Ampliar o período** |
| Erro | "Não foi possível carregar a trilha." | **Tentar de novo** |
| Sem permissão | "A trilha é só do Administrador e da Diretoria." | **Abrir a linha do tempo da placa** |
| Sem dados ainda | "Sem dados ainda: depende de o gatilho de auditoria estar ligado na tabela" | **Ver tabelas sem auditoria** (a lista da revisão estrutural) |
| Dado parcial | Evento sem motivo mostra "sem motivo informado" | **Abrir o registro** |
| Exportação grande | "A exportação passa de 50 mil linhas; filtre por mês." | **Escolher o mês** |

## 4. O elemento de assinatura

O **antes e depois lado a lado**, campo a campo, só com o que mudou, e a **linha do tempo do registro** (do primeiro
evento ao último, com autor, hora e motivo). Cada linha tem o link para o objeto (placa, CR, operação, pessoa) e o olho
(`Ver detalhes de <item>`). Coluna sensível nunca aparece: o gatilho a oculta.

## 5. De onde vem o número

- `auditoria.evento` (tabela, operação INSERT, UPDATE ou DELETE, registro, antes, depois, usuário, hora, motivo) e
  `auditoria.envio` (chave de envio). RLS: leitura só Administrador e Diretoria.
- Lacunas conhecidas (`docs/revisao-estrutural.md`): `leitura_da_placa` e `sinal_do_sankhya` sem auditoria; três
  vínculos de acesso sem trava de delete. A tela mostra uma faixa "Tabelas sem auditoria: N" a partir da matriz, não
  de contagem à mão.
- Com a gerência de processos (P1 em diante), os eventos de processo (`processos.evento`, com o tipo do ator: pessoa,
  serviço, externo) entram na mesma busca.
- Total e paginação vêm do banco; ordenação por `em` com desempate por `id`.

## 6. O vazio honesto

- "Nenhuma mudança registrada com estes filtros. A auditoria cobre as tabelas do núcleo; mudanças no Sankhya não
  aparecem aqui." Convida a **Limpar filtros**.
- Sem gatilho: "Sem dados ainda: depende de a tabela ter o gatilho de auditoria."

## 7. A regra da v1 portada

- Diagnóstico de que "ajuste manual" acontecia **fora do sistema**: `DIAGNOSTICO_SISTEMA.md` (v1). O Eixo traz o ajuste
  para dentro, justificado e com alçada, e a Auditoria mostra o rastro.
- A v1 registrou quem viu o link temporário? Não: `docs/gerenciador-de-processos.md` (link temporário) lista isso como
  defeito. O Eixo registra cada abertura (hora e resumo, sem dado pessoal).
- Sem regra de tela da v1; a necessidade vem do princípio 4 (auditável) de `docs/revisao-estrutural.md`.

## 8. Por que a tela não é uma tabela comum

Uma tabela de logs mostra JSON. Aqui o **antes e depois vira frase** ("CR001 → CR009 em 12/10, motivo: ordem de
serviço"), o evento liga ao objeto, o "tipo de ator" separa pessoa, serviço e externo, e a exportação respeita o filtro
e o perfil. É a resposta a "quem fez isso?", não um depósito.

---

## Rota e estado

- Rota: `/admin/auditoria`. Módulo Administração (cor `#64748B`).
- Quem vê: Administrador e Diretoria (leitura).
- Estado no catálogo: **esqueleto**.

## Estados e rótulos de vigência

Sem vínculo com data próprio. Quando o evento é de um vínculo (placa-CR), mostra "Vigente desde dd/mm" (verde) ou
"Encerrado em dd/mm" (vermelho suave), com ícone, conforme o estado atual do vínculo.

## Atalhos

Ctrl+K: "Abrir auditoria", "Auditar a placa ...". Teclado: `/` foca a busca, Enter abre o painel do evento (olho), Esc
fecha e devolve o foco à linha.

## Dúvidas e hipóteses

- (H) A exportação CSV só leva colunas liberadas e nunca o conteúdo de campo sensível.
- Dúvida: retenção da trilha. Hipótese: a trilha é permanente (diferente do log de sync, que fica 30 dias).
- (H) Limite de 50 mil linhas por exportação.
