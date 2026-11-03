export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      atendentes: {
        Row: {
          ativo: boolean
          cargo: string
          created_at: string
          departamento_id: number | null
          id: number
          nome: string
          telefone: string | null
        }
        Insert: {
          ativo?: boolean
          cargo: string
          created_at?: string
          departamento_id?: number | null
          id?: number
          nome: string
          telefone?: string | null
        }
        Update: {
          ativo?: boolean
          cargo?: string
          created_at?: string
          departamento_id?: number | null
          id?: number
          nome?: string
          telefone?: string | null
        }
        Relationships: []
      }
      atendimento_transferencias: {
        Row: {
          atendimento_id: number
          created_at: string
          de_atendente_id: number | null
          de_departamento_id: number | null
          id: number
          motivo: string | null
          para_atendente_id: number | null
          para_departamento_id: number | null
        }
        Insert: {
          atendimento_id: number
          created_at?: string
          de_atendente_id?: number | null
          de_departamento_id?: number | null
          id?: number
          motivo?: string | null
          para_atendente_id?: number | null
          para_departamento_id?: number | null
        }
        Update: {
          atendimento_id?: number
          created_at?: string
          de_atendente_id?: number | null
          de_departamento_id?: number | null
          id?: number
          motivo?: string | null
          para_atendente_id?: number | null
          para_departamento_id?: number | null
        }
        Relationships: []
      }
      atendimentos: {
        Row: {
          atendente_id: number | null
          client_id: number | null
          created_at: string
          departamento_id: number | null
          encerrado_em: string | null
          id: number
          session_id: string
          status: string
          updated_at: string
        }
        Insert: {
          atendente_id?: number | null
          client_id?: number | null
          created_at?: string
          departamento_id?: number | null
          encerrado_em?: string | null
          id?: number
          session_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          atendente_id?: number | null
          client_id?: number | null
          created_at?: string
          departamento_id?: number | null
          encerrado_em?: string | null
          id?: number
          session_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          active: boolean | null
          bot_message: string | null
          conversation_id: string | null
          created_at: string | null
          data: string | null
          id: number
          message_type: string | null
          phone: string | null
          user_message: string | null
        }
        Insert: {
          active?: boolean | null
          bot_message?: string | null
          conversation_id?: string | null
          created_at?: string | null
          data?: string | null
          id?: number
          message_type?: string | null
          phone?: string | null
          user_message?: string | null
        }
        Update: {
          active?: boolean | null
          bot_message?: string | null
          conversation_id?: string | null
          created_at?: string | null
          data?: string | null
          id?: number
          message_type?: string | null
          phone?: string | null
          user_message?: string | null
        }
        Relationships: []
      }
      chats: {
        Row: {
          app: string | null
          conversation_id: string | null
          created_at: string | null
          id: number
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          app?: string | null
          conversation_id?: string | null
          created_at?: string | null
          id?: number
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          app?: string | null
          conversation_id?: string | null
          created_at?: string | null
          id?: number
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      client_pendencias: {
        Row: {
          client_id: number
          concluida_em: string | null
          created_at: string
          descricao: string
          id: number
          observacao: string | null
          status: string
          tipo_id: number | null
        }
        Insert: {
          client_id: number
          concluida_em?: string | null
          created_at?: string
          descricao: string
          id?: number
          observacao?: string | null
          status?: string
          tipo_id?: number | null
        }
        Update: {
          client_id?: number
          concluida_em?: string | null
          created_at?: string
          descricao?: string
          id?: number
          observacao?: string | null
          status?: string
          tipo_id?: number | null
        }
        Relationships: []
      }
      client_tags: {
        Row: {
          client_id: number
          created_at: string
          id: number
          tag_id: number
        }
        Insert: {
          client_id: number
          created_at?: string
          id?: number
          tag_id: number
        }
        Update: {
          client_id?: number
          created_at?: string
          id?: number
          tag_id?: number
        }
        Relationships: []
      }
      conversas_status: {
        Row: {
          arquivada_em: string | null
          created_at: string
          fechada_em: string | null
          id: number
          reaberta_em: string | null
          session_id: string
          status: string
          updated_at: string
        }
        Insert: {
          arquivada_em?: string | null
          created_at?: string
          fechada_em?: string | null
          id?: number
          reaberta_em?: string | null
          session_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          arquivada_em?: string | null
          created_at?: string
          fechada_em?: string | null
          id?: number
          reaberta_em?: string | null
          session_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          active: boolean | null
          app: string | null
          cliente_name: string | null
          created_at: string
          distance: number | null
          email: string | null
          id: number
          lat: number | null
          location: string | null
          long: number | null
          pagamento: string | null
          phone: number | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          app?: string | null
          cliente_name?: string | null
          created_at?: string
          distance?: number | null
          email?: string | null
          id?: number
          lat?: number | null
          location?: string | null
          long?: number | null
          pagamento?: string | null
          phone?: number | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          app?: string | null
          cliente_name?: string | null
          created_at?: string
          distance?: number | null
          email?: string | null
          id?: number
          lat?: number | null
          location?: string | null
          long?: number | null
          pagamento?: string | null
          phone?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      dados_cliente: {
        Row: {
          asaas_customer_id: string | null
          cpf_cnpj: string | null
          created_at: string | null
          email: string | null
          id: number
          nome: string | null
          nome_pet: string | null
          payments: Json | null
          porte_pet: string | null
          raca_pet: string | null
          servico: string | null
          sessionid: string | null
          status: boolean | null
          telefone: string | null
        }
        Insert: {
          asaas_customer_id?: string | null
          cpf_cnpj?: string | null
          created_at?: string | null
          email?: string | null
          id?: number
          nome?: string | null
          nome_pet?: string | null
          payments?: Json | null
          porte_pet?: string | null
          raca_pet?: string | null
          servico?: string | null
          sessionid?: string | null
          status?: boolean | null
          telefone?: string | null
        }
        Update: {
          asaas_customer_id?: string | null
          cpf_cnpj?: string | null
          created_at?: string | null
          email?: string | null
          id?: number
          nome?: string | null
          nome_pet?: string | null
          payments?: Json | null
          porte_pet?: string | null
          raca_pet?: string | null
          servico?: string | null
          sessionid?: string | null
          status?: boolean | null
          telefone?: string | null
        }
        Relationships: []
      }
      departamentos: {
        Row: {
          cor: string
          created_at: string
          id: number
          nome: string
        }
        Insert: {
          cor?: string
          created_at?: string
          id?: number
          nome: string
        }
        Update: {
          cor?: string
          created_at?: string
          id?: number
          nome?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          content: string | null
          embedding: string | null
          id: number
          metadata: Json | null
          titulo: string | null
        }
        Insert: {
          content?: string | null
          embedding?: string | null
          id?: number
          metadata?: Json | null
          titulo?: string | null
        }
        Update: {
          content?: string | null
          embedding?: string | null
          id?: number
          metadata?: Json | null
          titulo?: string | null
        }
        Relationships: []
      }
      documents_natacao: {
        Row: {
          content: string | null
          embedding: string | null
          id: number
          metadata: Json | null
        }
        Insert: {
          content?: string | null
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Update: {
          content?: string | null
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Relationships: []
      }
      documents_products: {
        Row: {
          created_at: string
          id: number
          nome_produto: string | null
          preco_produto: number | null
        }
        Insert: {
          created_at?: string
          id?: number
          nome_produto?: string | null
          preco_produto?: number | null
        }
        Update: {
          created_at?: string
          id?: number
          nome_produto?: string | null
          preco_produto?: number | null
        }
        Relationships: []
      }
      documentsproducts: {
        Row: {
          content: string | null
          embedding: string | null
          id: number
          metadata: Json | null
        }
        Insert: {
          content?: string | null
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Update: {
          content?: string | null
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Relationships: []
      }
      imagens_drive: {
        Row: {
          created_at: string | null
          drive_id: string
          id: number
          nome: string
        }
        Insert: {
          created_at?: string | null
          drive_id: string
          id?: number
          nome: string
        }
        Update: {
          created_at?: string | null
          drive_id?: string
          id?: number
          nome?: string
        }
        Relationships: []
      }
      lembrete_ajustes: {
        Row: {
          id: number
          envio_automatico: boolean
          nome_clinica: string
          telefone_teste: string | null
          pausa_ia_minutos: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: number
          envio_automatico?: boolean
          nome_clinica?: string
          telefone_teste?: string | null
          pausa_ia_minutos?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: number
          envio_automatico?: boolean
          nome_clinica?: string
          telefone_teste?: string | null
          pausa_ia_minutos?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      lembrete_configuracoes: {
        Row: {
          id: number
          nome: string
          ativo: boolean
          dias_antecedencia: number
          horario_envio: string
          timezone: string
          mensagem_template: string
          created_at: string
          updated_at: string
          exemplos: string[]
          usar_ia: boolean
          modelo_ia: string
          instrucoes_ia: string | null
          servico_ids: number[]
          intervalo_min_segundos: number
          intervalo_max_segundos: number
          janela_envio_horas: number
          somente_confirmados: boolean
          categoria: string
          botoes_confirmacao: boolean
          pausa_ia_minutos: number
        }
        Insert: {
          id?: number
          nome: string
          ativo?: boolean
          dias_antecedencia?: number
          horario_envio?: string
          timezone?: string
          mensagem_template?: string
          created_at?: string
          updated_at?: string
          exemplos?: string[]
          usar_ia?: boolean
          modelo_ia?: string
          instrucoes_ia?: string | null
          servico_ids?: number[]
          intervalo_min_segundos?: number
          intervalo_max_segundos?: number
          janela_envio_horas?: number
          somente_confirmados?: boolean
          categoria?: string
          botoes_confirmacao?: boolean
          pausa_ia_minutos?: number
        }
        Update: {
          id?: number
          nome?: string
          ativo?: boolean
          dias_antecedencia?: number
          horario_envio?: string
          timezone?: string
          mensagem_template?: string
          created_at?: string
          updated_at?: string
          exemplos?: string[]
          usar_ia?: boolean
          modelo_ia?: string
          instrucoes_ia?: string | null
          servico_ids?: number[]
          intervalo_min_segundos?: number
          intervalo_max_segundos?: number
          janela_envio_horas?: number
          somente_confirmados?: boolean
          categoria?: string
          botoes_confirmacao?: boolean
          pausa_ia_minutos?: number
        }
        Relationships: []
      }
      lembrete_envios: {
        Row: {
          id: number
          configuracao_id: number | null
          configuracao_nome: string
          agendamento_chave: string
          data_agendada: string
          horario_agendado: string | null
          servico: string | null
          nome_tutor: string
          nome_pet: string | null
          telefone: string
          programado_para: string
          status: string
          tentativas: number
          provider_message_id: string | null
          erro: string | null
          enviado_em: string | null
          descricao: string | null
          email: string | null
          porte: string | null
          preco: number | null
          status_agendamento: string | null
          created_at: string
          updated_at: string
          servico_id: number | null
          mensagem_id: number | null
          servico_texto: string | null
          origem: string
          created_by: string | null
          telefone_chave: string | null
        }
        Insert: {
          id?: number
          configuracao_id?: number | null
          configuracao_nome?: string
          agendamento_chave: string
          data_agendada: string
          horario_agendado?: string | null
          servico?: string | null
          nome_tutor: string
          nome_pet?: string | null
          telefone: string
          programado_para?: string
          status?: string
          tentativas?: number
          provider_message_id?: string | null
          erro?: string | null
          enviado_em?: string | null
          descricao?: string | null
          email?: string | null
          porte?: string | null
          preco?: number | null
          status_agendamento?: string | null
          created_at?: string
          updated_at?: string
          servico_id?: number | null
          mensagem_id?: number | null
          servico_texto?: string | null
          origem?: string
          created_by?: string | null
        }
        Update: {
          id?: number
          configuracao_id?: number | null
          configuracao_nome?: string
          agendamento_chave?: string
          data_agendada?: string
          horario_agendado?: string | null
          servico?: string | null
          nome_tutor?: string
          nome_pet?: string | null
          telefone?: string
          programado_para?: string
          status?: string
          tentativas?: number
          provider_message_id?: string | null
          erro?: string | null
          enviado_em?: string | null
          descricao?: string | null
          email?: string | null
          porte?: string | null
          preco?: number | null
          status_agendamento?: string | null
          created_at?: string
          updated_at?: string
          servico_id?: number | null
          mensagem_id?: number | null
          servico_texto?: string | null
          origem?: string
          created_by?: string | null
        }
        Relationships: []
      }
      lembrete_eventos: {
        Row: {
          id: number
          mensagem_id: number | null
          tipo: string
          descricao: string
          dados: Json | null
          created_at: string
        }
        Insert: {
          id?: number
          mensagem_id?: number | null
          tipo: string
          descricao: string
          dados?: Json | null
          created_at?: string
        }
        Update: {
          id?: number
          mensagem_id?: number | null
          tipo?: string
          descricao?: string
          dados?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      lembrete_mensagens: {
        Row: {
          id: number
          configuracao_id: number | null
          configuracao_nome: string
          disparo: string
          dia_envio: string
          telefone: string
          telefone_chave: string
          nome_tutor: string
          nomes_pets: string[]
          servicos: string[]
          data_agendada: string
          horario_agendado: string | null
          programado_para: string
          status: string
          tentativas: number
          texto: string | null
          origem_texto: string | null
          exemplo_indice: number | null
          modelo_ia: string | null
          provider_message_id: string | null
          erro: string | null
          processando_desde: string | null
          enviado_em: string | null
          categoria: string | null
          botoes_confirmacao: boolean
          pausa_ia_minutos: number | null
          created_by: string | null
          created_at: string
          updated_at: string
          servicos_texto: string[]
        }
        Insert: {
          id?: number
          configuracao_id?: number | null
          configuracao_nome?: string
          disparo?: string
          dia_envio: string
          telefone: string
          telefone_chave: string
          nome_tutor: string
          nomes_pets?: string[]
          servicos?: string[]
          data_agendada: string
          horario_agendado?: string | null
          programado_para: string
          status?: string
          tentativas?: number
          texto?: string | null
          origem_texto?: string | null
          exemplo_indice?: number | null
          modelo_ia?: string | null
          provider_message_id?: string | null
          erro?: string | null
          processando_desde?: string | null
          enviado_em?: string | null
          categoria?: string | null
          botoes_confirmacao?: boolean
          pausa_ia_minutos?: number | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          servicos_texto?: string[]
        }
        Update: {
          id?: number
          configuracao_id?: number | null
          configuracao_nome?: string
          disparo?: string
          dia_envio?: string
          telefone?: string
          telefone_chave?: string
          nome_tutor?: string
          nomes_pets?: string[]
          servicos?: string[]
          data_agendada?: string
          horario_agendado?: string | null
          programado_para?: string
          status?: string
          tentativas?: number
          texto?: string | null
          origem_texto?: string | null
          exemplo_indice?: number | null
          modelo_ia?: string | null
          provider_message_id?: string | null
          erro?: string | null
          processando_desde?: string | null
          enviado_em?: string | null
          categoria?: string | null
          botoes_confirmacao?: boolean
          pausa_ia_minutos?: number | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          servicos_texto?: string[]
        }
        Relationships: []
      }
      lembrete_servicos: {
        Row: {
          id: number
          nome: string
          nome_normalizado: string | null
          cor: string
          ativo: boolean
          ordem: number
          created_at: string
          updated_at: string
          texto_mensagem: string | null
        }
        Insert: {
          id?: number
          nome: string
          cor?: string
          ativo?: boolean
          ordem?: number
          created_at?: string
          updated_at?: string
          texto_mensagem?: string | null
        }
        Update: {
          id?: number
          nome?: string
          cor?: string
          ativo?: boolean
          ordem?: number
          created_at?: string
          updated_at?: string
          texto_mensagem?: string | null
        }
        Relationships: []
      }
      mensagens_agendadas: {
        Row: {
          client_id: number | null
          created_at: string
          created_by: string | null
          enviado_em: string | null
          erro: string | null
          id: number
          mensagem: string
          nome_tutor: string
          programado_para: string
          provider_message_id: string | null
          remetente: string
          session_id: string
          status: string
          telefone: string
          tentativas: number
          timezone: string
          updated_at: string
        }
        Insert: {
          client_id?: number | null
          created_at?: string
          created_by?: string | null
          enviado_em?: string | null
          erro?: string | null
          id?: number
          mensagem: string
          nome_tutor: string
          programado_para: string
          provider_message_id?: string | null
          remetente?: string
          session_id: string
          status?: string
          telefone: string
          tentativas?: number
          timezone?: string
          updated_at?: string
        }
        Update: {
          client_id?: number | null
          created_at?: string
          created_by?: string | null
          enviado_em?: string | null
          erro?: string | null
          id?: number
          mensagem?: string
          nome_tutor?: string
          programado_para?: string
          provider_message_id?: string | null
          remetente?: string
          session_id?: string
          status?: string
          telefone?: string
          tentativas?: number
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      pesquisa_satisfacao_configuracoes: {
        Row: {
          ativo: boolean
          created_at: string
          google_form_id: string
          google_form_url: string
          google_token_entry_id: string
          id: number
          mensagem_template: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          google_form_id: string
          google_form_url: string
          google_token_entry_id: string
          id?: number
          mensagem_template: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          google_form_id?: string
          google_form_url?: string
          google_token_entry_id?: string
          id?: number
          mensagem_template?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      pesquisa_satisfacao_envios: {
        Row: {
          agendamento_chave: string | null
          cadastrado_em: string | null
          client_id: number | null
          configuracao_id: number
          configuracao_nome: string
          created_at: string
          data_agendada: string | null
          email: string | null
          enviado_em: string | null
          erro: string | null
          horario_agendado: string | null
          id: number
          link_pesquisa: string | null
          nome_pet: string | null
          nome_tutor: string
          provider_message_id: string | null
          servico: string | null
          status: string
          telefone: string
          telefone_normalizado: string
          tracking_token: string
          updated_at: string
        }
        Insert: {
          agendamento_chave?: string | null
          cadastrado_em?: string | null
          client_id?: number | null
          configuracao_id: number
          configuracao_nome: string
          created_at?: string
          data_agendada?: string | null
          email?: string | null
          enviado_em?: string | null
          erro?: string | null
          horario_agendado?: string | null
          id?: number
          link_pesquisa?: string | null
          nome_pet?: string | null
          nome_tutor: string
          provider_message_id?: string | null
          servico?: string | null
          status?: string
          telefone: string
          tracking_token?: string
          updated_at?: string
        }
        Update: {
          agendamento_chave?: string | null
          cadastrado_em?: string | null
          client_id?: number | null
          configuracao_id?: number
          configuracao_nome?: string
          created_at?: string
          data_agendada?: string | null
          email?: string | null
          enviado_em?: string | null
          erro?: string | null
          horario_agendado?: string | null
          id?: number
          link_pesquisa?: string | null
          nome_pet?: string | null
          nome_tutor?: string
          provider_message_id?: string | null
          servico?: string | null
          status?: string
          telefone?: string
          tracking_token?: string
          updated_at?: string
        }
        Relationships: []
      }
      pesquisa_satisfacao_respostas: {
        Row: {
          comentario: string | null
          configuracao_id: number
          created_at: string
          email: string | null
          envio_id: number
          google_response_id: string | null
          id: number
          nota: number | null
          nps: number | null
          respostas: Json
          submitted_at: string
          telefone: string | null
        }
        Insert: {
          comentario?: string | null
          configuracao_id: number
          created_at?: string
          email?: string | null
          envio_id: number
          google_response_id?: string | null
          id?: number
          nota?: number | null
          nps?: number | null
          respostas?: Json
          submitted_at: string
          telefone?: string | null
        }
        Update: {
          comentario?: string | null
          configuracao_id?: number
          created_at?: string
          email?: string | null
          envio_id?: number
          google_response_id?: string | null
          id?: number
          nota?: number | null
          nps?: number | null
          respostas?: Json
          submitted_at?: string
          telefone?: string | null
        }
        Relationships: []
      }
      notificacoes: {
        Row: {
          atendente_id: number | null
          atendimento_id: number | null
          created_at: string
          departamento_id: number | null
          descricao: string | null
          id: number
          lida: boolean
          session_id: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          atendente_id?: number | null
          atendimento_id?: number | null
          created_at?: string
          departamento_id?: number | null
          descricao?: string | null
          id?: number
          lida?: boolean
          session_id?: string | null
          tipo: string
          titulo: string
        }
        Update: {
          atendente_id?: number | null
          atendimento_id?: number | null
          created_at?: string
          departamento_id?: number | null
          descricao?: string | null
          id?: number
          lida?: boolean
          session_id?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: []
      }
      pendencia_tipos: {
        Row: {
          created_at: string
          id: number
          nome: string
        }
        Insert: {
          created_at?: string
          id?: number
          nome: string
        }
        Update: {
          created_at?: string
          id?: number
          nome?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          cor: string
          created_at: string
          id: number
          nome: string
        }
        Insert: {
          cor?: string
          created_at?: string
          id?: number
          nome: string
        }
        Update: {
          cor?: string
          created_at?: string
          id?: number
          nome?: string
        }
        Relationships: []
      }
      n8n_chat_histories: {
        Row: {
          data: string | null
          id: number
          message: Json
          session_id: string
        }
        Insert: {
          data?: string | null
          id?: number
          message: Json
          session_id: string
        }
        Update: {
          data?: string | null
          id?: number
          message?: Json
          session_id?: string
        }
        Relationships: []
      }
      // --- Adicionadas à mão (migrations 20260725*) ---------------------------
      // Este arquivo é gerado por `supabase gen types typescript`. As definições
      // abaixo foram escritas manualmente porque as migrations de perfis, status
      // e auditoria ainda não foram aplicadas no projeto. Depois de rodá-las,
      // regenere o arquivo e remova este bloco.
      profiles: {
        Row: {
          ativo: boolean
          atendente_id: number | null
          created_at: string
          email: string | null
          id: string
          nome: string | null
          papel: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          atendente_id?: number | null
          created_at?: string
          email?: string | null
          id: string
          nome?: string | null
          papel?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          atendente_id?: number | null
          created_at?: string
          email?: string | null
          id?: string
          nome?: string | null
          papel?: string
          updated_at?: string
        }
        Relationships: []
      }
      atendente_status: {
        Row: {
          alterado_em: string
          alterado_por: string | null
          atendente_id: number
          motivo: string | null
          previsao_retorno: string | null
          status: string
        }
        Insert: {
          alterado_em?: string
          alterado_por?: string | null
          atendente_id: number
          motivo?: string | null
          previsao_retorno?: string | null
          status?: string
        }
        Update: {
          alterado_em?: string
          alterado_por?: string | null
          atendente_id?: number
          motivo?: string | null
          previsao_retorno?: string | null
          status?: string
        }
        Relationships: []
      }
      atendente_status_historico: {
        Row: {
          alterado_por: string | null
          atendente_id: number
          encerrado_em: string | null
          id: number
          iniciado_em: string
          motivo: string | null
          status: string
          status_anterior: string | null
        }
        Insert: {
          alterado_por?: string | null
          atendente_id: number
          encerrado_em?: string | null
          id?: number
          iniciado_em?: string
          motivo?: string | null
          status: string
          status_anterior?: string | null
        }
        Update: {
          alterado_por?: string | null
          atendente_id?: number
          encerrado_em?: string | null
          id?: number
          iniciado_em?: string
          motivo?: string | null
          status?: string
          status_anterior?: string | null
        }
        Relationships: []
      }
      // Adicionada à mão junto com a migration 20260806100000 (ver bloco em Functions).
      atividade_diaria: {
        Row: {
          created_at: string
          data: string
          id: number
          primeira_atividade_em: string | null
          segundos_ativos: number
          ultima_atividade_em: string | null
          updated_at: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          data: string
          id?: number
          primeira_atividade_em?: string | null
          segundos_ativos?: number
          ultima_atividade_em?: string | null
          updated_at?: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          data?: string
          id?: number
          primeira_atividade_em?: string | null
          segundos_ativos?: number
          ultima_atividade_em?: string | null
          updated_at?: string
          usuario_id?: string
        }
        Relationships: []
      }
      // Adicionada à mão junto com a migration 20260814100000.
      conversas_status_eventos: {
        Row: {
          acao: string
          ator_atendente_id: number | null
          ator_nome: string | null
          ator_user_id: string | null
          created_at: string
          de_status: string | null
          id: number
          ocorrido_em: string
          session_id: string
        }
        Insert: {
          acao: string
          ator_atendente_id?: number | null
          ator_nome?: string | null
          ator_user_id?: string | null
          created_at?: string
          de_status?: string | null
          id?: number
          ocorrido_em?: string
          session_id: string
        }
        Update: {
          acao?: string
          ator_atendente_id?: number | null
          ator_nome?: string | null
          ator_user_id?: string | null
          created_at?: string
          de_status?: string | null
          id?: number
          ocorrido_em?: string
          session_id?: string
        }
        Relationships: []
      }
      conversa_midias: {
        Row: {
          arquivada_em: string | null
          created_at: string
          direcao: string
          enviada_por_nome: string | null
          enviada_por_user_id: string | null
          id: number
          legenda: string | null
          message_id: string
          mime_type: string | null
          nome_arquivo: string | null
          ocorrido_em: string
          session_id: string
          storage_path: string | null
          tamanho_bytes: number | null
          telefone: string | null
          tipo: string
          uazapi_url: string | null
        }
        Insert: {
          arquivada_em?: string | null
          created_at?: string
          direcao: string
          enviada_por_nome?: string | null
          enviada_por_user_id?: string | null
          id?: number
          legenda?: string | null
          message_id: string
          mime_type?: string | null
          nome_arquivo?: string | null
          ocorrido_em?: string
          session_id: string
          storage_path?: string | null
          tamanho_bytes?: number | null
          telefone?: string | null
          tipo: string
          uazapi_url?: string | null
        }
        Update: {
          arquivada_em?: string | null
          created_at?: string
          direcao?: string
          enviada_por_nome?: string | null
          enviada_por_user_id?: string | null
          id?: number
          legenda?: string | null
          message_id?: string
          mime_type?: string | null
          nome_arquivo?: string | null
          ocorrido_em?: string
          session_id?: string
          storage_path?: string | null
          tamanho_bytes?: number | null
          telefone?: string | null
          tipo?: string
          uazapi_url?: string | null
        }
        Relationships: []
      }
      auditoria_eventos: {
        Row: {
          acao: string
          alvo_atendente_id: number | null
          alvo_user_id: string | null
          atendimento_id: number | null
          ator_atendente_id: number | null
          ator_nome: string | null
          ator_user_id: string | null
          created_at: string
          dados: Json | null
          entidade: string
          entidade_id: string | null
          id: number
          session_id: string | null
        }
        Insert: {
          acao: string
          alvo_atendente_id?: number | null
          alvo_user_id?: string | null
          atendimento_id?: number | null
          ator_atendente_id?: number | null
          ator_nome?: string | null
          ator_user_id?: string | null
          created_at?: string
          dados?: Json | null
          entidade: string
          entidade_id?: string | null
          id?: number
          session_id?: string | null
        }
        Update: {
          acao?: string
          alvo_atendente_id?: number | null
          alvo_user_id?: string | null
          atendimento_id?: number | null
          ator_atendente_id?: number | null
          ator_nome?: string | null
          ator_user_id?: string | null
          created_at?: string
          dados?: Json | null
          entidade?: string
          entidade_id?: string | null
          id?: number
          session_id?: string | null
        }
        Relationships: []
      }
      // --- fim do bloco manual ----------------------------------------------
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      // Funções do módulo de lembretes (gerado por scripts/gerar-tipos.mjs).
      lembrete_exemplos_padrao: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      lembretes_cancelar_mensagem: {
        Args: { p_mensagem_id: number }
        Returns: undefined
      }
      lembretes_concluir_envio_manual: {
        Args: { p_mensagem_id: number; p_enviado: boolean; p_provider_message_id?: string; p_erro?: string }
        Returns: undefined
      }
      lembretes_diagnostico: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      lembretes_disparar_agora: {
        Args: { p_configuracao_id: number }
        Returns: number
      }
      lembretes_enviar_agendamento: {
        Args: { p_envio_id: number }
        Returns: number
      }
      lembretes_enviar_teste: {
        Args: { p_configuracao_id: number; p_telefone?: string }
        Returns: number
      }
      lembretes_planejar: {
        Args: { p_agora?: string; p_configuracao_id?: number; p_forcar?: boolean }
        Returns: number
      }
      lembretes_reenviar_mensagem: {
        Args: { p_mensagem_id: number }
        Returns: undefined
      }
      lembretes_reivindicar: {
        Args: { p_limite?: number; p_horizonte_segundos?: number }
        Returns: Database["public"]["Tables"]["lembrete_mensagens"]["Row"][]
      }
      lembretes_reservar_envio_manual: {
        Args: { p_mensagem_id: number; p_texto: string }
        Returns: undefined
      }
      lembretes_tick: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      // Adicionada à mão junto com as migrations 20260725* (ver bloco em Tables).
      definir_status_atendente: {
        Args: {
          p_atendente_id: number
          p_status: string
          p_motivo?: string | null
          p_previsao_retorno?: string | null
        }
        Returns: {
          alterado_em: string
          alterado_por: string | null
          atendente_id: number
          motivo: string | null
          previsao_retorno: string | null
          status: string
        }
      }
      // Adicionada à mão junto com a migration 20260806100000 (ver bloco em Tables).
      registrar_atividade: {
        Args: {
          p_segundos: number
        }
        Returns: undefined
      }
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      claim_mensagens_agendadas: {
        Args: { p_limit?: number }
        Returns: {
          client_id: number | null
          created_at: string
          created_by: string | null
          enviado_em: string | null
          erro: string | null
          id: number
          mensagem: string
          nome_tutor: string
          programado_para: string
          provider_message_id: string | null
          remetente: string
          session_id: string
          status: string
          telefone: string
          tentativas: number
          timezone: string
          updated_at: string
        }[]
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      match_documents: {
        Args: {
          query_embedding: string
          match_count?: number
          filter?: Json
          similarity_threshold?: number
        }
        Returns: {
          id: number
          content: string
          metadata: Json
          similarity: number
        }[]
      }
      listar_documentos_resumo: {
        Args: Record<PropertyKey, never>
        Returns: {
          titulo: string
          categoria: string
          origem: string
          drive_id: string | null
          total_partes: number
          total_caracteres: number
          criado_em: string | null
          atualizado_em: string | null
          primeiro_id: number
        }[]
      }
      obter_chunks_documento: {
        Args: { p_titulo: string }
        Returns: {
          id: number
          content: string
          metadata: Json
          created_at: string
        }[]
      }
      obter_estatisticas_rag: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      match_documents_natacao: {
        Args: { query_embedding: string; match_count?: number; filter?: Json }
        Returns: {
          id: number
          content: string
          metadata: Json
          similarity: number
        }[]
      }
      search_conversations: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_search?: string | null
        }
        Returns: {
          asaas_customer_id: string | null
          client_email: string | null
          client_id: number | null
          client_name: string | null
          client_phone: string | null
          cpf_cnpj: string | null
          latest_id: number
          message: Json
          message_date: string | null
          pet_breed: string | null
          pet_name: string | null
          pet_size: string | null
          service: string | null
          session_id: string
          total_count: number
        }[]
      }
      preparar_envio_pesquisa_satisfacao: {
        Args: {
          p_agendamento_chave?: string | null
          p_client_id?: number | null
          p_configuracao_id: number
          p_data_agendada?: string | null
          p_email?: string | null
          p_horario_agendado?: string | null
          p_nome_pet?: string | null
          p_nome_tutor: string
          p_servico?: string | null
          p_telefone: string
        }
        Returns: {
          deve_enviar: boolean
          envio_id: number
          link_pesquisa: string
          status: string
          tracking_token: string
        }[]
      }
      registrar_resposta_pesquisa_satisfacao: {
        Args: {
          p_comentario?: string | null
          p_email?: string | null
          p_form_id: string
          p_google_response_id: string
          p_nota?: number | null
          p_nps?: number | null
          p_respostas?: Json
          p_submitted_at: string
          p_telefone?: string | null
          p_tracking_token: string
        }
        Returns: {
          envio_id: number
          status: string
        }[]
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
