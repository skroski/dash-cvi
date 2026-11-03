/**
 * Configuração do atendimento carregada do banco (empresa, estados, agendas, serviços, destinatários).
 * Usada pelo worker e pela pré-visualização do prompt no painel.
 */
import {
  montarCatalogo, parametrosEfetivos, type TipoAgenda,
} from './agenda_catalogo.ts';
import { textoHorariosTipo, type IntervaloTexto, type JanelaTexto, type RegraTexto } from './horarios_texto.ts';
import type { EstadoAtendimento } from './estados.ts';
import type { Destinatario } from './notificacoes.ts';
import type { ConfigEmpresa, ServicoCatalogo } from './prompt_variaveis.ts';
import { fusoValido } from './fuso.ts';

// deno-lint-ignore no-explicit-any
type Cliente = { from: (tabela: string) => any };

export type ConfigAtendimento = {
  empresa: ConfigEmpresa;
  fuso: string;
  modeloIa: string | null;
  padroesLoopBot: string[];
  loopBotMinimo: number;
  loopBotPausaDias: number;
  maxCaracteresMensagem: number;
  estados: EstadoAtendimento[];
  catalogo: TipoAgenda[];
  destinatarios: Destinatario[];
  servicos: ServicoCatalogo[];
  horariosPorTipo: Record<string, string>;
  tiposAtivos: Array<{ chave: string; nome: string }>;
  nomeEmpresa: string;
};

/** Variáveis simples usadas em textos configuráveis (estados, avisos). */
export function variaveisDaEmpresa(cfg: ConfigAtendimento): Record<string, string> {
  return {
    nome_empresa: cfg.empresa.nome_empresa || '',
    nome_assistente: cfg.empresa.nome_assistente || '',
    telefone_contato: cfg.empresa.telefone_contato || '',
    frase_encerramento: cfg.empresa.frase_encerramento || '',
  };
}

export function horariosPorTipo(
  tipos: TipoAgenda[],
  janelas: Array<Record<string, unknown>>,
  intervalos: Array<Record<string, unknown>>,
): Record<string, string> {
  const resultado: Record<string, string> = {};
  for (const tipo of tipos) {
    const regras: RegraTexto[] = tipo.regras.map((regra) => ({
      profissional: regra.profissional_nome,
      nome_exibicao: regra.nome_exibicao,
      duracao: parametrosEfetivos(tipo, regra).duracao,
      janelas: janelas.filter((j) => j.regra_id === regra.id) as unknown as JanelaTexto[],
      intervalos: intervalos.filter((i) => i.regra_id === regra.id) as unknown as IntervaloTexto[],
    }));
    resultado[tipo.chave] = textoHorariosTipo(regras);
  }
  return resultado;
}

// Cada leitura tolera tabela ausente (migração ainda não aplicada): o worker
// cai nos padrões anteriores em vez de parar o atendimento.
export async function carregarConfig(admin: Cliente): Promise<ConfigAtendimento> {
  const [cfg, estados, tipos, regras, profissionais, destinatarios, servicos, janelas, intervalos] = await Promise.all([
    admin.from('atendimento_config').select('*').eq('singleton', true).maybeSingle(),
    admin.from('atendimento_estados').select('*').eq('ativo', true).order('ordem'),
    admin.from('agenda_especialidades').select('*').eq('ativo', true).order('nome'),
    admin.from('agenda_regras').select('*').eq('ativo', true),
    admin.from('agenda_profissionais').select('*').eq('ativo', true),
    admin.from('notificacao_destinatarios').select('*').eq('ativo', true),
    admin.from('clinica_servicos').select('*').eq('ativo', true).order('ordem'),
    admin.from('agenda_janelas_semanais').select('regra_id,dia_semana,inicio,fim,ultimo_inicio,recorrencia'),
    admin.from('agenda_intervalos').select('regra_id,dia_semana,data_especifica,inicio,fim,tipo,ativo'),
  ]);
  const c = (cfg.data || {}) as Record<string, unknown>;
  const catalogo = montarCatalogo(tipos.data || [], regras.data || [], profissionais.data || [], servicos.data || []);
  const fuso = fusoValido(c.fuso_horario as string) ? String(c.fuso_horario) : 'America/Sao_Paulo';
  const empresa: ConfigEmpresa = {
    nome_empresa: String(c.nome_empresa || ''),
    nome_assistente: String(c.nome_assistente || ''),
    telefone_contato: (c.telefone_contato as string | null) ?? null,
    codigo_pais: String(c.codigo_pais || '55'),
    fuso_horario: fuso,
    endereco: (c.endereco as string | null) ?? null,
    site: (c.site as string | null) ?? null,
    instagram: (c.instagram as string | null) ?? null,
    email_contato: (c.email_contato as string | null) ?? null,
    chave_pix: (c.chave_pix as string | null) ?? null,
    planos_aceitos: Array.isArray(c.planos_aceitos) ? (c.planos_aceitos as string[]) : [],
    frase_encerramento: (c.frase_encerramento as string | null) ?? null,
    estilo_comunicacao: (c.estilo_comunicacao as string | null) ?? null,
    horario_funcionamento: Array.isArray(c.horario_funcionamento) ? (c.horario_funcionamento as ConfigEmpresa['horario_funcionamento']) : [],
    saudacao_bom_dia_inicio: (c.saudacao_bom_dia_inicio as string | null) ?? null,
    saudacao_boa_tarde_inicio: (c.saudacao_boa_tarde_inicio as string | null) ?? null,
    saudacao_boa_noite_inicio: (c.saudacao_boa_noite_inicio as string | null) ?? null,
    aviso_fora_horario_inicio: (c.aviso_fora_horario_inicio as string | null) ?? null,
    aviso_fora_horario_fim: (c.aviso_fora_horario_fim as string | null) ?? null,
    aviso_fora_horario_texto: (c.aviso_fora_horario_texto as string | null) ?? null,
  };
  return {
    empresa,
    fuso,
    modeloIa: (c.modelo_ia as string | null) || null,
    padroesLoopBot: Array.isArray(c.padroes_loop_bot) ? (c.padroes_loop_bot as string[]) : [
      '\\btim\\b', '\\bprotocolo\\b', '\\bop[cç][aã]o inv[aá]lida\\b', '\\bcomando inv[aá]lido\\b', '\\bdigite \\d\\b', '\\bresponda \\d\\b',
    ],
    loopBotMinimo: Number(c.loop_bot_minimo_respostas) || 3,
    loopBotPausaDias: Number(c.loop_bot_pausa_dias) || 30,
    maxCaracteresMensagem: Number(c.max_caracteres_mensagem) || 700,
    estados: (estados.data || []) as EstadoAtendimento[],
    catalogo,
    destinatarios: (destinatarios.data || []) as Destinatario[],
    servicos: (servicos.data || []) as ServicoCatalogo[],
    horariosPorTipo: horariosPorTipo(catalogo, janelas.data || [], intervalos.data || []),
    tiposAtivos: catalogo.map((tipo) => ({ chave: tipo.chave, nome: tipo.nome })),
    nomeEmpresa: empresa.nome_empresa,
  };
}

