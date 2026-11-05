// Arquivo gerado por `pnpm db:tipos` a partir do banco local. NÃO edite à mão.
// Para atualizar: `pnpm exec supabase start` e `pnpm db:tipos`. O CI falha se estiver defasado.


export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "config": {
          Tables: {
            "acao": {
                  Row: {
                    "codigo": string,"nome": string
                  }
                  ComputedFields: never
                  Insert: {
                    "codigo": string,"nome": string
                  }
                  Update: {
                    "codigo"?: string,"nome"?: string
                  }
                  Relationships: [
                    
                  ]
                },"camada_de_status": {
                  Row: {
                    "codigo": string,"nome": string,"prioridade": number
                  }
                  ComputedFields: never
                  Insert: {
                    "codigo": string,"nome": string,"prioridade": number
                  }
                  Update: {
                    "codigo"?: string,"nome"?: string,"prioridade"?: number
                  }
                  Relationships: [
                    
                  ]
                },"campo_corrigivel": {
                  Row: {
                    "campo": string,"coluna_da_origem": string,"ordem": number,"pendente_com": string | null,"pendente_em": (Database["nucleo"]['Enums']["tipo_de_ativo"])[],"rotulo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "campo": string,"coluna_da_origem": string,"ordem": number,"pendente_com"?: string | null,"pendente_em"?: (Database["nucleo"]['Enums']["tipo_de_ativo"])[],"rotulo": string
                  }
                  Update: {
                    "campo"?: string,"coluna_da_origem"?: string,"ordem"?: number,"pendente_com"?: string | null,"pendente_em"?: (Database["nucleo"]['Enums']["tipo_de_ativo"])[],"rotulo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "campo_corrigivel_pendente_com_fkey"
      columns: ["pendente_com"]
isOneToOne: false
      referencedRelation: "campo_corrigivel"
      referencedColumns: ["campo"]
    }
                  ]
                },"carroceria": {
                  Row: {
                    "criado_em": string,"excluido_em": string | null,"excluido_por": string | null,"id": string,"motivo_da_exclusao": string | null,"nome": string,"versao": number
                  }
                  ComputedFields: never
                  Insert: {
                    "criado_em"?: string,"excluido_em"?: string | null,"excluido_por"?: string | null,"id"?: string,"motivo_da_exclusao"?: string | null,"nome": string,"versao"?: number
                  }
                  Update: {
                    "criado_em"?: string,"excluido_em"?: string | null,"excluido_por"?: string | null,"id"?: string,"motivo_da_exclusao"?: string | null,"nome"?: string,"versao"?: number
                  }
                  Relationships: [
                    
                  ]
                },"configuracao_de_conjunto": {
                  Row: {
                    "codigo": string,"com_dolly": boolean,"conferencia": string,"conferida_em": string | null,"conferida_por": string | null,"eixos_do_dolly": number | null,"eixos_dos_semirreboques": (number)[],"nome": string,"referencia_normativa": string | null,"unidades": number,"versao": number
                  }
                  ComputedFields: never
                  Insert: {
                    "codigo": string,"com_dolly": boolean,"conferencia"?: string,"conferida_em"?: string | null,"conferida_por"?: string | null,"eixos_do_dolly"?: number | null,"eixos_dos_semirreboques": (number)[],"nome": string,"referencia_normativa"?: string | null,"unidades": number,"versao"?: number
                  }
                  Update: {
                    "codigo"?: string,"com_dolly"?: boolean,"conferencia"?: string,"conferida_em"?: string | null,"conferida_por"?: string | null,"eixos_do_dolly"?: number | null,"eixos_dos_semirreboques"?: (number)[],"nome"?: string,"referencia_normativa"?: string | null,"unidades"?: number,"versao"?: number
                  }
                  Relationships: [
                    
                  ]
                },"escopo": {
                  Row: {
                    "codigo": string,"nome": string
                  }
                  ComputedFields: never
                  Insert: {
                    "codigo": string,"nome": string
                  }
                  Update: {
                    "codigo"?: string,"nome"?: string
                  }
                  Relationships: [
                    
                  ]
                },"filial": {
                  Row: {
                    "criado_em": string,"excluido_em": string | null,"excluido_por": string | null,"id": string,"motivo_da_exclusao": string | null,"nome": string,"versao": number
                  }
                  ComputedFields: never
                  Insert: {
                    "criado_em"?: string,"excluido_em"?: string | null,"excluido_por"?: string | null,"id"?: string,"motivo_da_exclusao"?: string | null,"nome": string,"versao"?: number
                  }
                  Update: {
                    "criado_em"?: string,"excluido_em"?: string | null,"excluido_por"?: string | null,"id"?: string,"motivo_da_exclusao"?: string | null,"nome"?: string,"versao"?: number
                  }
                  Relationships: [
                    
                  ]
                },"filial_do_cr": {
                  Row: {
                    "codigo": string,"conferencia": string,"criado_em": string,"ordem": number,"origem": Database["config"]['Enums']["origem_do_campo"],"rotulo": string,"sugestao_na_importacao": string | null,"versao": number
                  }
                  ComputedFields: never
                  Insert: {
                    "codigo": string,"conferencia"?: string,"criado_em"?: string,"ordem": number,"origem"?: Database["config"]['Enums']["origem_do_campo"],"rotulo": string,"sugestao_na_importacao"?: string | null,"versao"?: number
                  }
                  Update: {
                    "codigo"?: string,"conferencia"?: string,"criado_em"?: string,"ordem"?: number,"origem"?: Database["config"]['Enums']["origem_do_campo"],"rotulo"?: string,"sugestao_na_importacao"?: string | null,"versao"?: number
                  }
                  Relationships: [
                    
                  ]
                },"funcao_executavel": {
                  Row: {
                    "assinatura": string,"justificativa": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assinatura": string,"justificativa": string
                  }
                  Update: {
                    "assinatura"?: string,"justificativa"?: string
                  }
                  Relationships: [
                    
                  ]
                },"garagem": {
                  Row: {
                    "codigo": string,"conferencia": string,"criado_em": string,"digito_da_raiz": number | null,"id": string,"rotulo": string,"versao": number
                  }
                  ComputedFields: never
                  Insert: {
                    "codigo": string,"conferencia"?: string,"criado_em"?: string,"digito_da_raiz"?: number | null,"id"?: string,"rotulo": string,"versao"?: number
                  }
                  Update: {
                    "codigo"?: string,"conferencia"?: string,"criado_em"?: string,"digito_da_raiz"?: number | null,"id"?: string,"rotulo"?: string,"versao"?: number
                  }
                  Relationships: [
                    
                  ]
                },"marca": {
                  Row: {
                    "criado_em": string,"excluido_em": string | null,"excluido_por": string | null,"id": string,"motivo_da_exclusao": string | null,"nome": string,"versao": number
                  }
                  ComputedFields: never
                  Insert: {
                    "criado_em"?: string,"excluido_em"?: string | null,"excluido_por"?: string | null,"id"?: string,"motivo_da_exclusao"?: string | null,"nome": string,"versao"?: number
                  }
                  Update: {
                    "criado_em"?: string,"excluido_em"?: string | null,"excluido_por"?: string | null,"id"?: string,"motivo_da_exclusao"?: string | null,"nome"?: string,"versao"?: number
                  }
                  Relationships: [
                    
                  ]
                },"modelo": {
                  Row: {
                    "carroceria_padrao_id": string | null,"criado_em": string,"eixos": number | null,"excluido_em": string | null,"excluido_por": string | null,"id": string,"marca_id": string,"motivo_da_exclusao": string | null,"nome": string,"versao": number
                  }
                  ComputedFields: never
                  Insert: {
                    "carroceria_padrao_id"?: string | null,"criado_em"?: string,"eixos"?: number | null,"excluido_em"?: string | null,"excluido_por"?: string | null,"id"?: string,"marca_id": string,"motivo_da_exclusao"?: string | null,"nome": string,"versao"?: number
                  }
                  Update: {
                    "carroceria_padrao_id"?: string | null,"criado_em"?: string,"eixos"?: number | null,"excluido_em"?: string | null,"excluido_por"?: string | null,"id"?: string,"marca_id"?: string,"motivo_da_exclusao"?: string | null,"nome"?: string,"versao"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "modelo_carroceria_padrao_id_fkey"
      columns: ["carroceria_padrao_id"]
isOneToOne: false
      referencedRelation: "carroceria"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "modelo_marca_id_fkey"
      columns: ["marca_id"]
isOneToOne: false
      referencedRelation: "marca"
      referencedColumns: ["id"]
    }
                  ]
                },"modulo": {
                  Row: {
                    "codigo": string,"nome": string
                  }
                  ComputedFields: never
                  Insert: {
                    "codigo": string,"nome": string
                  }
                  Update: {
                    "codigo"?: string,"nome"?: string
                  }
                  Relationships: [
                    
                  ]
                },"nomenclatura_de_conjunto": {
                  Row: {
                    "carroceria_id": string,"configuracao": string,"nome": string,"versao": number
                  }
                  ComputedFields: never
                  Insert: {
                    "carroceria_id": string,"configuracao": string,"nome": string,"versao"?: number
                  }
                  Update: {
                    "carroceria_id"?: string,"configuracao"?: string,"nome"?: string,"versao"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "nomenclatura_de_conjunto_carroceria_id_fkey"
      columns: ["carroceria_id"]
isOneToOne: false
      referencedRelation: "carroceria"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "nomenclatura_de_conjunto_configuracao_fkey"
      columns: ["configuracao"]
isOneToOne: false
      referencedRelation: "configuracao_de_conjunto"
      referencedColumns: ["codigo"]
    }
                  ]
                },"papel": {
                  Row: {
                    "codigo": string,"nome": string
                  }
                  ComputedFields: never
                  Insert: {
                    "codigo": string,"nome": string
                  }
                  Update: {
                    "codigo"?: string,"nome"?: string
                  }
                  Relationships: [
                    
                  ]
                },"parametro": {
                  Row: {
                    "chave": string,"descricao": string,"valor": string
                  }
                  ComputedFields: never
                  Insert: {
                    "chave": string,"descricao": string,"valor": string
                  }
                  Update: {
                    "chave"?: string,"descricao"?: string,"valor"?: string
                  }
                  Relationships: [
                    
                  ]
                },"perfil": {
                  Row: {
                    "codigo": string,"nome": string
                  }
                  ComputedFields: never
                  Insert: {
                    "codigo": string,"nome": string
                  }
                  Update: {
                    "codigo"?: string,"nome"?: string
                  }
                  Relationships: [
                    
                  ]
                },"permissao_do_perfil": {
                  Row: {
                    "acao": string,"escopo": string,"modulo": string,"perfil": string
                  }
                  ComputedFields: never
                  Insert: {
                    "acao": string,"escopo": string,"modulo": string,"perfil": string
                  }
                  Update: {
                    "acao"?: string,"escopo"?: string,"modulo"?: string,"perfil"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "permissao_do_perfil_acao_fkey"
      columns: ["acao"]
isOneToOne: false
      referencedRelation: "acao"
      referencedColumns: ["codigo"]
    },{
      foreignKeyName: "permissao_do_perfil_escopo_fkey"
      columns: ["escopo"]
isOneToOne: false
      referencedRelation: "escopo"
      referencedColumns: ["codigo"]
    },{
      foreignKeyName: "permissao_do_perfil_modulo_fkey"
      columns: ["modulo"]
isOneToOne: false
      referencedRelation: "modulo"
      referencedColumns: ["codigo"]
    },{
      foreignKeyName: "permissao_do_perfil_perfil_fkey"
      columns: ["perfil"]
isOneToOne: false
      referencedRelation: "perfil"
      referencedColumns: ["codigo"]
    }
                  ]
                },"status": {
                  Row: {
                    "aplica_a": string,"baixada": boolean,"camada": string,"chip": string,"nome": string,"ordem": number,"sigla": string,"tipos_validos": (Database["nucleo"]['Enums']["tipo_de_ativo"])[],"versao": number
                  }
                  ComputedFields: never
                  Insert: {
                    "aplica_a": string,"baixada": boolean,"camada": string,"chip": string,"nome": string,"ordem": number,"sigla": string,"tipos_validos": (Database["nucleo"]['Enums']["tipo_de_ativo"])[],"versao"?: number
                  }
                  Update: {
                    "aplica_a"?: string,"baixada"?: boolean,"camada"?: string,"chip"?: string,"nome"?: string,"ordem"?: number,"sigla"?: string,"tipos_validos"?: (Database["nucleo"]['Enums']["tipo_de_ativo"])[],"versao"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "status_camada_fkey"
      columns: ["camada"]
isOneToOne: false
      referencedRelation: "camada_de_status"
      referencedColumns: ["codigo"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "ativo_sem_gestor":
{ Args: { "p_ativo_id": string }; Returns: boolean
                           },
"minha_carteira_de_placas":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"minhas_filiais_de_placas":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"minhas_operacoes_de_placas":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"nome_do_conjunto":
{ Args: { "p_carroceria_id": string,"p_com_dolly": boolean,"p_eixos_do_dolly": number,"p_eixos_dos_semirreboques": number,"p_unidades": number }; Returns: string
                           },
"perfil_atual":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"pode":
{ Args: { "p_acao": string,"p_modulo": string }; Returns: boolean
                           },
"pode_algum":
{ Args: { "p_acao": string,"p_modulos": (string)[] }; Returns: boolean
                           },
"pode_na_operacao":
{ Args: { "p_acao": string,"p_operacao_id": string }; Returns: boolean
                           },
"usuario_atual":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"ve_ativo":
{ Args: { "p_acao": string,"p_ativo_id": string,"p_modulos": (string)[] }; Returns: boolean
                           },
"ve_todas_as_placas":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           }
          }
          Enums: {
            "origem_da_data": "derivada"|"observada"|"informada","origem_do_campo": "sankhya"|"derivada"|"informada"|"correcao_local"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"nucleo": {
          Tables: {
            "ativo": {
                  Row: {
                    "ano_fabricacao": number | null,"ano_fabricacao_origem": Database["config"]['Enums']["origem_do_campo"] | null,"ano_modelo": number | null,"ano_modelo_origem": Database["config"]['Enums']["origem_do_campo"] | null,"carroceria_id": string | null,"carroceria_origem": Database["config"]['Enums']["origem_do_campo"] | null,"chassi": string | null,"cmt_kg": number | null,"cmt_kg_origem": Database["config"]['Enums']["origem_do_campo"] | null,"codigo_fipe": string | null,"codigo_fipe_origem": Database["config"]['Enums']["origem_do_campo"] | null,"codveiculo": number | null,"criado_em": string,"eixos": number | null,"eixos_origem": Database["config"]['Enums']["origem_do_campo"] | null,"excluido_em": string | null,"excluido_por": string | null,"funcao": Database["nucleo"]['Enums']["funcao_do_implemento"] | null,"id": string,"modelo_id": string | null,"modelo_origem": Database["config"]['Enums']["origem_do_campo"] | null,"motivo_da_exclusao": string | null,"numero_de_serie": string | null,"pbt_kg": number | null,"pbt_kg_origem": Database["config"]['Enums']["origem_do_campo"] | null,"renavam": string | null,"tara_kg": number | null,"tara_kg_origem": Database["config"]['Enums']["origem_do_campo"] | null,"tipo": Database["nucleo"]['Enums']["tipo_de_ativo"],"valor_fipe": number | null,"valor_fipe_origem": Database["config"]['Enums']["origem_do_campo"] | null,"valor_fipe_referencia": string | null,"valor_manual": number | null,"valor_manual_em": string | null,"valor_manual_fonte": string | null,"valor_manual_origem": Database["config"]['Enums']["origem_do_campo"] | null,"versao": number
                  }
                  ComputedFields: never
                  Insert: {
                    "ano_fabricacao"?: number | null,"ano_fabricacao_origem"?: Database["config"]['Enums']["origem_do_campo"] | null,"ano_modelo"?: number | null,"ano_modelo_origem"?: Database["config"]['Enums']["origem_do_campo"] | null,"carroceria_id"?: string | null,"carroceria_origem"?: Database["config"]['Enums']["origem_do_campo"] | null,"chassi"?: string | null,"cmt_kg"?: number | null,"cmt_kg_origem"?: Database["config"]['Enums']["origem_do_campo"] | null,"codigo_fipe"?: string | null,"codigo_fipe_origem"?: Database["config"]['Enums']["origem_do_campo"] | null,"codveiculo"?: number | null,"criado_em"?: string,"eixos"?: number | null,"eixos_origem"?: Database["config"]['Enums']["origem_do_campo"] | null,"excluido_em"?: string | null,"excluido_por"?: string | null,"funcao"?: Database["nucleo"]['Enums']["funcao_do_implemento"] | null,"id"?: string,"modelo_id"?: string | null,"modelo_origem"?: Database["config"]['Enums']["origem_do_campo"] | null,"motivo_da_exclusao"?: string | null,"numero_de_serie"?: string | null,"pbt_kg"?: number | null,"pbt_kg_origem"?: Database["config"]['Enums']["origem_do_campo"] | null,"renavam"?: string | null,"tara_kg"?: number | null,"tara_kg_origem"?: Database["config"]['Enums']["origem_do_campo"] | null,"tipo": Database["nucleo"]['Enums']["tipo_de_ativo"],"valor_fipe"?: number | null,"valor_fipe_origem"?: Database["config"]['Enums']["origem_do_campo"] | null,"valor_fipe_referencia"?: string | null,"valor_manual"?: number | null,"valor_manual_em"?: string | null,"valor_manual_fonte"?: string | null,"valor_manual_origem"?: Database["config"]['Enums']["origem_do_campo"] | null,"versao"?: number
                  }
                  Update: {
                    "ano_fabricacao"?: number | null,"ano_fabricacao_origem"?: Database["config"]['Enums']["origem_do_campo"] | null,"ano_modelo"?: number | null,"ano_modelo_origem"?: Database["config"]['Enums']["origem_do_campo"] | null,"carroceria_id"?: string | null,"carroceria_origem"?: Database["config"]['Enums']["origem_do_campo"] | null,"chassi"?: string | null,"cmt_kg"?: number | null,"cmt_kg_origem"?: Database["config"]['Enums']["origem_do_campo"] | null,"codigo_fipe"?: string | null,"codigo_fipe_origem"?: Database["config"]['Enums']["origem_do_campo"] | null,"codveiculo"?: number | null,"criado_em"?: string,"eixos"?: number | null,"eixos_origem"?: Database["config"]['Enums']["origem_do_campo"] | null,"excluido_em"?: string | null,"excluido_por"?: string | null,"funcao"?: Database["nucleo"]['Enums']["funcao_do_implemento"] | null,"id"?: string,"modelo_id"?: string | null,"modelo_origem"?: Database["config"]['Enums']["origem_do_campo"] | null,"motivo_da_exclusao"?: string | null,"numero_de_serie"?: string | null,"pbt_kg"?: number | null,"pbt_kg_origem"?: Database["config"]['Enums']["origem_do_campo"] | null,"renavam"?: string | null,"tara_kg"?: number | null,"tara_kg_origem"?: Database["config"]['Enums']["origem_do_campo"] | null,"tipo"?: Database["nucleo"]['Enums']["tipo_de_ativo"],"valor_fipe"?: number | null,"valor_fipe_origem"?: Database["config"]['Enums']["origem_do_campo"] | null,"valor_fipe_referencia"?: string | null,"valor_manual"?: number | null,"valor_manual_em"?: string | null,"valor_manual_fonte"?: string | null,"valor_manual_origem"?: Database["config"]['Enums']["origem_do_campo"] | null,"versao"?: number
                  }
                  Relationships: [
                    
                  ]
                },"baixa_do_ativo": {
                  Row: {
                    "ativo_id": string,"criado_em": string,"em": string,"excluido_em": string | null,"excluido_por": string | null,"id": string,"motivo_da_exclusao": string | null,"sigla": string,"versao": number
                  }
                  ComputedFields: never
                  Insert: {
                    "ativo_id": string,"criado_em"?: string,"em": string,"excluido_em"?: string | null,"excluido_por"?: string | null,"id"?: string,"motivo_da_exclusao"?: string | null,"sigla": string,"versao"?: number
                  }
                  Update: {
                    "ativo_id"?: string,"criado_em"?: string,"em"?: string,"excluido_em"?: string | null,"excluido_por"?: string | null,"id"?: string,"motivo_da_exclusao"?: string | null,"sigla"?: string,"versao"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "baixa_do_ativo_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "alerta_de_vinculo"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "baixa_do_ativo_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "ativo"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "baixa_do_ativo_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "campo_pendente"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "baixa_do_ativo_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "operacao_do_ativo"
      referencedColumns: ["ativo_id"]
    }
                  ]
                },"composicao": {
                  Row: {
                    "cavalo_id": string,"cavalo_tipo": Database["nucleo"]['Enums']["tipo_de_ativo"],"criado_em": string,"excluido_em": string | null,"excluido_por": string | null,"fim": string | null,"fim_origem": Database["config"]['Enums']["origem_da_data"] | null,"id": string,"implemento_id": string,"implemento_tipo": Database["nucleo"]['Enums']["tipo_de_ativo"],"inicio": string,"inicio_origem": Database["config"]['Enums']["origem_da_data"],"motivo_da_exclusao": string | null,"operacao_na_saida_id": string | null,"periodo": unknown,"posicao": number,"versao": number
                  }
                  ComputedFields: never
                  Insert: {
                    "cavalo_id": string,"cavalo_tipo"?: never,"criado_em"?: string,"excluido_em"?: string | null,"excluido_por"?: string | null,"fim"?: string | null,"fim_origem"?: Database["config"]['Enums']["origem_da_data"] | null,"id"?: string,"implemento_id": string,"implemento_tipo"?: never,"inicio": string,"inicio_origem": Database["config"]['Enums']["origem_da_data"],"motivo_da_exclusao"?: string | null,"operacao_na_saida_id"?: string | null,"periodo"?: never,"posicao": number,"versao"?: number
                  }
                  Update: {
                    "cavalo_id"?: string,"cavalo_tipo"?: never,"criado_em"?: string,"excluido_em"?: string | null,"excluido_por"?: string | null,"fim"?: string | null,"fim_origem"?: Database["config"]['Enums']["origem_da_data"] | null,"id"?: string,"implemento_id"?: string,"implemento_tipo"?: never,"inicio"?: string,"inicio_origem"?: Database["config"]['Enums']["origem_da_data"],"motivo_da_exclusao"?: string | null,"operacao_na_saida_id"?: string | null,"periodo"?: never,"posicao"?: number,"versao"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "composicao_cavalo_fk"
      columns: ["cavalo_id","cavalo_tipo"]
isOneToOne: false
      referencedRelation: "ativo"
      referencedColumns: ["id","tipo"]
    },{
      foreignKeyName: "composicao_implemento_fk"
      columns: ["implemento_id","implemento_tipo"]
isOneToOne: false
      referencedRelation: "ativo"
      referencedColumns: ["id","tipo"]
    },{
      foreignKeyName: "composicao_operacao_na_saida_id_fkey"
      columns: ["operacao_na_saida_id"]
isOneToOne: false
      referencedRelation: "operacao"
      referencedColumns: ["id"]
    }
                  ]
                },"correcao_de_campo": {
                  Row: {
                    "ativo_id": string,"campo": string,"corrigido_em": string,"corrigido_por": string | null,"id": string,"motivo": string,"motivo_da_revogacao": string | null,"origem_anterior": Database["config"]['Enums']["origem_do_campo"] | null,"revogada_em": string | null,"revogada_por": string | null,"valor_anterior": Json | null,"valor_local": NonNullable<Json>,"versao": number
                  }
                  ComputedFields: never
                  Insert: {
                    "ativo_id": string,"campo": string,"corrigido_em"?: string,"corrigido_por"?: string | null,"id"?: string,"motivo": string,"motivo_da_revogacao"?: string | null,"origem_anterior"?: Database["config"]['Enums']["origem_do_campo"] | null,"revogada_em"?: string | null,"revogada_por"?: string | null,"valor_anterior"?: Json | null,"valor_local": NonNullable<Json>,"versao"?: number
                  }
                  Update: {
                    "ativo_id"?: string,"campo"?: string,"corrigido_em"?: string,"corrigido_por"?: string | null,"id"?: string,"motivo"?: string,"motivo_da_revogacao"?: string | null,"origem_anterior"?: Database["config"]['Enums']["origem_do_campo"] | null,"revogada_em"?: string | null,"revogada_por"?: string | null,"valor_anterior"?: Json | null,"valor_local"?: NonNullable<Json>,"versao"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "correcao_de_campo_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "alerta_de_vinculo"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "correcao_de_campo_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "ativo"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "correcao_de_campo_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "campo_pendente"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "correcao_de_campo_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "operacao_do_ativo"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "correcao_de_campo_campo_fkey"
      columns: ["campo"]
isOneToOne: false
      referencedRelation: "campo_pendente"
      referencedColumns: ["campo"]
    },{
      foreignKeyName: "correcao_de_campo_corrigido_por_fkey"
      columns: ["corrigido_por"]
isOneToOne: false
      referencedRelation: "pessoa"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "correcao_de_campo_corrigido_por_fkey"
      columns: ["corrigido_por"]
isOneToOne: false
      referencedRelation: "pessoa_para_leitura"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "correcao_de_campo_revogada_por_fkey"
      columns: ["revogada_por"]
isOneToOne: false
      referencedRelation: "pessoa"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "correcao_de_campo_revogada_por_fkey"
      columns: ["revogada_por"]
isOneToOne: false
      referencedRelation: "pessoa_para_leitura"
      referencedColumns: ["id"]
    }
                  ]
                },"cr": {
                  Row: {
                    "ad_bloqueado": string | null,"ad_bloqueado_origem": Database["config"]['Enums']["origem_do_campo"] | null,"ad_frota": string | null,"ad_frota_origem": Database["config"]['Enums']["origem_do_campo"] | null,"analitico": boolean | null,"analitico_origem": Database["config"]['Enums']["origem_do_campo"] | null,"ativo": boolean,"ativo_origem": Database["config"]['Enums']["origem_do_campo"],"bloqueado": boolean,"bloqueado_origem": Database["config"]['Enums']["origem_do_campo"],"codcencus": number,"codigo": string,"conferencia": string,"cr_pai_id": string | null,"cr_pai_origem": Database["config"]['Enums']["origem_do_campo"] | null,"criado_em": string,"excluido_em": string | null,"excluido_por": string | null,"filial_do_cr": string | null,"filial_do_cr_origem": Database["config"]['Enums']["origem_do_campo"] | null,"garagem_conferencia": string | null,"garagem_id": string | null,"garagem_origem": Database["config"]['Enums']["origem_do_campo"] | null,"id": string,"motivo_da_exclusao": string | null,"nome": string | null,"operacao_id": string | null,"participa_da_frota": boolean | null,"participa_da_frota_origem": Database["config"]['Enums']["origem_do_campo"] | null,"tipo": Database["nucleo"]['Enums']["tipo_de_cr"] | null,"tipo_origem": Database["config"]['Enums']["origem_do_campo"] | null,"veiculo_obrigatorio": boolean | null,"veiculo_obrigatorio_origem": Database["config"]['Enums']["origem_do_campo"] | null,"versao": number
                  }
                  ComputedFields: never
                  Insert: {
                    "ad_bloqueado"?: string | null,"ad_bloqueado_origem"?: Database["config"]['Enums']["origem_do_campo"] | null,"ad_frota"?: string | null,"ad_frota_origem"?: Database["config"]['Enums']["origem_do_campo"] | null,"analitico"?: boolean | null,"analitico_origem"?: Database["config"]['Enums']["origem_do_campo"] | null,"ativo"?: boolean,"ativo_origem"?: Database["config"]['Enums']["origem_do_campo"],"bloqueado"?: boolean,"bloqueado_origem"?: Database["config"]['Enums']["origem_do_campo"],"codcencus": number,"codigo": string,"conferencia"?: string,"cr_pai_id"?: string | null,"cr_pai_origem"?: Database["config"]['Enums']["origem_do_campo"] | null,"criado_em"?: string,"excluido_em"?: string | null,"excluido_por"?: string | null,"filial_do_cr"?: string | null,"filial_do_cr_origem"?: Database["config"]['Enums']["origem_do_campo"] | null,"garagem_conferencia"?: string | null,"garagem_id"?: string | null,"garagem_origem"?: Database["config"]['Enums']["origem_do_campo"] | null,"id"?: string,"motivo_da_exclusao"?: string | null,"nome"?: string | null,"operacao_id"?: string | null,"participa_da_frota"?: boolean | null,"participa_da_frota_origem"?: Database["config"]['Enums']["origem_do_campo"] | null,"tipo"?: Database["nucleo"]['Enums']["tipo_de_cr"] | null,"tipo_origem"?: Database["config"]['Enums']["origem_do_campo"] | null,"veiculo_obrigatorio"?: boolean | null,"veiculo_obrigatorio_origem"?: Database["config"]['Enums']["origem_do_campo"] | null,"versao"?: number
                  }
                  Update: {
                    "ad_bloqueado"?: string | null,"ad_bloqueado_origem"?: Database["config"]['Enums']["origem_do_campo"] | null,"ad_frota"?: string | null,"ad_frota_origem"?: Database["config"]['Enums']["origem_do_campo"] | null,"analitico"?: boolean | null,"analitico_origem"?: Database["config"]['Enums']["origem_do_campo"] | null,"ativo"?: boolean,"ativo_origem"?: Database["config"]['Enums']["origem_do_campo"],"bloqueado"?: boolean,"bloqueado_origem"?: Database["config"]['Enums']["origem_do_campo"],"codcencus"?: number,"codigo"?: string,"conferencia"?: string,"cr_pai_id"?: string | null,"cr_pai_origem"?: Database["config"]['Enums']["origem_do_campo"] | null,"criado_em"?: string,"excluido_em"?: string | null,"excluido_por"?: string | null,"filial_do_cr"?: string | null,"filial_do_cr_origem"?: Database["config"]['Enums']["origem_do_campo"] | null,"garagem_conferencia"?: string | null,"garagem_id"?: string | null,"garagem_origem"?: Database["config"]['Enums']["origem_do_campo"] | null,"id"?: string,"motivo_da_exclusao"?: string | null,"nome"?: string | null,"operacao_id"?: string | null,"participa_da_frota"?: boolean | null,"participa_da_frota_origem"?: Database["config"]['Enums']["origem_do_campo"] | null,"tipo"?: Database["nucleo"]['Enums']["tipo_de_cr"] | null,"tipo_origem"?: Database["config"]['Enums']["origem_do_campo"] | null,"veiculo_obrigatorio"?: boolean | null,"veiculo_obrigatorio_origem"?: Database["config"]['Enums']["origem_do_campo"] | null,"versao"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "cr_cr_pai_id_fkey"
      columns: ["cr_pai_id"]
isOneToOne: false
      referencedRelation: "alerta_de_cr"
      referencedColumns: ["cr_id"]
    },{
      foreignKeyName: "cr_cr_pai_id_fkey"
      columns: ["cr_pai_id"]
isOneToOne: false
      referencedRelation: "cr"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cr_operacao_id_fkey"
      columns: ["operacao_id"]
isOneToOne: false
      referencedRelation: "operacao"
      referencedColumns: ["id"]
    }
                  ]
                },"cr_de_servico_na_operacao": {
                  Row: {
                    "cr_id": string,"criado_em": string,"excluido_em": string | null,"excluido_por": string | null,"fim": string | null,"fim_origem": Database["config"]['Enums']["origem_da_data"] | null,"id": string,"inicio": string,"inicio_origem": Database["config"]['Enums']["origem_da_data"],"montado_por": string | null,"motivo_da_exclusao": string | null,"operacao_id": string,"periodo": unknown,"versao": number
                  }
                  ComputedFields: never
                  Insert: {
                    "cr_id": string,"criado_em"?: string,"excluido_em"?: string | null,"excluido_por"?: string | null,"fim"?: string | null,"fim_origem"?: Database["config"]['Enums']["origem_da_data"] | null,"id"?: string,"inicio": string,"inicio_origem": Database["config"]['Enums']["origem_da_data"],"montado_por"?: string | null,"motivo_da_exclusao"?: string | null,"operacao_id": string,"periodo"?: never,"versao"?: number
                  }
                  Update: {
                    "cr_id"?: string,"criado_em"?: string,"excluido_em"?: string | null,"excluido_por"?: string | null,"fim"?: string | null,"fim_origem"?: Database["config"]['Enums']["origem_da_data"] | null,"id"?: string,"inicio"?: string,"inicio_origem"?: Database["config"]['Enums']["origem_da_data"],"montado_por"?: string | null,"motivo_da_exclusao"?: string | null,"operacao_id"?: string,"periodo"?: never,"versao"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "cr_de_servico_na_operacao_cr_id_fkey"
      columns: ["cr_id"]
isOneToOne: false
      referencedRelation: "alerta_de_cr"
      referencedColumns: ["cr_id"]
    },{
      foreignKeyName: "cr_de_servico_na_operacao_cr_id_fkey"
      columns: ["cr_id"]
isOneToOne: false
      referencedRelation: "cr"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cr_de_servico_na_operacao_montado_por_fkey"
      columns: ["montado_por"]
isOneToOne: false
      referencedRelation: "pessoa"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cr_de_servico_na_operacao_montado_por_fkey"
      columns: ["montado_por"]
isOneToOne: false
      referencedRelation: "pessoa_para_leitura"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cr_de_servico_na_operacao_operacao_id_fkey"
      columns: ["operacao_id"]
isOneToOne: false
      referencedRelation: "operacao"
      referencedColumns: ["id"]
    }
                  ]
                },"cr_do_ativo": {
                  Row: {
                    "ativo_id": string,"cr_id": string,"criado_em": string,"excluido_em": string | null,"excluido_por": string | null,"fim": string | null,"fim_origem": Database["config"]['Enums']["origem_da_data"] | null,"id": string,"inicio": string,"inicio_origem": Database["config"]['Enums']["origem_da_data"],"motivo_da_exclusao": string | null,"periodo": unknown,"versao": number
                  }
                  ComputedFields: never
                  Insert: {
                    "ativo_id": string,"cr_id": string,"criado_em"?: string,"excluido_em"?: string | null,"excluido_por"?: string | null,"fim"?: string | null,"fim_origem"?: Database["config"]['Enums']["origem_da_data"] | null,"id"?: string,"inicio": string,"inicio_origem": Database["config"]['Enums']["origem_da_data"],"motivo_da_exclusao"?: string | null,"periodo"?: never,"versao"?: number
                  }
                  Update: {
                    "ativo_id"?: string,"cr_id"?: string,"criado_em"?: string,"excluido_em"?: string | null,"excluido_por"?: string | null,"fim"?: string | null,"fim_origem"?: Database["config"]['Enums']["origem_da_data"] | null,"id"?: string,"inicio"?: string,"inicio_origem"?: Database["config"]['Enums']["origem_da_data"],"motivo_da_exclusao"?: string | null,"periodo"?: never,"versao"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "cr_do_ativo_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "alerta_de_vinculo"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "cr_do_ativo_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "ativo"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cr_do_ativo_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "campo_pendente"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "cr_do_ativo_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "operacao_do_ativo"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "cr_do_ativo_cr_id_fkey"
      columns: ["cr_id"]
isOneToOne: false
      referencedRelation: "alerta_de_cr"
      referencedColumns: ["cr_id"]
    },{
      foreignKeyName: "cr_do_ativo_cr_id_fkey"
      columns: ["cr_id"]
isOneToOne: false
      referencedRelation: "cr"
      referencedColumns: ["id"]
    }
                  ]
                },"custodia": {
                  Row: {
                    "ativo_id": string,"com_quem": Database["nucleo"]['Enums']["com_quem_da_custodia"],"criado_em": string,"excluido_em": string | null,"excluido_por": string | null,"filial_id": string | null,"fim": string | null,"fim_origem": Database["config"]['Enums']["origem_da_data"] | null,"id": string,"inicio": string,"inicio_origem": Database["config"]['Enums']["origem_da_data"],"motivo_da_exclusao": string | null,"periodo": unknown,"versao": number
                  }
                  ComputedFields: never
                  Insert: {
                    "ativo_id": string,"com_quem": Database["nucleo"]['Enums']["com_quem_da_custodia"],"criado_em"?: string,"excluido_em"?: string | null,"excluido_por"?: string | null,"filial_id"?: string | null,"fim"?: string | null,"fim_origem"?: Database["config"]['Enums']["origem_da_data"] | null,"id"?: string,"inicio": string,"inicio_origem": Database["config"]['Enums']["origem_da_data"],"motivo_da_exclusao"?: string | null,"periodo"?: never,"versao"?: number
                  }
                  Update: {
                    "ativo_id"?: string,"com_quem"?: Database["nucleo"]['Enums']["com_quem_da_custodia"],"criado_em"?: string,"excluido_em"?: string | null,"excluido_por"?: string | null,"filial_id"?: string | null,"fim"?: string | null,"fim_origem"?: Database["config"]['Enums']["origem_da_data"] | null,"id"?: string,"inicio"?: string,"inicio_origem"?: Database["config"]['Enums']["origem_da_data"],"motivo_da_exclusao"?: string | null,"periodo"?: never,"versao"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "custodia_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "alerta_de_vinculo"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "custodia_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "ativo"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "custodia_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "campo_pendente"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "custodia_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "operacao_do_ativo"
      referencedColumns: ["ativo_id"]
    }
                  ]
                },"estado_de_status": {
                  Row: {
                    "ativo_id": string,"camada": string,"criado_em": string,"evento_fim_id": string | null,"evento_inicio_id": string,"excluido_em": string | null,"excluido_por": string | null,"fim": string | null,"fim_origem": Database["config"]['Enums']["origem_da_data"] | null,"id": string,"inicio": string,"inicio_origem": Database["config"]['Enums']["origem_da_data"],"motivo_da_exclusao": string | null,"periodo": unknown,"sigla": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ativo_id": string,"camada": string,"criado_em"?: string,"evento_fim_id"?: string | null,"evento_inicio_id": string,"excluido_em"?: string | null,"excluido_por"?: string | null,"fim"?: string | null,"fim_origem"?: Database["config"]['Enums']["origem_da_data"] | null,"id"?: string,"inicio": string,"inicio_origem": Database["config"]['Enums']["origem_da_data"],"motivo_da_exclusao"?: string | null,"periodo"?: never,"sigla": string
                  }
                  Update: {
                    "ativo_id"?: string,"camada"?: string,"criado_em"?: string,"evento_fim_id"?: string | null,"evento_inicio_id"?: string,"excluido_em"?: string | null,"excluido_por"?: string | null,"fim"?: string | null,"fim_origem"?: Database["config"]['Enums']["origem_da_data"] | null,"id"?: string,"inicio"?: string,"inicio_origem"?: Database["config"]['Enums']["origem_da_data"],"motivo_da_exclusao"?: string | null,"periodo"?: never,"sigla"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "estado_de_status_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "alerta_de_vinculo"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "estado_de_status_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "ativo"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "estado_de_status_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "campo_pendente"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "estado_de_status_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "operacao_do_ativo"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "estado_de_status_evento_fim_id_fkey"
      columns: ["evento_fim_id"]
isOneToOne: false
      referencedRelation: "evento_de_status"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "estado_de_status_evento_inicio_id_fkey"
      columns: ["evento_inicio_id"]
isOneToOne: false
      referencedRelation: "evento_de_status"
      referencedColumns: ["id"]
    }
                  ]
                },"evento_de_status": {
                  Row: {
                    "ativo_id": string,"camada": string,"em": string,"em_origem": Database["config"]['Enums']["origem_da_data"],"excluido_em": string | null,"excluido_por": string | null,"id": string,"justificativa": string | null,"motivo_da_exclusao": string | null,"origem": string,"registrado_em": string,"registrado_por": string | null,"sigla": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "ativo_id": string,"camada": string,"em": string,"em_origem": Database["config"]['Enums']["origem_da_data"],"excluido_em"?: string | null,"excluido_por"?: string | null,"id"?: string,"justificativa"?: string | null,"motivo_da_exclusao"?: string | null,"origem": string,"registrado_em"?: string,"registrado_por"?: string | null,"sigla"?: string | null
                  }
                  Update: {
                    "ativo_id"?: string,"camada"?: string,"em"?: string,"em_origem"?: Database["config"]['Enums']["origem_da_data"],"excluido_em"?: string | null,"excluido_por"?: string | null,"id"?: string,"justificativa"?: string | null,"motivo_da_exclusao"?: string | null,"origem"?: string,"registrado_em"?: string,"registrado_por"?: string | null,"sigla"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "evento_de_status_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "alerta_de_vinculo"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "evento_de_status_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "ativo"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "evento_de_status_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "campo_pendente"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "evento_de_status_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "operacao_do_ativo"
      referencedColumns: ["ativo_id"]
    }
                  ]
                },"fila_de_excecoes": {
                  Row: {
                    "assunto": string | null,"ativo_id": string | null,"campo": string | null,"cr_id": string | null,"criado_em": string,"descricao": string,"id": string,"resolucao": string | null,"resolvida_em": string | null,"resolvida_por": string | null,"versao": number
                  }
                  ComputedFields: never
                  Insert: {
                    "assunto"?: string | null,"ativo_id"?: string | null,"campo"?: string | null,"cr_id"?: string | null,"criado_em"?: string,"descricao": string,"id"?: string,"resolucao"?: string | null,"resolvida_em"?: string | null,"resolvida_por"?: string | null,"versao"?: number
                  }
                  Update: {
                    "assunto"?: string | null,"ativo_id"?: string | null,"campo"?: string | null,"cr_id"?: string | null,"criado_em"?: string,"descricao"?: string,"id"?: string,"resolucao"?: string | null,"resolvida_em"?: string | null,"resolvida_por"?: string | null,"versao"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "fila_de_excecoes_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "alerta_de_vinculo"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "fila_de_excecoes_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "ativo"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fila_de_excecoes_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "campo_pendente"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "fila_de_excecoes_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "operacao_do_ativo"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "fila_de_excecoes_campo_fkey"
      columns: ["campo"]
isOneToOne: false
      referencedRelation: "campo_pendente"
      referencedColumns: ["campo"]
    },{
      foreignKeyName: "fila_de_excecoes_cr_id_fkey"
      columns: ["cr_id"]
isOneToOne: false
      referencedRelation: "alerta_de_cr"
      referencedColumns: ["cr_id"]
    },{
      foreignKeyName: "fila_de_excecoes_cr_id_fkey"
      columns: ["cr_id"]
isOneToOne: false
      referencedRelation: "cr"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fila_de_excecoes_resolvida_por_fkey"
      columns: ["resolvida_por"]
isOneToOne: false
      referencedRelation: "pessoa"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fila_de_excecoes_resolvida_por_fkey"
      columns: ["resolvida_por"]
isOneToOne: false
      referencedRelation: "pessoa_para_leitura"
      referencedColumns: ["id"]
    }
                  ]
                },"gestor_da_carteira": {
                  Row: {
                    "ativo_id": string,"criado_em": string,"excluido_em": string | null,"excluido_por": string | null,"fim": string | null,"fim_origem": Database["config"]['Enums']["origem_da_data"] | null,"gestor_id": string,"id": string,"inicio": string,"inicio_origem": Database["config"]['Enums']["origem_da_data"],"motivo_da_exclusao": string | null,"periodo": unknown,"versao": number
                  }
                  ComputedFields: never
                  Insert: {
                    "ativo_id": string,"criado_em"?: string,"excluido_em"?: string | null,"excluido_por"?: string | null,"fim"?: string | null,"fim_origem"?: Database["config"]['Enums']["origem_da_data"] | null,"gestor_id": string,"id"?: string,"inicio": string,"inicio_origem": Database["config"]['Enums']["origem_da_data"],"motivo_da_exclusao"?: string | null,"periodo"?: never,"versao"?: number
                  }
                  Update: {
                    "ativo_id"?: string,"criado_em"?: string,"excluido_em"?: string | null,"excluido_por"?: string | null,"fim"?: string | null,"fim_origem"?: Database["config"]['Enums']["origem_da_data"] | null,"gestor_id"?: string,"id"?: string,"inicio"?: string,"inicio_origem"?: Database["config"]['Enums']["origem_da_data"],"motivo_da_exclusao"?: string | null,"periodo"?: never,"versao"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "gestor_da_carteira_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "alerta_de_vinculo"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "gestor_da_carteira_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "ativo"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "gestor_da_carteira_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "campo_pendente"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "gestor_da_carteira_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "operacao_do_ativo"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "gestor_da_carteira_gestor_id_fkey"
      columns: ["gestor_id"]
isOneToOne: false
      referencedRelation: "pessoa"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "gestor_da_carteira_gestor_id_fkey"
      columns: ["gestor_id"]
isOneToOne: false
      referencedRelation: "pessoa_para_leitura"
      referencedColumns: ["id"]
    }
                  ]
                },"leitura_da_placa": {
                  Row: {
                    "alertas_vigentes": (string)[],"ano": number | null,"ativo_id": string,"baixada_em": string | null,"busca": string,"causa_id": string | null,"cavalo": string | null,"cr": string | null,"desde": string | null,"filial": string | null,"filial_da_custodia_id": string | null,"garagem": string | null,"gestor": string | null,"gestor_id": string | null,"grupo": string | null,"implementos": (string)[],"inicio_do_pat": string | null,"modelo": string,"nome_da_situacao": string | null,"operacao": string | null,"operacao_id": string | null,"placa": string,"proximo_recalculo": string | null,"recalculado_em": string,"renavam": string | null,"sigla": string,"tipo": string,"ultima_correcao_tardia_em": string | null,"valor_fipe": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "alertas_vigentes": (string)[],"ano"?: number | null,"ativo_id": string,"baixada_em"?: string | null,"busca": string,"causa_id"?: string | null,"cavalo"?: string | null,"cr"?: string | null,"desde"?: string | null,"filial"?: string | null,"filial_da_custodia_id"?: string | null,"garagem"?: string | null,"gestor"?: string | null,"gestor_id"?: string | null,"grupo"?: string | null,"implementos": (string)[],"inicio_do_pat"?: string | null,"modelo": string,"nome_da_situacao"?: string | null,"operacao"?: string | null,"operacao_id"?: string | null,"placa": string,"proximo_recalculo"?: string | null,"recalculado_em"?: string,"renavam"?: string | null,"sigla": string,"tipo": string,"ultima_correcao_tardia_em"?: string | null,"valor_fipe"?: number | null
                  }
                  Update: {
                    "alertas_vigentes"?: (string)[],"ano"?: number | null,"ativo_id"?: string,"baixada_em"?: string | null,"busca"?: string,"causa_id"?: string | null,"cavalo"?: string | null,"cr"?: string | null,"desde"?: string | null,"filial"?: string | null,"filial_da_custodia_id"?: string | null,"garagem"?: string | null,"gestor"?: string | null,"gestor_id"?: string | null,"grupo"?: string | null,"implementos"?: (string)[],"inicio_do_pat"?: string | null,"modelo"?: string,"nome_da_situacao"?: string | null,"operacao"?: string | null,"operacao_id"?: string | null,"placa"?: string,"proximo_recalculo"?: string | null,"recalculado_em"?: string,"renavam"?: string | null,"sigla"?: string,"tipo"?: string,"ultima_correcao_tardia_em"?: string | null,"valor_fipe"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "leitura_da_placa_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: true
      referencedRelation: "alerta_de_vinculo"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "leitura_da_placa_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: true
      referencedRelation: "ativo"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leitura_da_placa_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: true
      referencedRelation: "campo_pendente"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "leitura_da_placa_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: true
      referencedRelation: "operacao_do_ativo"
      referencedColumns: ["ativo_id"]
    }
                  ]
                },"meta_do_conjunto": {
                  Row: {
                    "cavalo_id": string,"cavalo_tipo": Database["nucleo"]['Enums']["tipo_de_ativo"],"criado_em": string,"excluido_em": string | null,"excluido_por": string | null,"fim": string | null,"fim_origem": Database["config"]['Enums']["origem_da_data"] | null,"id": string,"inicio": string,"inicio_origem": Database["config"]['Enums']["origem_da_data"],"motivo_da_exclusao": string | null,"periodo": unknown,"valor": number,"versao": number
                  }
                  ComputedFields: never
                  Insert: {
                    "cavalo_id": string,"cavalo_tipo"?: never,"criado_em"?: string,"excluido_em"?: string | null,"excluido_por"?: string | null,"fim"?: string | null,"fim_origem"?: Database["config"]['Enums']["origem_da_data"] | null,"id"?: string,"inicio": string,"inicio_origem": Database["config"]['Enums']["origem_da_data"],"motivo_da_exclusao"?: string | null,"periodo"?: never,"valor": number,"versao"?: number
                  }
                  Update: {
                    "cavalo_id"?: string,"cavalo_tipo"?: never,"criado_em"?: string,"excluido_em"?: string | null,"excluido_por"?: string | null,"fim"?: string | null,"fim_origem"?: Database["config"]['Enums']["origem_da_data"] | null,"id"?: string,"inicio"?: string,"inicio_origem"?: Database["config"]['Enums']["origem_da_data"],"motivo_da_exclusao"?: string | null,"periodo"?: never,"valor"?: number,"versao"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "meta_cavalo_fk"
      columns: ["cavalo_id","cavalo_tipo"]
isOneToOne: false
      referencedRelation: "ativo"
      referencedColumns: ["id","tipo"]
    }
                  ]
                },"operacao": {
                  Row: {
                    "criado_em": string,"excluido_em": string | null,"excluido_por": string | null,"id": string,"motivo_da_exclusao": string | null,"nome": string,"parada": boolean,"versao": number
                  }
                  ComputedFields: never
                  Insert: {
                    "criado_em"?: string,"excluido_em"?: string | null,"excluido_por"?: string | null,"id"?: string,"motivo_da_exclusao"?: string | null,"nome": string,"parada"?: boolean,"versao"?: number
                  }
                  Update: {
                    "criado_em"?: string,"excluido_em"?: string | null,"excluido_por"?: string | null,"id"?: string,"motivo_da_exclusao"?: string | null,"nome"?: string,"parada"?: boolean,"versao"?: number
                  }
                  Relationships: [
                    
                  ]
                },"papel_da_pessoa": {
                  Row: {
                    "papel": string,"pessoa_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "papel": string,"pessoa_id": string
                  }
                  Update: {
                    "papel"?: string,"pessoa_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "papel_da_pessoa_pessoa_id_fkey"
      columns: ["pessoa_id"]
isOneToOne: false
      referencedRelation: "pessoa"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "papel_da_pessoa_pessoa_id_fkey"
      columns: ["pessoa_id"]
isOneToOne: false
      referencedRelation: "pessoa_para_leitura"
      referencedColumns: ["id"]
    }
                  ]
                },"pessoa": {
                  Row: {
                    "codparc": number | null,"criado_em": string,"documento_mascarado": string | null,"email": string | null,"excluido_em": string | null,"excluido_por": string | null,"id": string,"motivo_da_exclusao": string | null,"nome": string,"versao": number
                  }
                  ComputedFields: never
                  Insert: {
                    "codparc"?: number | null,"criado_em"?: string,"documento_mascarado"?: string | null,"email"?: string | null,"excluido_em"?: string | null,"excluido_por"?: string | null,"id"?: string,"motivo_da_exclusao"?: string | null,"nome": string,"versao"?: number
                  }
                  Update: {
                    "codparc"?: number | null,"criado_em"?: string,"documento_mascarado"?: string | null,"email"?: string | null,"excluido_em"?: string | null,"excluido_por"?: string | null,"id"?: string,"motivo_da_exclusao"?: string | null,"nome"?: string,"versao"?: number
                  }
                  Relationships: [
                    
                  ]
                },"pessoa_documento": {
                  Row: {
                    "criado_em": string,"documento": string,"pessoa_id": string,"tipo_de_documento": string | null,"versao": number
                  }
                  ComputedFields: never
                  Insert: {
                    "criado_em"?: string,"documento": string,"pessoa_id": string,"tipo_de_documento"?: never,"versao"?: number
                  }
                  Update: {
                    "criado_em"?: string,"documento"?: string,"pessoa_id"?: string,"tipo_de_documento"?: never,"versao"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "pessoa_documento_pessoa_id_fkey"
      columns: ["pessoa_id"]
isOneToOne: true
      referencedRelation: "pessoa"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pessoa_documento_pessoa_id_fkey"
      columns: ["pessoa_id"]
isOneToOne: true
      referencedRelation: "pessoa_para_leitura"
      referencedColumns: ["id"]
    }
                  ]
                },"placa_do_ativo": {
                  Row: {
                    "ativo_id": string,"criado_em": string,"excluido_em": string | null,"excluido_por": string | null,"fim": string | null,"fim_origem": Database["config"]['Enums']["origem_da_data"] | null,"id": string,"inicio": string,"inicio_origem": Database["config"]['Enums']["origem_da_data"],"motivo_da_exclusao": string | null,"periodo": unknown,"placa": string,"versao": number
                  }
                  ComputedFields: never
                  Insert: {
                    "ativo_id": string,"criado_em"?: string,"excluido_em"?: string | null,"excluido_por"?: string | null,"fim"?: string | null,"fim_origem"?: Database["config"]['Enums']["origem_da_data"] | null,"id"?: string,"inicio": string,"inicio_origem": Database["config"]['Enums']["origem_da_data"],"motivo_da_exclusao"?: string | null,"periodo"?: never,"placa": string,"versao"?: number
                  }
                  Update: {
                    "ativo_id"?: string,"criado_em"?: string,"excluido_em"?: string | null,"excluido_por"?: string | null,"fim"?: string | null,"fim_origem"?: Database["config"]['Enums']["origem_da_data"] | null,"id"?: string,"inicio"?: string,"inicio_origem"?: Database["config"]['Enums']["origem_da_data"],"motivo_da_exclusao"?: string | null,"periodo"?: never,"placa"?: string,"versao"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "placa_do_ativo_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "alerta_de_vinculo"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "placa_do_ativo_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "ativo"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "placa_do_ativo_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "campo_pendente"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "placa_do_ativo_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "operacao_do_ativo"
      referencedColumns: ["ativo_id"]
    }
                  ]
                },"placa_na_operacao": {
                  Row: {
                    "ativo_id": string,"criado_em": string,"excluido_em": string | null,"excluido_por": string | null,"fim": string | null,"fim_origem": Database["config"]['Enums']["origem_da_data"] | null,"id": string,"inicio": string,"inicio_origem": Database["config"]['Enums']["origem_da_data"],"montado_por": string | null,"motivo_da_exclusao": string | null,"operacao_id": string,"periodo": unknown,"versao": number
                  }
                  ComputedFields: never
                  Insert: {
                    "ativo_id": string,"criado_em"?: string,"excluido_em"?: string | null,"excluido_por"?: string | null,"fim"?: string | null,"fim_origem"?: Database["config"]['Enums']["origem_da_data"] | null,"id"?: string,"inicio": string,"inicio_origem": Database["config"]['Enums']["origem_da_data"],"montado_por"?: string | null,"motivo_da_exclusao"?: string | null,"operacao_id": string,"periodo"?: never,"versao"?: number
                  }
                  Update: {
                    "ativo_id"?: string,"criado_em"?: string,"excluido_em"?: string | null,"excluido_por"?: string | null,"fim"?: string | null,"fim_origem"?: Database["config"]['Enums']["origem_da_data"] | null,"id"?: string,"inicio"?: string,"inicio_origem"?: Database["config"]['Enums']["origem_da_data"],"montado_por"?: string | null,"motivo_da_exclusao"?: string | null,"operacao_id"?: string,"periodo"?: never,"versao"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "placa_na_operacao_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "alerta_de_vinculo"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "placa_na_operacao_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "ativo"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "placa_na_operacao_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "campo_pendente"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "placa_na_operacao_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "operacao_do_ativo"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "placa_na_operacao_montado_por_fkey"
      columns: ["montado_por"]
isOneToOne: false
      referencedRelation: "pessoa"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "placa_na_operacao_montado_por_fkey"
      columns: ["montado_por"]
isOneToOne: false
      referencedRelation: "pessoa_para_leitura"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "placa_na_operacao_operacao_id_fkey"
      columns: ["operacao_id"]
isOneToOne: false
      referencedRelation: "operacao"
      referencedColumns: ["id"]
    }
                  ]
                },"posse_do_ativo": {
                  Row: {
                    "ativo_id": string,"criado_em": string,"excluido_em": string | null,"excluido_por": string | null,"fim": string | null,"fim_origem": Database["config"]['Enums']["origem_da_data"] | null,"id": string,"inicio": string,"inicio_origem": Database["config"]['Enums']["origem_da_data"],"motivo_da_exclusao": string | null,"periodo": unknown,"pessoa_dona_id": string | null,"regime": Database["nucleo"]['Enums']["regime_de_posse"],"versao": number
                  }
                  ComputedFields: never
                  Insert: {
                    "ativo_id": string,"criado_em"?: string,"excluido_em"?: string | null,"excluido_por"?: string | null,"fim"?: string | null,"fim_origem"?: Database["config"]['Enums']["origem_da_data"] | null,"id"?: string,"inicio": string,"inicio_origem": Database["config"]['Enums']["origem_da_data"],"motivo_da_exclusao"?: string | null,"periodo"?: never,"pessoa_dona_id"?: string | null,"regime": Database["nucleo"]['Enums']["regime_de_posse"],"versao"?: number
                  }
                  Update: {
                    "ativo_id"?: string,"criado_em"?: string,"excluido_em"?: string | null,"excluido_por"?: string | null,"fim"?: string | null,"fim_origem"?: Database["config"]['Enums']["origem_da_data"] | null,"id"?: string,"inicio"?: string,"inicio_origem"?: Database["config"]['Enums']["origem_da_data"],"motivo_da_exclusao"?: string | null,"periodo"?: never,"pessoa_dona_id"?: string | null,"regime"?: Database["nucleo"]['Enums']["regime_de_posse"],"versao"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "posse_do_ativo_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "alerta_de_vinculo"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "posse_do_ativo_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "ativo"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "posse_do_ativo_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "campo_pendente"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "posse_do_ativo_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "operacao_do_ativo"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "posse_do_ativo_pessoa_dona_id_fkey"
      columns: ["pessoa_dona_id"]
isOneToOne: false
      referencedRelation: "pessoa"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "posse_do_ativo_pessoa_dona_id_fkey"
      columns: ["pessoa_dona_id"]
isOneToOne: false
      referencedRelation: "pessoa_para_leitura"
      referencedColumns: ["id"]
    }
                  ]
                },"sinal_do_sankhya": {
                  Row: {
                    "ativo_id": string,"campo": string,"criado_em": string,"id": string,"valor": NonNullable<Json>,"valor_no_sankhya": string | null,"visto_em": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ativo_id": string,"campo": string,"criado_em"?: string,"id"?: string,"valor": NonNullable<Json>,"valor_no_sankhya"?: string | null,"visto_em": string
                  }
                  Update: {
                    "ativo_id"?: string,"campo"?: string,"criado_em"?: string,"id"?: string,"valor"?: NonNullable<Json>,"valor_no_sankhya"?: string | null,"visto_em"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sinal_do_sankhya_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "alerta_de_vinculo"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "sinal_do_sankhya_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "ativo"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sinal_do_sankhya_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "campo_pendente"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "sinal_do_sankhya_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "operacao_do_ativo"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "sinal_do_sankhya_campo_fkey"
      columns: ["campo"]
isOneToOne: false
      referencedRelation: "campo_pendente"
      referencedColumns: ["campo"]
    }
                  ]
                },"transferencia": {
                  Row: {
                    "ativo_id": string,"concluida_em": string | null,"criado_em": string,"de_gestor_id": string,"devolvida_em": string | null,"excluido_em": string | null,"excluido_por": string | null,"id": string,"motivo": string,"motivo_da_exclusao": string | null,"para_gestor_id": string,"recebida_em": string | null,"situacao": string,"versao": number
                  }
                  ComputedFields: never
                  Insert: {
                    "ativo_id": string,"concluida_em"?: string | null,"criado_em"?: string,"de_gestor_id": string,"devolvida_em"?: string | null,"excluido_em"?: string | null,"excluido_por"?: string | null,"id"?: string,"motivo": string,"motivo_da_exclusao"?: string | null,"para_gestor_id": string,"recebida_em"?: string | null,"situacao"?: string,"versao"?: number
                  }
                  Update: {
                    "ativo_id"?: string,"concluida_em"?: string | null,"criado_em"?: string,"de_gestor_id"?: string,"devolvida_em"?: string | null,"excluido_em"?: string | null,"excluido_por"?: string | null,"id"?: string,"motivo"?: string,"motivo_da_exclusao"?: string | null,"para_gestor_id"?: string,"recebida_em"?: string | null,"situacao"?: string,"versao"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "transferencia_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "alerta_de_vinculo"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "transferencia_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "ativo"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transferencia_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "campo_pendente"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "transferencia_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "operacao_do_ativo"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "transferencia_de_gestor_id_fkey"
      columns: ["de_gestor_id"]
isOneToOne: false
      referencedRelation: "pessoa"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transferencia_de_gestor_id_fkey"
      columns: ["de_gestor_id"]
isOneToOne: false
      referencedRelation: "pessoa_para_leitura"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transferencia_para_gestor_id_fkey"
      columns: ["para_gestor_id"]
isOneToOne: false
      referencedRelation: "pessoa"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transferencia_para_gestor_id_fkey"
      columns: ["para_gestor_id"]
isOneToOne: false
      referencedRelation: "pessoa_para_leitura"
      referencedColumns: ["id"]
    }
                  ]
                },"transferencia_pendencia": {
                  Row: {
                    "criado_em": string,"excluido_em": string | null,"excluido_por": string | null,"id": string,"motivo_da_exclusao": string | null,"nota": string | null,"respondida_em": string | null,"respondida_por": string | null,"resposta": string | null,"texto": string,"transferencia_id": string,"versao": number
                  }
                  ComputedFields: never
                  Insert: {
                    "criado_em"?: string,"excluido_em"?: string | null,"excluido_por"?: string | null,"id"?: string,"motivo_da_exclusao"?: string | null,"nota"?: string | null,"respondida_em"?: string | null,"respondida_por"?: string | null,"resposta"?: string | null,"texto": string,"transferencia_id": string,"versao"?: number
                  }
                  Update: {
                    "criado_em"?: string,"excluido_em"?: string | null,"excluido_por"?: string | null,"id"?: string,"motivo_da_exclusao"?: string | null,"nota"?: string | null,"respondida_em"?: string | null,"respondida_por"?: string | null,"resposta"?: string | null,"texto"?: string,"transferencia_id"?: string,"versao"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "transferencia_pendencia_respondida_por_fkey"
      columns: ["respondida_por"]
isOneToOne: false
      referencedRelation: "pessoa"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transferencia_pendencia_respondida_por_fkey"
      columns: ["respondida_por"]
isOneToOne: false
      referencedRelation: "pessoa_para_leitura"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transferencia_pendencia_transferencia_id_fkey"
      columns: ["transferencia_id"]
isOneToOne: false
      referencedRelation: "transferencia"
      referencedColumns: ["id"]
    }
                  ]
                },"usuario": {
                  Row: {
                    "ativo": boolean,"auth_user_id": string,"criado_em": string,"perfil": string,"pessoa_id": string,"versao": number
                  }
                  ComputedFields: never
                  Insert: {
                    "ativo"?: boolean,"auth_user_id": string,"criado_em"?: string,"perfil": string,"pessoa_id": string,"versao"?: number
                  }
                  Update: {
                    "ativo"?: boolean,"auth_user_id"?: string,"criado_em"?: string,"perfil"?: string,"pessoa_id"?: string,"versao"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "usuario_pessoa_id_fkey"
      columns: ["pessoa_id"]
isOneToOne: true
      referencedRelation: "pessoa"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "usuario_pessoa_id_fkey"
      columns: ["pessoa_id"]
isOneToOne: true
      referencedRelation: "pessoa_para_leitura"
      referencedColumns: ["id"]
    }
                  ]
                },"usuario_filial": {
                  Row: {
                    "filial_id": string,"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "filial_id": string,"usuario_id": string
                  }
                  Update: {
                    "filial_id"?: string,"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "usuario_filial_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "usuario"
      referencedColumns: ["pessoa_id"]
    }
                  ]
                },"usuario_operacao": {
                  Row: {
                    "operacao_id": string,"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "operacao_id": string,"usuario_id": string
                  }
                  Update: {
                    "operacao_id"?: string,"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "usuario_operacao_operacao_id_fkey"
      columns: ["operacao_id"]
isOneToOne: false
      referencedRelation: "operacao"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "usuario_operacao_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "usuario"
      referencedColumns: ["pessoa_id"]
    }
                  ]
                }
          }
          Views: {
            "alerta_de_cr": {
                  Row: {
                    "alerta": string | null,"cr_id": string
                  }
                  ComputedFields: never
                  Insert: {
                           "alerta"?: never,"cr_id"?: string | null
                         }
                        Update: {
                           "alerta"?: never,"cr_id"?: string | null
                         }
                        Relationships: [
                    
                  ]
                },"alerta_de_vinculo": {
                  Row: {
                    "alerta": string | null,"ativo_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"campo_pendente": {
                  Row: {
                    "ativo_id": string,"campo": string,"rotulo": string
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"divergencia_de_campo": {
                  Row: {
                    "ativo_id": string,"campo": string,"origem_no_eixo": string | null,"rotulo": string,"texto_no_sankhya": string | null,"valor_no_eixo": Json | null,"valor_no_sankhya": NonNullable<Json>,"visto_em": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "sinal_do_sankhya_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "alerta_de_vinculo"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "sinal_do_sankhya_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "ativo"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sinal_do_sankhya_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "campo_pendente"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "sinal_do_sankhya_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "operacao_do_ativo"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "sinal_do_sankhya_campo_fkey"
      columns: ["campo"]
isOneToOne: false
      referencedRelation: "campo_pendente"
      referencedColumns: ["campo"]
    }
                  ]
                },"linha_de_placa": {
                  Row: {
                    "alertas": (string)[] | null,"ano": number | null,"baixada": boolean | null,"busca": string,"cavalo": string | null,"cr": string | null,"desde": string | null,"dias_no_status": number | null,"filial": string | null,"garagem": string | null,"gestor": string | null,"grupo": string | null,"id": string,"implementos": (string)[],"modelo": string,"nome_da_situacao": string | null,"operacao": string | null,"placa": string,"renavam": string | null,"sigla": string,"tipo": string,"valor_fipe": number | null
                  }
                  ComputedFields: never
                  Insert: {
                           "alertas"?: never,"ano"?: number | null,"baixada"?: never,"busca"?: string | null,"cavalo"?: string | null,"cr"?: string | null,"desde"?: string | null,"dias_no_status"?: never,"filial"?: string | null,"garagem"?: string | null,"gestor"?: string | null,"grupo"?: string | null,"id"?: string | null,"implementos"?: (string)[] | null,"modelo"?: string | null,"nome_da_situacao"?: string | null,"operacao"?: string | null,"placa"?: string | null,"renavam"?: string | null,"sigla"?: string | null,"tipo"?: string | null,"valor_fipe"?: number | null
                         }
                        Update: {
                           "alertas"?: never,"ano"?: number | null,"baixada"?: never,"busca"?: string | null,"cavalo"?: string | null,"cr"?: string | null,"desde"?: string | null,"dias_no_status"?: never,"filial"?: string | null,"garagem"?: string | null,"gestor"?: string | null,"grupo"?: string | null,"id"?: string | null,"implementos"?: (string)[] | null,"modelo"?: string | null,"nome_da_situacao"?: string | null,"operacao"?: string | null,"placa"?: string | null,"renavam"?: string | null,"sigla"?: string | null,"tipo"?: string | null,"valor_fipe"?: number | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "leitura_da_placa_ativo_id_fkey"
      columns: ["id"]
isOneToOne: true
      referencedRelation: "alerta_de_vinculo"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "leitura_da_placa_ativo_id_fkey"
      columns: ["id"]
isOneToOne: true
      referencedRelation: "ativo"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leitura_da_placa_ativo_id_fkey"
      columns: ["id"]
isOneToOne: true
      referencedRelation: "campo_pendente"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "leitura_da_placa_ativo_id_fkey"
      columns: ["id"]
isOneToOne: true
      referencedRelation: "operacao_do_ativo"
      referencedColumns: ["ativo_id"]
    }
                  ]
                },"operacao_do_ativo": {
                  Row: {
                    "ativo_id": string,"cr_id": string | null,"degrau": string | null,"operacao_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"pessoa_para_leitura": {
                  Row: {
                    "codparc": number | null,"criado_em": string,"documento_mascarado": string | null,"email": string | null,"excluido_em": string | null,"id": string,"nome": string
                  }
                  ComputedFields: never
                  Insert: {
                           "codparc"?: number | null,"criado_em"?: string | null,"documento_mascarado"?: string | null,"email"?: string | null,"excluido_em"?: string | null,"id"?: string | null,"nome"?: string | null
                         }
                        Update: {
                           "codparc"?: number | null,"criado_em"?: string | null,"documento_mascarado"?: string | null,"email"?: string | null,"excluido_em"?: string | null,"id"?: string | null,"nome"?: string | null
                         }
                        Relationships: [
                    
                  ]
                },"placa_atual": {
                  Row: {
                    "ativo_id": string,"inicio": string,"placa": string
                  }
                  ComputedFields: never
                  Insert: {
                           "ativo_id"?: string | null,"inicio"?: string | null,"placa"?: string | null
                         }
                        Update: {
                           "ativo_id"?: string | null,"inicio"?: string | null,"placa"?: string | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "placa_do_ativo_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "alerta_de_vinculo"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "placa_do_ativo_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "ativo"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "placa_do_ativo_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "campo_pendente"
      referencedColumns: ["ativo_id"]
    },{
      foreignKeyName: "placa_do_ativo_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "operacao_do_ativo"
      referencedColumns: ["ativo_id"]
    }
                  ]
                }
          }
          Functions: {
            "alerta_correcao_tardia":
{ Args: { "p_em": string,"p_ultima": string }; Returns: boolean
                           },
"alerta_parado_em_patio":
{ Args: { "p_em": string,"p_inicio_do_pat": string }; Returns: boolean
                           },
"alertas_com_prazos":
{ Args: { "p_baixada": boolean,"p_em": string,"p_inicio_do_pat": string,"p_ultima_correcao": string,"p_vigentes": (string)[] }; Returns: (string)[]
                           },
"alertas_do_ativo":
{ Args: { "p_ativo_id": string,"p_em": string }; Returns: (string)[]
                           },
"alertas_vigentes_do_ativo":
{ Args: { "p_ativo_id": string,"p_em": string }; Returns: (string)[]
                           },
"ativo_da_placa":
{ Args: { "p_placa": string }; Returns: string
                           },
"atualizar_leitura_vencida":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"cadastrar_ativo":
{ Args: { "p_carroceria_id"?: string,"p_chassi"?: string,"p_chave"?: string,"p_cr_id": string,"p_eixos"?: number,"p_em"?: string,"p_funcao"?: Database["nucleo"]['Enums']["funcao_do_implemento"],"p_gestor_id": string,"p_modelo_id"?: string,"p_numero_de_serie"?: string,"p_operacao_id": string,"p_pessoa_dona_id"?: string,"p_placa": string,"p_regime"?: Database["nucleo"]['Enums']["regime_de_posse"],"p_renavam": string,"p_situacao_inicial"?: string,"p_tipo": Database["nucleo"]['Enums']["tipo_de_ativo"] }; Returns: string
                           },
"concluir_transferencia":
{ Args: { "p_em": string,"p_transferencia_id": string }; Returns: string
                           },
"conferir_conjunto":
{ Args: { "p_cavalo_id": string }; Returns: undefined
                           },
"contar_chips_de_placas":
{ Args: { "p_baixadas": boolean,"p_busca": string,"p_grupos": (string)[],"p_siglas": (string)[],"p_tipos": (string)[] }; Returns: {
              "chip": string,"quantidade": number
            }[]
                           },
"corrigir_campo":
{ Args: { "p_ativo_id": string,"p_campo": string,"p_chave"?: string,"p_motivo": string,"p_valor": Json,"p_versao"?: number }; Returns: string
                           },
"cr_em":
{ Args: { "p_ativo_id": string,"p_em": string }; Returns: string
                           },
"criar_cr":
{ Args: { "p_chave"?: string,"p_codcencus": number,"p_codigo": string,"p_nome": string }; Returns: string
                           },
"desatrelar":
{ Args: { "p_cavalo_id": string,"p_em": string,"p_implementos"?: (string)[] }; Returns: number
                           },
"detalhe_da_placa":
{ Args: { "p_placa": string }; Returns: Json
                           },
"documento_valido":
{ Args: { "p_texto": string }; Returns: boolean
                           },
"em_conjunto":
{ Args: { "p_ativo_id": string,"p_em": string }; Returns: boolean
                           },
"engatar":
{ Args: { "p_cavalo_id": string,"p_em": string,"p_implemento_id": string,"p_posicao": number }; Returns: string
                           },
"entregar_ao_operacional":
{ Args: { "p_ativo_id": string,"p_chave"?: string,"p_em": string,"p_filial_id": string,"p_versao": number }; Returns: string
                           },
"estado_em":
{ Args: { "p_ativo_id": string,"p_camada": string,"p_em": string }; Returns: string
                           },
"filial_do_cr_em":
{ Args: { "p_ativo_id": string,"p_em": string }; Returns: string
                           },
"garagem_em":
{ Args: { "p_ativo_id": string,"p_em": string }; Returns: string
                           },
"gravar_campo":
{ Args: { "p_ativo_id": string,"p_campo": string,"p_motivo": string,"p_origem": Database["config"]['Enums']["origem_do_campo"],"p_valor": Json }; Returns: undefined
                           },
"historia_da_placa":
{ Args: { "p_placa": string }; Returns: {
              "em": string,"sigla": string
            }[]
                           },
"inicio_do_pat":
{ Args: { "p_ativo_id": string }; Returns: string
                           },
"linha_calculada_da_placa":
{ Args: { "p_ativo_id": string,"p_em"?: string }; Returns: {
              "alertas_vigentes": (string)[],
"ano": number | null,
"ativo_id": string,
"baixada_em": string | null,
"busca": string,
"causa_id": string | null,
"cavalo": string | null,
"cr": string | null,
"desde": string | null,
"filial": string | null,
"filial_da_custodia_id": string | null,
"garagem": string | null,
"gestor": string | null,
"gestor_id": string | null,
"grupo": string | null,
"implementos": (string)[],
"inicio_do_pat": string | null,
"modelo": string,
"nome_da_situacao": string | null,
"operacao": string | null,
"operacao_id": string | null,
"placa": string,
"proximo_recalculo": string | null,
"recalculado_em": string,
"renavam": string | null,
"sigla": string,
"tipo": string,
"ultima_correcao_tardia_em": string | null,
"valor_fipe": number | null
            }
                          SetofOptions: {
        from: "*"
        to: "leitura_da_placa"
        isOneToOne: true
        isSetofReturn: false
      } },
"linhas_divergentes":
{ Args: Record<PropertyKey, never>; Returns: {
              "ativo_id": string,"motivo": string
            }[]
                           },
"listar_placas":
{ Args: { "p_baixadas": boolean,"p_busca": string,"p_decrescente": boolean,"p_grupos": (string)[],"p_ordem": string,"p_pagina": number,"p_siglas": (string)[],"p_tam": number,"p_tipos": (string)[] }; Returns: Json
                           },
"mascarar_documento":
{ Args: { "p_texto": string }; Returns: string
                           },
"meta_do_conjunto_de":
{ Args: { "p_ativo_id": string,"p_em"?: string }; Returns: number
                           },
"mudar_tipo_do_ativo":
{ Args: { "p_ativo_id": string,"p_motivo": string,"p_tipo": Database["nucleo"]['Enums']["tipo_de_ativo"] }; Returns: undefined
                           },
"nome_do_conjunto":
{ Args: { "p_cavalo_id": string,"p_em"?: string }; Returns: string
                           },
"nome_do_tipo":
{ Args: { "p_tipo": Database["nucleo"]['Enums']["tipo_de_ativo"] }; Returns: string
                           },
"normalizar_documento":
{ Args: { "p_texto": string }; Returns: string
                           },
"normalizar_placa":
{ Args: { "p_texto": string }; Returns: string
                           },
"normalizar_renavam":
{ Args: { "p_texto": string }; Returns: string
                           },
"operacao_e_degrau_em":
{ Args: { "p_ativo_id": string,"p_em": string }; Returns: {
              "degrau": string,"operacao_id": string
            }[]
                           },
"operacao_em":
{ Args: { "p_ativo_id": string,"p_em": string }; Returns: string
                           },
"placa_valida":
{ Args: { "p_texto": string }; Returns: boolean
                           },
"placas_filtradas":
{ Args: { "p_baixadas": boolean,"p_busca": string,"p_grupos": (string)[],"p_siglas": (string)[],"p_tipos": (string)[] }; Returns: {
              "alertas": (string)[] | null,
"ano": number | null,
"baixada": boolean | null,
"busca": string,
"cavalo": string | null,
"cr": string | null,
"desde": string | null,
"dias_no_status": number | null,
"filial": string | null,
"garagem": string | null,
"gestor": string | null,
"grupo": string | null,
"id": string,
"implementos": (string)[],
"modelo": string,
"nome_da_situacao": string | null,
"operacao": string | null,
"placa": string,
"renavam": string | null,
"sigla": string,
"tipo": string,
"valor_fipe": number | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "linha_de_placa"
        isOneToOne: false
        isSetofReturn: true
      } },
"proximo_recalculo_do_ativo":
{ Args: { "p_ativo_id": string,"p_em"?: string }; Returns: string
                           },
"recalcular_linha_da_placa":
{ Args: { "p_ativo_id": string,"p_em"?: string }; Returns: undefined
                           },
"recalcular_linhas_vencidas":
{ Args: { "p_em"?: string,"p_limite"?: number }; Returns: number
                           },
"recalcular_so_a_linha":
{ Args: { "p_ativo_id": string,"p_em"?: string }; Returns: undefined
                           },
"receber_sinal_do_sankhya":
{ Args: { "p_ativo_id": string,"p_campo": string,"p_valor": Json,"p_valor_no_sankhya"?: string,"p_visto_em"?: string }; Returns: string
                           },
"receber_transferencia":
{ Args: { "p_em": string,"p_transferencia_id": string }; Returns: undefined
                           },
"reconstruir_leitura_das_placas":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"registrar_baixa":
{ Args: { "p_ativo_id": string,"p_em": string,"p_motivo": string,"p_sigla": string }; Returns: undefined
                           },
"registrar_evento":
{ Args: { "p_ativo_id": string,"p_camada"?: string,"p_em": string,"p_em_origem"?: Database["config"]['Enums']["origem_da_data"],"p_justificativa"?: string,"p_origem"?: string,"p_sigla": string }; Returns: string
                           },
"renavam_valido":
{ Args: { "p_texto": string }; Returns: boolean
                           },
"revogar_correcao":
{ Args: { "p_correcao_id": string,"p_motivo": string }; Returns: undefined
                           },
"sigla_valida":
{ Args: { "p_em_conjunto": boolean,"p_sigla": string,"p_tipo": Database["nucleo"]['Enums']["tipo_de_ativo"] }; Returns: boolean
                           },
"situacao_atual":
{ Args: { "p_ativo_id": string }; Returns: string
                           },
"situacao_com_causa":
{ Args: { "p_ativo_id": string,"p_em": string }; Returns: {
              "causa_id": string,"sigla": string
            }[]
                           },
"situacao_do_conjunto":
{ Args: { "p_cavalo_id": string,"p_em": string }; Returns: {
              "causa_id": string,"sigla": string
            }[]
                           },
"situacao_em":
{ Args: { "p_ativo_id": string,"p_em": string }; Returns: string
                           },
"texto_simples":
{ Args: { "p_texto": string }; Returns: string
                           },
"tipo_do_cr":
{ Args: { "p_participa_da_frota": boolean,"p_veiculo_obrigatorio": boolean }; Returns: Database["nucleo"]['Enums']["tipo_de_cr"]
                           },
"ultima_correcao_tardia_em":
{ Args: { "p_ativo_id": string }; Returns: string
                           },
"vincular_usuario":
{ Args: { "p_email": string,"p_perfil": string,"p_pessoa_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "com_quem_da_custodia": "gestor"|"operacional","funcao_do_implemento": "semirreboque"|"dolly","regime_de_posse": "propria"|"acionista"|"agregado"|"terceiro"|"alugada","tipo_de_ativo": "cavalo"|"implemento"|"equipamento"|"caminhao"|"apoio","tipo_de_cr": "servico"|"frota_de_ativo"|"frota_sem_placa"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            [_ in never]: never
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "config": {
          Enums: {
            "origem_da_data": ["derivada", "observada", "informada"],"origem_do_campo": ["sankhya", "derivada", "informada", "correcao_local"]
          }
        },"graphql_public": {
          Enums: {
            
          }
        },"nucleo": {
          Enums: {
            "com_quem_da_custodia": ["gestor", "operacional"],"funcao_do_implemento": ["semirreboque", "dolly"],"regime_de_posse": ["propria", "acionista", "agregado", "terceiro", "alugada"],"tipo_de_ativo": ["cavalo", "implemento", "equipamento", "caminhao", "apoio"],"tipo_de_cr": ["servico", "frota_de_ativo", "frota_sem_placa"]
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
