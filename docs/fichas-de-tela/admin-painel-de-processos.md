# Administração › Painel de processos (`/admin/painel-de-processos`)

Ficha curta (N3, Fase 1). Tela de painel (`TelaDePainel`, `admin.painel-de-processos`).

- **Pergunta:** o que está aberto, o que venceu e onde está o gargalo (mineração de processo, regra 5).
- **KPIs:** tarefas abertas, vencidas (sinaliza e nunca cancela), vencem até amanhã, na fila do papel.
- **Gráficos:** tempo médio aberto por etapa, em horas (12); vencidas por processo (8); por situação (4).
- **Tabela:** tarefa, processo, assunto, dono (ou "Fila: <papel>"), prazo, dias aberta, situação; chips Vencidas, Vencem até amanhã, No prazo, Na fila; olho em toda linha; ação "Reatribuir tarefa" (ou "Atribuir dono", na fila).
- **Assistentes:** Reatribuir tarefa (Tarefa e novo dono, com busca de pessoas → Motivo → Conferir); Delegar tarefas.
- **Regra:** o Administrador reatribui, mas não age em nome de ninguém (H5): quem recebe conclui.
- **Fonte:** `nucleo.painel_de_processos` (n3-banco); escrita `nucleo.reatribuir_tarefa`. Até lá, exemplo.
- **Ctrl+K:** "Reatribuir tarefa". **CSV:** sim.
