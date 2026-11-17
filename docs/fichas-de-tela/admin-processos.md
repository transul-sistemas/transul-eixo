# Administração › Processos e responsáveis (`/admin/processos`)

Ficha curta (N3, Fase 1). Tela de painel (`TelaDePainel`, `admin.processos`).

- **Pergunta:** quem responde por cada passo de cada processo, com que prazo, e quem cobre quem agora.
- **KPIs:** processos, passos com responsável, papéis, substituições vigentes ou futuras.
- **Gráficos:** tarefas abertas e vencidas por processo (12); tarefas por papel (8); com dono × na fila (4).
- **Tabela:** processo × passo × papel × responsável × coberto por × prazo × abertas × vencidas; chips "Com substituição" e um por processo; olho em toda linha; ação "Delegar tarefas" na linha.
- **Assistente:** Delegar tarefas (popup: Quem cobre → Período → Conferir), período `[início, fim)`, sem sobreposição.
- **Fonte:** `nucleo.processos_e_responsaveis` (n3-banco); escrita `nucleo.delegar_tarefas`. Até lá, exemplo fora de produção.
- **Ctrl+K:** "Delegar tarefas". **CSV:** sim.
