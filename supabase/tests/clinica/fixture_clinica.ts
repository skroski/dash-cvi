// Dados de uma clínica fictícia para os testes das Edge Functions (formato das linhas do banco).
import { criarBackend, type Backend } from './fake_backend.ts';

// Domingo 25/10/2026 12:00 em Brasília.
export const AGORA = '2026-10-25T15:00:00Z';
export const SESSAO = '5541999990001@s.whatsapp.net';
export const TITULO = '{{servico}} para: {{pet_nome}} | Tutor: {{cliente_nome}} | Telefone: {{cliente_telefone}}';

export function dadosClinica(): Backend {
  const dias = (lista: number[], inicio: string, fim: string, regra: string) =>
    lista.map((dia) => ({ regra_id: regra, dia_semana: dia, inicio: `${inicio}:00`, fim: `${fim}:00`, ultimo_inicio: null, recorrencia: 'semanal', ancora_quinzenal: null }));
  return criarBackend({
    tabelas: {
      atendimento_config: [{ id: 'cfg', singleton: true, nome_empresa: 'Clínica Teste', fuso_horario: 'America/Sao_Paulo', codigo_pais: '55' }],
      agenda_calendarios: [
        { id: 'cal1', nome: 'Clínica Geral', secret_key: 'GOOGLE_CALENDAR_X', ativo: true, google_id: 'cal-geral@group' },
        { id: 'cal2', nome: 'Onco', secret_key: 'GOOGLE_CALENDAR_Y', ativo: true, google_id: 'cal-onco@group' },
      ],
      agenda_profissionais: [
        { id: 'p1', nome: 'Clínica Geral', ativo: true, email: null, convidar_por_email: false, unidade: null },
        { id: 'p2', nome: 'Dra. Carol', ativo: true, email: 'carol@clinica.com', convidar_por_email: true, unidade: null },
      ],
      agenda_especialidades: [
        {
          id: 't1', chave: 'consultaveterinaria', nome: 'Consulta de Clínica Geral', ativo: true, aliases: [], duracao_padrao_minutos: 60, duracao_retorno_minutos: 30,
          intervalo_slots_minutos: 30, operacoes_permitidas: ['buscar', 'agendar', 'reagendar', 'cancelar'], campos_obrigatorios: ['email'],
          antecedencia_minima_minutos: 0, busca_horizonte_dias: 20, busca_max_dias_com_vaga: 10, busca_max_horarios_por_dia: 30,
          busca_apresentar_max_datas: 2, busca_apresentar_max_horarios: 4, busca_ordem: 'proximos', max_pets_por_agendamento: 2, capacidade_simultanea: 1,
          titulo_evento_modelo: TITULO, descricao_evento_modelo: 'Atendimento agendado.', local_evento: 'Unidade Centro', enviar_convite_cliente: true,
          mensagem_agendamento_equipe: 'Feito pela equipe.', tag_id: 7,
        },
        {
          id: 't2', chave: 'oncologia', nome: 'Oncologia', ativo: true, aliases: [], duracao_padrao_minutos: 60, duracao_retorno_minutos: 30, intervalo_slots_minutos: 30,
          operacoes_permitidas: [], campos_obrigatorios: [], antecedencia_minima_minutos: 0, busca_horizonte_dias: 20, busca_max_dias_com_vaga: 10,
          busca_max_horarios_por_dia: 30, busca_apresentar_max_datas: 2, busca_apresentar_max_horarios: 4, busca_ordem: 'proximos', max_pets_por_agendamento: 1,
          capacidade_simultanea: 1, enviar_convite_cliente: true,
        },
      ],
      agenda_regras: [
        { id: '11111111-1111-4111-8111-111111111111', profissional_id: 'p1', especialidade_id: 't1', calendario_id: 'cal1', ativo: true },
        { id: '22222222-2222-4222-8222-222222222222', profissional_id: 'p2', especialidade_id: 't2', calendario_id: 'cal2', ativo: true },
      ],
      agenda_janelas_semanais: [
        ...dias([1, 2, 3, 4], '09:00', '18:00', '11111111-1111-4111-8111-111111111111'),
        ...dias([5], '08:00', '18:00', '11111111-1111-4111-8111-111111111111'),
        ...dias([6], '08:00', '16:00', '11111111-1111-4111-8111-111111111111'),
        ...dias([1, 2, 3, 4], '09:00', '18:00', '22222222-2222-4222-8222-222222222222'),
      ],
      agenda_intervalos: [1, 2, 3, 4, 5, 6].map((dia) => ({ regra_id: '11111111-1111-4111-8111-111111111111', tipo: 'almoco', dia_semana: dia, data_especifica: null, inicio: '13:00:00', fim: '14:00:00', ativo: true })),
      agenda_feriados: [],
      clinica_servicos: [{ id: 's1', tipo_agenda_id: 't1', preco: 120, ativo: true }],
      dados_cliente: [{ id: 1, sessionid: SESSAO, nome: 'Maria', email: 'maria@email.com', nome_pet: 'Thor', telefone: SESSAO }],
      client_tags: [],
      agenda_agendamentos: [],
    },
    calendarios: { 'cal-geral@group': [], 'cal-onco@group': [] },
  });
}

