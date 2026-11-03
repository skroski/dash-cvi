-- ============================================================================
-- CORREÇÃO DE PERMISSÕES E SCHEMA CACHE DO POSTGREST
-- ============================================================================
-- Corrige os erros 404 (PGRST205: Could not find table in schema cache) e 400
-- restaurando os GRANTS para os papéis anon e authenticated nas tabelas e
-- funções dos módulos de Receituário, Prontuário IA, Fila Presencial e Configuração,
-- definindo políticas RLS adequadas para leitura pública/equipe e notificando
-- o PostgREST para recarregar o schema cache imediatamente.
-- ============================================================================

-- 1. Permissões de tabela (GRANT)
-- Permite que anon e authenticated sejam reconhecidos no OpenAPI/PostgREST
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receituario_bulario TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receituario_protocolos TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receituario_pacientes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receituario_prescricoes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receituario_auditoria_ia TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pets TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prontuario_ia_config TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prontuario_ia_drafts TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prontuario_consentimentos TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prontuarios TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.atendimento_config TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fila_config TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fila_itens TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fila_veterinarios TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fila_salas TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fila_servicos TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fila_midias TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fila_chamadas TO anon, authenticated;

-- Permissões em sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- 2. Permissões de execução de funções (RPC)
GRANT EXECUTE ON FUNCTION public.importar_bulario_em_lote(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validar_receita_publica(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.receituario_sou_equipe() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.perfil_papel() TO anon, authenticated;

-- 3. Políticas RLS (Row Level Security)
-- Garante que dados cadastrais públicos / de configuração possam ser lidos sem erro de permissão

-- atendimento_config (nome da empresa exibido no cabeçalho/login/receituário)
ALTER TABLE public.atendimento_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS atendimento_config_leitura ON public.atendimento_config;
CREATE POLICY atendimento_config_leitura ON public.atendimento_config
  FOR SELECT TO anon, authenticated USING (true);

-- fila_config (nome de exibição, logo, layout para TV/Totem/Receituário)
ALTER TABLE public.fila_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fila_config leitura publica" ON public.fila_config;
CREATE POLICY "fila_config leitura publica" ON public.fila_config
  FOR SELECT TO anon, authenticated USING (true);

-- receituario_bulario (fármacos ativos são leitura pública e segura para consulta)
ALTER TABLE public.receituario_bulario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS receituario_bulario_leitura_ativa ON public.receituario_bulario;
CREATE POLICY receituario_bulario_leitura_ativa ON public.receituario_bulario
  FOR SELECT TO anon, authenticated USING (ativo = true);

-- receituario_protocolos (protocolos clínicos ativos)
ALTER TABLE public.receituario_protocolos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS receituario_protocolos_leitura_ativa ON public.receituario_protocolos;
CREATE POLICY receituario_protocolos_leitura_ativa ON public.receituario_protocolos
  FOR SELECT TO anon, authenticated USING (ativo = true);

-- fila_veterinarios (veterinários ativos para seleção de chamador e receituário)
ALTER TABLE public.fila_veterinarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fila_veterinarios_leitura_publica" ON public.fila_veterinarios;
CREATE POLICY "fila_veterinarios_leitura_publica" ON public.fila_veterinarios
  FOR SELECT TO anon, authenticated USING (ativo = true);

-- fila_salas & fila_servicos (salas e serviços ativos)
ALTER TABLE public.fila_salas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fila_salas_leitura_publica" ON public.fila_salas;
CREATE POLICY "fila_salas_leitura_publica" ON public.fila_salas
  FOR SELECT TO anon, authenticated USING (ativa = true);

ALTER TABLE public.fila_servicos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fila_servicos_leitura_publica" ON public.fila_servicos;
CREATE POLICY "fila_servicos_leitura_publica" ON public.fila_servicos
  FOR SELECT TO anon, authenticated USING (ativo = true);

-- prontuario_ia_config (configuração singleton id=1)
ALTER TABLE public.prontuario_ia_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prontuario_ia_config_leitura_publica" ON public.prontuario_ia_config;
CREATE POLICY "prontuario_ia_config_leitura_publica" ON public.prontuario_ia_config
  FOR SELECT TO anon, authenticated USING (id = 1);

-- 4. Notifica o PostgREST para recarregar o schema cache imediatamente
NOTIFY pgrst, 'reload schema';
