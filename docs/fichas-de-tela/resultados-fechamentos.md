# Ficha: Resultados › Fechamentos

Escrita em 13/11/2026 (Fase 1, nível 2). Tela de painel (`components/paineis/`), dados fictícios nos exemplos.

1. **A pergunta que a tela responde:** Quais meses estão fechados e quanto o vivo já se afastou da foto?
2. **Quem usa e que decisão toma:** Diretoria: fecha o mês ou reabre com motivo.
3. **A ação principal e as ações de cada estado:** **Fechar mês** e **Reabrir mês** (popup; Ctrl+K). Reabrir pede o motivo. Carregando: esqueleto. Vazio: "Nada a mostrar ainda" (ou "Limpar filtros" com filtro). Erro: "Tentar de novo". Sem a função no banco: fora de produção, dados de exemplo com aviso; em produção, "Sem dados ainda: depende de nucleo.fechamentos_do_mes".
4. **O elemento de assinatura:** A foto contra o vivo, mês a mês.
5. **De onde vem o número:** `nucleo.fechamentos_do_mes` (uma função por tela, totais prontos). Foto gravada por nucleo.fechar_mes; vivo pela Visão geral. Grava: fechar_mes, reabrir_mes (propostas).
6. **O vazio honesto:** "Sem dados ainda: depende de nucleo.fechamentos_do_mes" (produção sem a função); nunca R$ 0,00 no lugar.
7. **A regra da v1 portada:** sem regra da v1.
8. **Por que a tela não é uma tabela comum:** Guarda a foto imutável e mostra a diferença; reabrir deixa rastro. Estado na URL (mês, chip, busca, página, tamanho); KPIs e gráficos vêm prontos da mesma leitura; olho em toda linha com o detalhe e "Abrir a ficha" quando há raiz.

**Rota e estado:** `/resultados/fechamentos`, pronta (Fase 1). **Atalhos:** Ctrl+K pela tela e pelas ações listadas.
**Dúvidas e hipóteses:** contrato da função em `lib/dados/painel-tipos.ts` (formato único); a revisar no N2.
