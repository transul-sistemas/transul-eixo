# Ficha: Pessoas › Status diário

Escrita em 13/11/2026 (Fase 1, nível 2). Tela de painel (`components/paineis/`), dados fictícios nos exemplos.

1. **A pergunta que a tela responde:** O que cada motorista fez hoje (realizado), distinto da escala?
2. **Quem usa e que decisão toma:** Pessoas e o gestor da carteira: registram o dia e cobrem ausências.
3. **A ação principal e as ações de cada estado:** **Registrar status do dia** e **Indicar substituto** (popups; Ctrl+K). Carregando: esqueleto. Vazio: "Nada a mostrar ainda" (ou "Limpar filtros" com filtro). Erro: "Tentar de novo". Sem a função no banco: fora de produção, dados de exemplo com aviso; em produção, "Sem dados ainda: depende de nucleo.status_diario_das_pessoas".
4. **O elemento de assinatura:** Contagem por status (TBV, TBE, FOL, FÉR, ATS, FRD, FLT, TBX) e o substituto na linha.
5. **De onde vem o número:** `nucleo.status_diario_das_pessoas` (uma função por tela, totais prontos). Grava: nucleo.lancar_status_do_motorista e nucleo.indicar_substituto (A6, n2-banco). Leitura da lista: proposta.
6. **O vazio honesto:** "Sem dados ainda: depende de nucleo.status_diario_das_pessoas" (produção sem a função); nunca R$ 0,00 no lugar.
7. **A regra da v1 portada:** escala da v1 (T, F, FE, AT) vira só sugestão.
8. **Por que a tela não é uma tabela comum:** Causa e efeito: folga ou férias sem substituto deixa o conjunto sem motorista (SMo). Estado na URL (mês, chip, busca, página, tamanho); KPIs e gráficos vêm prontos da mesma leitura; olho em toda linha com o detalhe e "Abrir a ficha" quando há raiz.

**Rota e estado:** `/pessoas/status-diario`, pronta (Fase 1). **Atalhos:** Ctrl+K pela tela e pelas ações listadas.
**Dúvidas e hipóteses:** contrato da função em `lib/dados/painel-tipos.ts` (formato único); a revisar no N2.
