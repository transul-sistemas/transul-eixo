# Ficha: Pessoas › Análise

Escrita em 13/11/2026 (Fase 1, nível 2). Tela de painel (`components/paineis/`), dados fictícios nos exemplos.

1. **A pergunta que a tela responde:** Como o efetivo e as ausências variaram?
2. **Quem usa e que decisão toma:** Diretoria e Pessoas.
3. **A ação principal e as ações de cada estado:** Ler; chips por função. Carregando: esqueleto. Vazio: "Nada a mostrar ainda" (ou "Limpar filtros" com filtro). Erro: "Tentar de novo". Sem a função no banco: fora de produção, dados de exemplo com aviso; em produção, "Sem dados ainda: depende de nucleo.analise_das_pessoas".
4. **O elemento de assinatura:** Efetivo e ausências mês a mês, por motivo.
5. **De onde vem o número:** `nucleo.analise_das_pessoas` (uma função por tela, totais prontos). Escala e vínculos agregados por mês no banco.
6. **O vazio honesto:** "Sem dados ainda: depende de nucleo.analise_das_pessoas" (produção sem a função); nunca R$ 0,00 no lugar.
7. **A regra da v1 portada:** sem regra da v1.
8. **Por que a tela não é uma tabela comum:** Explica a ausência por motivo, função e filial. Estado na URL (mês, chip, busca, página, tamanho); KPIs e gráficos vêm prontos da mesma leitura; olho em toda linha com o detalhe e "Abrir a ficha" quando há raiz.

**Rota e estado:** `/pessoas/analise`, pronta (Fase 1). **Atalhos:** Ctrl+K pela tela e pelas ações listadas.
**Dúvidas e hipóteses:** contrato da função em `lib/dados/painel-tipos.ts` (formato único); a revisar no N2.
