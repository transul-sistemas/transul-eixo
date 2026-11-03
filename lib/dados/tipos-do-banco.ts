// Arquivo gerado por `pnpm db:tipos` a partir do banco local. NÃO edite à mão.
// Para atualizar: `pnpm exec supabase start` e `pnpm db:tipos`. O CI falha se estiver defasado.


export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "config": {
          Tables: {
            "camada_de_status": {
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
                },"garagem": {
                  Row: {
                    "criado_em": string,"excluido_em": string | null,"excluido_por": string | null,"filial_id": string,"id": string,"motivo_da_exclusao": string | null,"nome": string,"versao": number
                  }
                  ComputedFields: never
                  Insert: {
                    "criado_em"?: string,"excluido_em"?: string | null,"excluido_por"?: string | null,"filial_id": string,"id"?: string,"motivo_da_exclusao"?: string | null,"nome": string,"versao"?: number
                  }
                  Update: {
                    "criado_em"?: string,"excluido_em"?: string | null,"excluido_por"?: string | null,"filial_id"?: string,"id"?: string,"motivo_da_exclusao"?: string | null,"nome"?: string,"versao"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "garagem_filial_id_fkey"
      columns: ["filial_id"]
isOneToOne: false
      referencedRelation: "filial"
      referencedColumns: ["id"]
    }
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
            "nome_do_conjunto":
{ Args: { "p_carroceria_id": string,"p_com_dolly": boolean,"p_eixos_do_dolly": number,"p_eixos_dos_semirreboques": number,"p_unidades": number }; Returns: string
                           }
          }
          Enums: {
            "origem_da_data": "derivada"|"observada"|"informada"
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
                    "carroceria_id": string | null,"chassi": string | null,"codveiculo": number | null,"criado_em": string,"eixos": number | null,"excluido_em": string | null,"excluido_por": string | null,"funcao": Database["nucleo"]['Enums']["funcao_do_implemento"] | null,"id": string,"modelo_id": string | null,"motivo_da_exclusao": string | null,"numero_de_serie": string | null,"renavam": string | null,"tipo": Database["nucleo"]['Enums']["tipo_de_ativo"],"versao": number
                  }
                  ComputedFields: never
                  Insert: {
                    "carroceria_id"?: string | null,"chassi"?: string | null,"codveiculo"?: number | null,"criado_em"?: string,"eixos"?: number | null,"excluido_em"?: string | null,"excluido_por"?: string | null,"funcao"?: Database["nucleo"]['Enums']["funcao_do_implemento"] | null,"id"?: string,"modelo_id"?: string | null,"motivo_da_exclusao"?: string | null,"numero_de_serie"?: string | null,"renavam"?: string | null,"tipo": Database["nucleo"]['Enums']["tipo_de_ativo"],"versao"?: number
                  }
                  Update: {
                    "carroceria_id"?: string | null,"chassi"?: string | null,"codveiculo"?: number | null,"criado_em"?: string,"eixos"?: number | null,"excluido_em"?: string | null,"excluido_por"?: string | null,"funcao"?: Database["nucleo"]['Enums']["funcao_do_implemento"] | null,"id"?: string,"modelo_id"?: string | null,"motivo_da_exclusao"?: string | null,"numero_de_serie"?: string | null,"renavam"?: string | null,"tipo"?: Database["nucleo"]['Enums']["tipo_de_ativo"],"versao"?: number
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
      referencedRelation: "ativo"
      referencedColumns: ["id"]
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
                },"cr": {
                  Row: {
                    "ativo": boolean,"bloqueado": boolean,"codcencus": number | null,"codigo": string,"criado_em": string,"excluido_em": string | null,"excluido_por": string | null,"id": string,"motivo_da_exclusao": string | null,"nome": string | null,"operacao_id": string | null,"versao": number
                  }
                  ComputedFields: never
                  Insert: {
                    "ativo"?: boolean,"bloqueado"?: boolean,"codcencus"?: number | null,"codigo": string,"criado_em"?: string,"excluido_em"?: string | null,"excluido_por"?: string | null,"id"?: string,"motivo_da_exclusao"?: string | null,"nome"?: string | null,"operacao_id"?: string | null,"versao"?: number
                  }
                  Update: {
                    "ativo"?: boolean,"bloqueado"?: boolean,"codcencus"?: number | null,"codigo"?: string,"criado_em"?: string,"excluido_em"?: string | null,"excluido_por"?: string | null,"id"?: string,"motivo_da_exclusao"?: string | null,"nome"?: string | null,"operacao_id"?: string | null,"versao"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "cr_operacao_id_fkey"
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
      referencedRelation: "ativo"
      referencedColumns: ["id"]
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
      referencedRelation: "ativo"
      referencedColumns: ["id"]
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
      referencedRelation: "ativo"
      referencedColumns: ["id"]
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
      referencedRelation: "ativo"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "evento_de_status_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "operacao_do_ativo"
      referencedColumns: ["ativo_id"]
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
      referencedRelation: "ativo"
      referencedColumns: ["id"]
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
      referencedRelation: "ativo"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "placa_do_ativo_ativo_id_fkey"
      columns: ["ativo_id"]
isOneToOne: false
      referencedRelation: "operacao_do_ativo"
      referencedColumns: ["ativo_id"]
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
      referencedRelation: "ativo"
      referencedColumns: ["id"]
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
      referencedRelation: "ativo"
      referencedColumns: ["id"]
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
      foreignKeyName: "transferencia_para_gestor_id_fkey"
      columns: ["para_gestor_id"]
isOneToOne: false
      referencedRelation: "pessoa"
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
      foreignKeyName: "transferencia_pendencia_transferencia_id_fkey"
      columns: ["transferencia_id"]
isOneToOne: false
      referencedRelation: "transferencia"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "alerta_de_vinculo": {
                  Row: {
                    "alerta": string | null,"ativo_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"operacao_do_ativo": {
                  Row: {
                    "ativo_id": string,"cr_id": string | null,"degrau": string | null,"operacao_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "cr_do_ativo_cr_id_fkey"
      columns: ["cr_id"]
isOneToOne: false
      referencedRelation: "cr"
      referencedColumns: ["id"]
    }
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
      referencedRelation: "ativo"
      referencedColumns: ["id"]
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
            "concluir_transferencia":
{ Args: { "p_em": string,"p_transferencia_id": string }; Returns: string
                           },
"conferir_conjunto":
{ Args: { "p_cavalo_id": string }; Returns: undefined
                           },
"desatrelar":
{ Args: { "p_cavalo_id": string,"p_em": string,"p_implementos"?: (string)[] }; Returns: number
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
"estado_em":
{ Args: { "p_ativo_id": string,"p_camada": string,"p_em": string }; Returns: string
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
"placa_valida":
{ Args: { "p_texto": string }; Returns: boolean
                           },
"receber_transferencia":
{ Args: { "p_em": string,"p_transferencia_id": string }; Returns: undefined
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
                           }
          }
          Enums: {
            "com_quem_da_custodia": "gestor"|"operacional","funcao_do_implemento": "semirreboque"|"dolly","regime_de_posse": "propria"|"acionista"|"agregado"|"terceiro"|"alugada","tipo_de_ativo": "cavalo"|"implemento"|"equipamento"|"caminhao"|"apoio"
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
            "origem_da_data": ["derivada", "observada", "informada"]
          }
        },"graphql_public": {
          Enums: {
            
          }
        },"nucleo": {
          Enums: {
            "com_quem_da_custodia": ["gestor", "operacional"],"funcao_do_implemento": ["semirreboque", "dolly"],"regime_de_posse": ["propria", "acionista", "agregado", "terceiro", "alugada"],"tipo_de_ativo": ["cavalo", "implemento", "equipamento", "caminhao", "apoio"]
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
