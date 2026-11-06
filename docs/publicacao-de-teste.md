# Publicação de teste do Eixo

Estado da primeira publicação usável (06/11/2026). Decisões em `docs/decisoes.md`; regras de proteção no
`CLAUDE.md` ("Grades de proteção").

## Onde está

| Peça | Onde | Observação |
| --- | --- | --- |
| Banco (Supabase) | projeto `kbyhojdrpzdylexmlsip`, região **us-east-2** | Decisão de Alexandre (06/11/2026): fica nesta região, sem recriar em São Paulo. |
| App (Vercel) | `https://transul-eixo.vercel.app` | Produção deve publicar só da branch `release` (Settings → Git → Production Branch). |
| Conexão do banco | pooler IPv4 `aws-0-us-east-2.pooler.supabase.com:5432`, usuário `postgres.kbyhojdrpzdylexmlsip` | O endereço direto só tem IPv6. A senha nunca vai para arquivo: é digitada na hora. |
| Schemas expostos na API | `nucleo` e `config` | Settings → API → Exposed schemas. |

## O que já está na nuvem (05/11/2026)

- As 26 migrações até `20261105120000_leitura_mantida_relogio` e o seed de catálogos.
- O login de Alexandre ligado ao perfil Administrador (`querys/02`).

## O que falta subir (dry-run de 06/11/2026)

1. As 5 migrações novas: `20261106100000_tipos_de_cr_por_unidade`, `20261106100100_unidade_gerencial_operacao_e_filial`, `20261106150000_cadastro_pendente`, `20261106160000_pessoa_pendente` e `20261106200000_gravar_pelo_banco`. Todas aditivas. A última muda a assinatura de `listar_placas`, `placas_filtradas` e `contar_chips_de_placas`: **o banco e o app sobem juntos** (primeiro as migrações, logo depois a `release`).
2. A carga inicial (CRs e as 928 placas da cópia da v1), uma vez.
3. O app pela `release`, com o CI da `main` todo verde.
4. Os logins dos 12 gestores.

## Roteiro

O roteiro passo a passo (comandos que Alexandre roda, com a senha digitada) está na resposta de 06/11/2026 e
será copiado para cá quando for executado, com o resultado de cada passo e as contagens de conferência.

## Conferência depois da carga (`querys/04-conferir-carga-inicial.sql`; esperado, do banco local)

| O quê | Esperado |
| --- | --- |
| CRs importados (analíticos) e agrupadores | 1.331 e 90 |
| Placas na lista (`nucleo.leitura_da_placa`) | 928 (315 cavalos, 6 caminhões, 607 implementos) |
| Placas com gestor / com CR / com operação | 928 / 845 / 475 |
| Conjuntos vigentes / implementos engatados | 175 / 294 |
| Gestores (pessoas sem login, pendentes de CPF) | 12 |
| Fila aberta: cadastro incompleto / dois CRs do mesmo tipo / situação recusada | 928 / 19 / 3 |

## Antes da produção de verdade

- Supabase Pro e backup (`pnpm backup:banco --nuvem`, com `EIXO_BACKUP_SENHA` no `.env.local`).
- Vercel sem `service_role` nas variáveis (a chave mestra só existe nos workers).
- Senha do banco redefinida (feito por Alexandre em 06/11/2026) e `service_role` fora do `.env.local`.
- Autenticação da ponte do Sankhya (HTTP 400): completa RENAVAM, eixos e carroceria pela placa.
