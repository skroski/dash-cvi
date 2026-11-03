import type { AtendimentoConfig } from '@/types/atendimentoConfig';

/**
 * Completa a configuração lida do banco com os padrões das colunas mais novas. Assim a tela abre
 * (e avisa o que falta) mesmo quando a migração 20261027 ainda não foi aplicada.
 */
export function normalizarConfig(bruta: Partial<AtendimentoConfig> | null | undefined): AtendimentoConfig | null {
  if (!bruta || !bruta.id) return null;
  return {
    id: bruta.id,
    nome_empresa: bruta.nome_empresa ?? '',
    nome_assistente: bruta.nome_assistente ?? '',
    telefone_contato: bruta.telefone_contato ?? null,
    codigo_pais: bruta.codigo_pais ?? '55',
    fuso_horario: bruta.fuso_horario ?? 'America/Sao_Paulo',
    modelo_ia: bruta.modelo_ia ?? null,
    padroes_loop_bot: Array.isArray(bruta.padroes_loop_bot) ? bruta.padroes_loop_bot : [],
    loop_bot_minimo_respostas: bruta.loop_bot_minimo_respostas ?? 3,
    loop_bot_pausa_dias: bruta.loop_bot_pausa_dias ?? 30,
    endereco: bruta.endereco ?? null,
    site: bruta.site ?? null,
    instagram: bruta.instagram ?? null,
    email_contato: bruta.email_contato ?? null,
    chave_pix: bruta.chave_pix ?? null,
    planos_aceitos: Array.isArray(bruta.planos_aceitos) ? bruta.planos_aceitos : [],
    frase_encerramento: bruta.frase_encerramento ?? null,
    estilo_comunicacao: bruta.estilo_comunicacao ?? 'Cordial e objetivo',
    horario_funcionamento: Array.isArray(bruta.horario_funcionamento) ? bruta.horario_funcionamento : [],
    saudacao_bom_dia_inicio: bruta.saudacao_bom_dia_inicio ?? '07:00',
    saudacao_boa_tarde_inicio: bruta.saudacao_boa_tarde_inicio ?? '12:00',
    saudacao_boa_noite_inicio: bruta.saudacao_boa_noite_inicio ?? '18:00',
    aviso_fora_horario_inicio: bruta.aviso_fora_horario_inicio ?? null,
    aviso_fora_horario_fim: bruta.aviso_fora_horario_fim ?? null,
    aviso_fora_horario_texto: bruta.aviso_fora_horario_texto ?? null,
    pausa_entre_mensagens_ms: bruta.pausa_entre_mensagens_ms ?? 1200,
    max_caracteres_mensagem: bruta.max_caracteres_mensagem ?? 700,
  };
}
