# Dados de demonstração (só no banco local)

Para ver as telas hoje vazias com números de teste (Operacional, Pessoas e Escala, Parceiros e Locação,
Abastecimento, Acompanhamento e o "Para receber"). Tudo é fictício, marcado e só entra no Supabase
**local**: os scripts recusam qualquer outro banco. A demonstração nunca entra em migration, no seed nem
na nuvem (teste em `scripts/demo-dados.test.ts`).

## O que é marcado como demonstração

| Item | Marca |
| --- | --- |
| Nome de pessoa e de parceiro | começa com "Demo" (ex.: "Demo Ana Almeida") |
| CPF | faixa `95000nnnn-dd` (n de 0001 a 0999), dígitos verificadores válidos |
| CNPJ | faixa `9900nnnn0001-dd`, dígitos verificadores válidos |
| Placa | bloco `ZDM` + dígito + letra + dois dígitos (50 placas: `ZDM0A00` em diante) |
| CR | código `DEMO-n`, CODCENCUS 2990nnn, 4990nnn ou 6990nnn (n de 1 a 50) |
| RENAVAM | prefixo `99000` |
| Abastecimento (staging) | `origem = 'demo'` e `origem_id` começando por `DEMO-` |

O bloco `ZDM`, as faixas de CPF e CNPJ e os CODCENCUS foram conferidos por contagem (zero registros) no
banco local antes de a demonstração existir.

## O que o carregamento cria

`pnpm demo:carregar` usa só as funções atômicas do banco, como um Administrador (a sessão assume, dentro da
transação, o login de Administrador que já existe; sem ele, o script pede `pnpm dev:usuario`):

- Frota e Acompanhamento: 30 cavalos e 20 semirreboques (`cadastrar_ativo`, `criar_cr`, `engatar`), 20
  conjuntos simples e eventos de situação nos últimos 30 dias (`lancar_situacao_do_dia`; os locados em ALU).
- Operacional: 10 cavalos entregues às filiais (`entregar_ao_operacional`), 6 na fila do Totem
  (`registrar_chegada`) e outros em etapas diferentes: aceita, ordem de carregamento (CAr), carregada (CAn)
  e em viagem (`avancar_no_patio`, `criar_ordem_de_carregamento`).
- "Para receber": 5 pedidos de transferência abertos (`disponibilizar_placa`), para o login de gestor de
  frota (ou, se não houver, para um gestor Demo).
- Pessoas e Escala: 60 pessoas com vínculo (`cadastrar_pessoa`) e a escala do mês anterior e do atual até
  hoje (`marcar_escala`), mais 5 gestores Demo (o papel de gestor é a única gravação direta, como no
  `db:dev-dados`).
- Parceiros e Locação: 8 parceiros (`cadastrar_parceiro`) e 5 locações (`cadastrar_locacao`). Os 60
  agrupadores de acionista do Sankhya já pertencem aos parceiros pendentes da carga real, então os
  parceiros Demo ficam sem agrupador.
- Abastecimento: 120 abastecimentos de 10 placas nos 3 meses anteriores, com hodômetro e litros válidos,
  no `staging.abastecimento` (o caminho do schema `staging`).

É idempotente: rodar de novo pula o que já existe. `pnpm demo:ensaio` faz tudo numa transação, mostra as
contagens por área, repete a carga para provar a idempotência e desfaz (rollback): não deixa nada.

## Voltar ao REAL: backups separados

O banco não permite DELETE: não existe "descarregar" a demonstração. A limpeza é por **restauração**.
Por isso, dois backups em pastas separadas, `C:\Backups\eixo\real` e `C:\Backups\eixo\demo`:

1. **Antes de carregar**, o backup do REAL (a senha `EIXO_BACKUP_SENHA` fica no `.env.local`):
   `pnpm backup:banco -- --pasta C:/Backups/eixo/real`
   Confira que o arquivo existe e tem tamanho. Sem ele, não carregue.
2. Carregue: `pnpm demo:carregar`.
3. Opcional, para alternar sem refazer: `pnpm backup:banco -- --pasta C:/Backups/eixo/demo`.
4. **Para voltar ao real**: `pnpm demo:trocar -- real` (mostra o arquivo e não faz nada) e, conferido,
   `pnpm demo:trocar -- real --sim`. Equivale a `pnpm backup:restaurar <arquivo do real>`, que confere o
   arquivo inteiro (senha e integridade) antes de tocar no banco;.
5. **Para voltar à demonstração**: `pnpm demo:trocar -- demo --sim` (usa o backup mais recente de
   `...\demo` e recoloca o abastecimento).
6. Confira o real com `querys/04-conferir-carga-inicial.sql` (hoje: 928 placas, 1.331 CRs analíticos,
   175 conjuntos).

`demo:trocar` só roda no banco local, usa o backup mais recente da pasta e nunca apaga nem move backup.

### O que o backup leva e o que não leva

- **O schema `staging`** (cópia da v1: despesas, viagens, folha, abastecimento, incluindo os lançamentos manuais) entra no backup e volta na restauração, a partir de 10/11/2026. Backups feitos antes dessa data não o têm: refaça o backup do real. Atenção ao `backup:banco --nuvem`: o `pg_dump` falha se o schema `staging` não existir na nuvem.

- **Os logins** (`auth.users`) são do Supabase Auth e não entram. Depois de restaurar, se o login local
  não entrar mais, recrie com `pnpm dev:usuario` (veja `querys/01` a `03` para ligar o login à pessoa e
  ao perfil, e `docs/como-abrir-o-eixo.md`).
## Telas de referência

Abra com `pnpm dev` (o Supabase local ligado) e entre com o login local: Operacional (Pátio, Ordens de
carregamento, Totem), Pessoas (lista e Escala), Parceiros (lista e Locação), Frota (Abastecimento,
Acompanhamento) e Início (Para receber, com o login de gestor de frota).
