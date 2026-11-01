// Arquivo gerado por `pnpm db:tipos` a partir do banco local. NÃO edite à mão.
// Para atualizar: `pnpm exec supabase start` e `pnpm db:tipos`. O CI falha se estiver defasado.


export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "config": {
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
                    "chassi": string | null,"codveiculo": number | null,"criado_em": string,"excluido_em": string | null,"excluido_por": string | null,"id": string,"motivo_da_exclusao": string | null,"numero_de_serie": string | null,"renavam": string | null,"tipo": Database["nucleo"]['Enums']["tipo_de_ativo"],"versao": number
                  }
                  ComputedFields: never
                  Insert: {
                    "chassi"?: string | null,"codveiculo"?: number | null,"criado_em"?: string,"excluido_em"?: string | null,"excluido_por"?: string | null,"id"?: string,"motivo_da_exclusao"?: string | null,"numero_de_serie"?: string | null,"renavam"?: string | null,"tipo": Database["nucleo"]['Enums']["tipo_de_ativo"],"versao"?: number
                  }
                  Update: {
                    "chassi"?: string | null,"codveiculo"?: number | null,"criado_em"?: string,"excluido_em"?: string | null,"excluido_por"?: string | null,"id"?: string,"motivo_da_exclusao"?: string | null,"numero_de_serie"?: string | null,"renavam"?: string | null,"tipo"?: Database["nucleo"]['Enums']["tipo_de_ativo"],"versao"?: number
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
    }
                  ]
                }
          }
          Views: {
            "placa_atual": {
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
    }
                  ]
                }
          }
          Functions: {
            "documento_valido":
{ Args: { "p_texto": string }; Returns: boolean
                           },
"mascarar_documento":
{ Args: { "p_texto": string }; Returns: string
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
"renavam_valido":
{ Args: { "p_texto": string }; Returns: boolean
                           }
          }
          Enums: {
            "tipo_de_ativo": "cavalo"|"implemento"|"equipamento"|"caminhao"|"apoio"
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
            "tipo_de_ativo": ["cavalo", "implemento", "equipamento", "caminhao", "apoio"]
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
