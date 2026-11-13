# Ficha: Resultados › Ajustes

Escrita em 13/11/2026 (Fase 1, nível 2). Tela de painel (`components/paineis/`), dados fictícios nos exemplos.

1. **A pergunta que a tela responde:** Que correções justificadas estão pedidas, aprovadas ou recusadas?
2. **Quem usa e que decisão toma:** Quem pede ajuste e a alçada que aprova (quem pede não aprova).
3. **A ação principal e as ações de cada estado:** **Pedir ajuste** (popup; Ctrl+K): valor e destino, justificativa, conferir. Carregando: esqueleto. Vazio: "Nada a mostrar ainda" (ou "Limpar filtros" com filtro). Erro: "Tentar de novo". Sem a função no banco: fora de produção, dados de exemplo com aviso; em produção, "Sem dados ainda: depende de nucleo.ajustes_do_resultado".
4. **O elemento de assinatura:** O ajuste ao lado do fato, nunca editando o Sankhya.
5. **De onde vem o número:** `nucleo.ajustes_do_resultado` (uma função por tela, totais prontos). Tabela de ajustes com alçada. Grava: nucleo.pedir_ajuste (proposta).
6. **O vazio honesto:** "Sem dados ainda: depende de nucleo.ajustes_do_resultado" (produção sem a função); nunca R$ 0,00 no lugar.
7. **A regra da v1 portada:** sem regra da v1.
8. **Por que a tela não é uma tabela comum:** Cada linha é uma explicação do número, com situação e justificativa. Estado na URL (mês, chip, busca, página, tamanho); KPIs e gráficos vêm prontos da mesma leitura; olho em toda linha com o detalhe e "Abrir a ficha" quando há raiz.

**Rota e estado:** `/resultados/ajustes`, pronta (Fase 1). **Atalhos:** Ctrl+K pela tela e pelas ações listadas.
**Dúvidas e hipóteses:** contrato da função em `lib/dados/painel-tipos.ts` (formato único); a revisar no N2.
