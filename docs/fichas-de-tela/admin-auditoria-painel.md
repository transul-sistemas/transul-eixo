# Ficha: Administração › Auditoria (construção da Fase 1)

Escrita em 13/11/2026 (Fase 1, nível 2). Tela de painel (`components/paineis/`), dados fictícios nos exemplos.

1. **A pergunta que a tela responde:** Quem mudou o quê, quando e por quê?
2. **Quem usa e que decisão toma:** Administrador e Diretoria (ver admin-auditoria.md).
3. **A ação principal e as ações de cada estado:** Ler; chips inclusão, edição, exclusão. Carregando: esqueleto. Vazio: "Nada a mostrar ainda" (ou "Limpar filtros" com filtro). Erro: "Tentar de novo". Sem a função no banco: fora de produção, dados de exemplo com aviso; em produção, "Sem dados ainda: depende de nucleo.eventos_de_auditoria".
4. **O elemento de assinatura:** Eventos por dia e por módulo.
5. **De onde vem o número:** `nucleo.eventos_de_auditoria` (uma função por tela, totais prontos). auditoria.evento, leitura paginada com RLS (função proposta).
6. **O vazio honesto:** "Sem dados ainda: depende de nucleo.eventos_de_auditoria" (produção sem a função); nunca R$ 0,00 no lugar.
7. **A regra da v1 portada:** sem regra da v1.
8. **Por que a tela não é uma tabela comum:** Trilha completa por registro; complementa admin-auditoria.md. Estado na URL (mês, chip, busca, página, tamanho); KPIs e gráficos vêm prontos da mesma leitura; olho em toda linha com o detalhe e "Abrir a ficha" quando há raiz.

**Rota e estado:** `/admin/auditoria`, pronta (Fase 1). **Atalhos:** Ctrl+K pela tela e pelas ações listadas.
**Dúvidas e hipóteses:** contrato da função em `lib/dados/painel-tipos.ts` (formato único); a revisar no N2.
