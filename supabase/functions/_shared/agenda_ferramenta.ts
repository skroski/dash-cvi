/**
 * Validação e preparo das chamadas da ferramenta func_agenda feitas pelo modelo.
 * Puro: devolve o corpo que a Edge `agenda` espera ou um resultado de erro para o modelo.
 */
import {
  FUNCOES_AGENDA, camposFaltando, operacaoPermitida, parametrosEfetivos, resolverRegra, resolverTipo,
  tipoDisponivelParaAssistente, type RegraAgenda, type TipoAgenda,
} from './agenda_catalogo.ts';
import { emailValido, interpretarDataHora, MENSAGENS_AGENDA, nomesDePets } from './agenda_agendamento.ts';

export type EventoNotificacaoAgenda = 'agendamento_criado' | 'agendamento_reagendado' | 'agendamento_cancelado';

export interface CadastroCliente {
  nome?: string | null;
  email?: string | null;
  nome_pet?: string | null;
  raca_pet?: string | null;
  porte_pet?: string | null;
}

export interface ContextoFerramenta {
  catalogo: TipoAgenda[];
  sessionId: string;
  fuso: string;
  cadastro: CadastroCliente;
}

export type PreparoAgenda =
  | { ok: false; resultado: Record<string, unknown> }
  | {
    ok: true;
    body: Record<string, unknown>;
    tipo?: TipoAgenda;
    regra?: RegraAgenda;
    evento?: EventoNotificacaoAgenda;
    inicio?: string;
  };

const texto = (valor: unknown, limite = 200) => (typeof valor === 'string' ? valor.replace(/[\r\n]+/g, ' ').trim().slice(0, limite) : '');
const falha = (erro: string, extra: Record<string, unknown> = {}): PreparoAgenda => ({ ok: false, resultado: { ok: false, erro, ...extra } });

export function prepararChamadaAgenda(input: Record<string, unknown>, ctx: ContextoFerramenta): PreparoAgenda {
  const funcao = texto(input.Funcao ?? input.funcao ?? input.action, 20).toLowerCase();
  if (!(FUNCOES_AGENDA as readonly string[]).includes(funcao)) {
    return falha('funcao_invalida', { funcoes_validas: FUNCOES_AGENDA });
  }
  const telefone = ctx.sessionId.split('@')[0].replace(/\D/g, '');
  const contexto = {
    sessionId: ctx.sessionId,
    telefone,
    nomeCliente: texto(input.nome_cliente, 120) || ctx.cadastro.nome || '',
    nomePet: texto(input.nome_pet, 200) || ctx.cadastro.nome_pet || '',
    email: texto(input.email, 254) || ctx.cadastro.email || '',
    observacao: texto(input.observacao, 400),
  };

  if (funcao === 'listar') return { ok: true, body: { acao: 'cliente', contexto } };

  const usaveis = ctx.catalogo.filter(tipoDisponivelParaAssistente);
  const bruto = input.servico ?? input.especialidade;
  const tipo = resolverTipo(bruto, usaveis);
  if (!tipo) {
    const existeMasNaoAgenda = resolverTipo(bruto, ctx.catalogo);
    return existeMasNaoAgenda
      ? falha('servico_somente_recepcao', {
        mensagem: 'Este serviço não é agendado pelo assistente. Explique ao cliente e ofereça encaminhar para a recepção.',
      })
      : falha('servico_desconhecido', { servicos_validos: usaveis.map((t) => t.chave) });
  }

  const profissionalPedido = texto(input.profissional, 120);
  let regra: RegraAgenda | undefined = tipo.regras.length === 1 ? tipo.regras[0] : undefined;
  if (profissionalPedido) {
    regra = resolverRegra(tipo, profissionalPedido);
    if (!regra) {
      return falha('profissional_desconhecido', { profissionais_validos: tipo.regras.map((r) => r.nome_exibicao || r.profissional_nome) });
    }
  }
  if (!operacaoPermitida(tipo, regra, funcao === 'buscar' ? 'buscar' : funcao)) {
    return falha('operacao_nao_permitida', {
      mensagem: 'Esta operação não é feita pelo assistente neste serviço. Ofereça encaminhar para a recepção.',
    });
  }

  const comum = { agendaType: tipo.chave, regraId: regra?.id, retorno: input.retorno === true, duracaoMinutos: Number(input.duracao_minutos) > 0 ? Number(input.duracao_minutos) : undefined, contexto };
  const inicioBruto = texto(input.date_start ?? input.data_inicio, 80);

  if (funcao === 'buscar') {
    if (inicioBruto && !interpretarDataHora(inicioBruto, ctx.fuso)) return falha('data_invalida', { mensagem: 'Use AAAA-MM-DD ou AAAA-MM-DDTHH:mm:ss.' });
    return { ok: true, body: { acao: 'disponibilidade', ...comum, dataHora: inicioBruto || undefined }, tipo, regra };
  }

  // Ações que alteram a agenda exigem e-mail válido quando o tipo o pede (convite do evento).
  const exigencias = camposFaltando(tipo, {
    email: contexto.email,
    nome_cliente: contexto.nomeCliente,
    nome_pet: contexto.nomePet,
    raca_pet: ctx.cadastro.raca_pet,
    porte_pet: ctx.cadastro.porte_pet,
    titulo: 'ok',
    descricao: 'ok',
  });
  if (funcao === 'agendar' && exigencias.length) {
    return falha('campos_obrigatorios', { faltando: exigencias, mensagem: 'Pergunte ao cliente os dados que faltam (um por vez) e grave-os com grava_info antes de agendar.' });
  }
  if (tipo.campos_obrigatorios.includes('email') && !emailValido(contexto.email)) {
    return falha('email_invalido', { mensagem: MENSAGENS_AGENDA.emailInvalido });
  }

  if (funcao === 'agendar') {
    const inicio = interpretarDataHora(inicioBruto, ctx.fuso);
    if (!inicio || inicio.instanteMs == null) return falha('data_hora_obrigatoria', { mensagem: 'Informe date_start com data e hora do horário escolhido, exatamente como veio na busca.' });
    const parametros = parametrosEfetivos(tipo, regra);
    if (nomesDePets(contexto.nomePet).length > parametros.maxPets) {
      return falha('pets_demais', { mensagem: `Este serviço aceita até ${parametros.maxPets} pet(s) por agendamento; faça agendamentos separados para os demais.` });
    }
    return { ok: true, body: { acao: 'criar', ...comum, inicio: inicioBruto }, tipo, regra, evento: 'agendamento_criado', inicio: inicioBruto };
  }

  const antigaBruta = texto(input.data_antiga, 80) || (funcao === 'cancelar' ? inicioBruto : '');
  if (!antigaBruta) return falha('data_antiga_obrigatoria', { mensagem: 'Pergunte ao cliente a data e a hora do agendamento atual.' });
  if (!interpretarDataHora(antigaBruta, ctx.fuso)?.instanteMs) return falha('data_antiga_invalida', { mensagem: 'Informe data_antiga com data e hora (AAAA-MM-DDTHH:mm:ss).' });

  if (funcao === 'cancelar') {
    return { ok: true, body: { acao: 'excluir', ...comum, regraId: undefined, dataAntiga: antigaBruta }, tipo, regra, evento: 'agendamento_cancelado', inicio: antigaBruta };
  }
  // reagendar
  if (!inicioBruto || !interpretarDataHora(inicioBruto, ctx.fuso)?.instanteMs) {
    return falha('data_hora_obrigatoria', { mensagem: 'Informe date_start com a nova data e hora.' });
  }
  return { ok: true, body: { acao: 'editar', ...comum, regraId: undefined, inicio: inicioBruto, dataAntiga: antigaBruta }, tipo, regra, evento: 'agendamento_reagendado', inicio: inicioBruto };
}
