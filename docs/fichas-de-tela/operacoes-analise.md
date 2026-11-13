# Ficha: Operações › Análise

Escrita em 13/11/2026 (Fase 1, nível 2). Tela de painel (`components/paineis/`), dados fictícios nos exemplos.

1. **A pergunta que a tela responde:** Por que o resultado de cada operação variou contra o mês anterior?
2. **Quem usa e que decisão toma:** Diretoria: decide em que operação investigar a queda.
3. **A ação principal e as ações de cada estado:** Ler; o olho mostra a variação por camada. Carregando: esqueleto. Vazio: "Nada a mostrar ainda" (ou "Limpar filtros" com filtro). Erro: "Tentar de novo". Sem a função no banco: fora de produção, dados de exemplo com aviso; em produção, "Sem dados ainda: depende de nucleo.analise_das_operacoes".
4. **O elemento de assinatura:** A variação separada em receita, custo da frota e custo de serviço, com a causa principal.
5. **De onde vem o número:** `nucleo.analise_das_operacoes` (uma função por tela, totais prontos). Diferença mês a mês do resultado por operação, calculada no banco.
6. **O vazio honesto:** "Sem dados ainda: depende de nucleo.analise_das_operacoes" (produção sem a função); nunca R$ 0,00 no lugar.
7. **A regra da v1 portada:** sem regra da v1.
8. **Por que a tela não é uma tabela comum:** Explica a variação (camadas e causa), não só lista números. Estado na URL (mês, chip, busca, página, tamanho); KPIs e gráficos vêm prontos da mesma leitura; olho em toda linha com o detalhe e "Abrir a ficha" quando há raiz.

**Rota e estado:** `/operacoes/analise`, pronta (Fase 1). **Atalhos:** Ctrl+K pela tela e pelas ações listadas.
**Dúvidas e hipóteses:** contrato da função em `lib/dados/painel-tipos.ts` (formato único); a revisar no N2.
