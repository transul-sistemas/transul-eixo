# Ficha: Operações › Comparativo

Escrita em 13/11/2026 (Fase 1, nível 2). Tela de painel (`components/paineis/`), dados fictícios nos exemplos.

1. **A pergunta que a tela responde:** Qual operação dá mais resultado por real faturado neste mês?
2. **Quem usa e que decisão toma:** Diretoria e Administrador: escolhem onde cobrar ação (operação de margem baixa).
3. **A ação principal e as ações de cada estado:** Ler e abrir a ficha da operação pelo olho. Carregando: esqueleto. Vazio: "Nada a mostrar ainda" (ou "Limpar filtros" com filtro). Erro: "Tentar de novo". Sem a função no banco: fora de produção, dados de exemplo com aviso; em produção, "Sem dados ainda: depende de nucleo.comparativo_das_operacoes".
4. **O elemento de assinatura:** Operações lado a lado com margem e peso na receita, no mesmo mês da competência.
5. **De onde vem o número:** `nucleo.comparativo_das_operacoes` (uma função por tela, totais prontos). Receita (CT-e e NFS-e) e custos pela competência gerencial; glossário: Margem.
6. **O vazio honesto:** "Sem dados ainda: depende de nucleo.comparativo_das_operacoes" (produção sem a função); nunca R$ 0,00 no lugar.
7. **A regra da v1 portada:** sem regra da v1.
8. **Por que a tela não é uma tabela comum:** Compara as operações no mesmo critério do glossário, com o peso na receita e a margem ordenada. Estado na URL (mês, chip, busca, página, tamanho); KPIs e gráficos vêm prontos da mesma leitura; olho em toda linha com o detalhe e "Abrir a ficha" quando há raiz.

**Rota e estado:** `/operacoes/comparativo`, pronta (Fase 1). **Atalhos:** Ctrl+K pela tela e pelas ações listadas.
**Dúvidas e hipóteses:** contrato da função em `lib/dados/painel-tipos.ts` (formato único); a revisar no N2.
