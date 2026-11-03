/** Itens do checklist de implantação de uma nova empresa (puro, sem tela). */
import type { TipoAgendaResumo } from '@/hooks/useAtendimentoConfig';
import type { AtendimentoConfig, ClinicaServico, NotificacaoDestinatario } from '@/types/atendimentoConfig';

export type Situacao = 'ok' | 'pendente' | 'atencao';
export type ItemChecklist = { chave: string; titulo: string; situacao: Situacao; detalhe: string; destino?: { aba?: string; rota?: string; rotulo: string } };

export function calcularChecklist(entrada: {
  config: AtendimentoConfig;
  servicos: ClinicaServico[];
  destinatarios: NotificacaoDestinatario[];
  tipos: TipoAgendaResumo[];
  regras: Array<{ id: string; ativo: boolean; calendario_id: string | null; profissional?: { nome: string }; especialidade?: { nome: string } }>;
  janelas: Array<{ regra_id: string }>;
  openaiConfigurada: boolean | null;
  versoesPrompt: number | null;
}): ItemChecklist[] {
  const { config } = entrada;
  const faltam = [
    config.nome_empresa.trim() === '' || config.nome_empresa === 'Minha empresa' ? 'nome da empresa' : '',
    config.nome_assistente.trim() === '' || config.nome_assistente === 'Assistente' ? 'nome do assistente' : '',
    !config.telefone_contato ? 'telefone' : '',
    !config.endereco ? 'endereço' : '',
  ].filter(Boolean);
  const ativos = entrada.servicos.filter((s) => s.ativo);
  const regrasAtivas = entrada.regras.filter((r) => r.ativo);
  const semJornada = regrasAtivas.filter((r) => !entrada.janelas.some((j) => j.regra_id === r.id));
  const semCalendario = regrasAtivas.filter((r) => !r.calendario_id);
  const nomeAgenda = (r: (typeof entrada.regras)[number]) => `${r.profissional?.nome ?? 'Profissional'} · ${r.especialidade?.nome ?? 'Tipo'}`;

  return [
    {
      chave: 'empresa', titulo: 'Dados da empresa e do assistente',
      situacao: faltam.length ? 'pendente' : 'ok',
      detalhe: faltam.length ? `Falta preencher: ${faltam.join(', ')}.` : 'Nome, assistente, telefone e endereço preenchidos.',
      destino: { aba: 'empresa', rotulo: 'Abrir Empresa' },
    },
    {
      chave: 'horario', titulo: 'Horário de funcionamento',
      situacao: config.horario_funcionamento.length ? 'ok' : 'pendente',
      detalhe: config.horario_funcionamento.length ? 'Faixas cadastradas.' : 'Sem horário, o assistente não sabe informar quando a empresa atende.',
      destino: { aba: 'empresa', rotulo: 'Abrir Empresa' },
    },
    {
      chave: 'encerramento', titulo: 'Frase de encerramento',
      situacao: config.frase_encerramento ? 'ok' : 'atencao',
      detalhe: config.frase_encerramento ? 'Define também quando a conversa vira “Finalizado”.' : 'Sem a frase, o estado “Finalizado” nunca dispara e o resumo final não é enviado.',
      destino: { aba: 'empresa', rotulo: 'Abrir Empresa' },
    },
    {
      chave: 'servicos', titulo: 'Serviços e valores',
      situacao: !ativos.length ? 'pendente' : ativos.some((s) => s.preco != null) ? 'ok' : 'atencao',
      detalhe: !ativos.length ? 'Cadastre ao menos os serviços principais.' : `${ativos.length} serviço(s) ativo(s)${ativos.some((s) => s.preco != null) ? '.' : ', nenhum com valor.'}`,
      destino: { aba: 'servicos', rotulo: 'Abrir Serviços' },
    },
    {
      chave: 'agenda', titulo: 'Agendas do assistente',
      situacao: !regrasAtivas.length ? 'pendente' : semJornada.length || semCalendario.length ? 'atencao' : 'ok',
      detalhe: !regrasAtivas.length
        ? 'Nenhuma agenda ativa: o assistente não consegue consultar nem marcar horários.'
        : semJornada.length
          ? `Sem jornada semanal: ${semJornada.map(nomeAgenda).join('; ')}.`
          : semCalendario.length
            ? `Sem calendário: ${semCalendario.map(nomeAgenda).join('; ')}.`
            : `${regrasAtivas.length} agenda(s) ativa(s) com jornada. Use “Testar” em cada uma.`,
      destino: { rota: '/agenda-configuracao', rotulo: 'Abrir Regras da agenda' },
    },
    {
      chave: 'notificacoes', titulo: 'Quem recebe os avisos da equipe',
      situacao: entrada.destinatarios.some((d) => d.ativo) ? 'ok' : 'atencao',
      detalhe: entrada.destinatarios.some((d) => d.ativo) ? 'Há destinatários ativos.' : 'Ninguém será avisado de pedidos de atendimento humano, finalizações ou agendamentos.',
      destino: { aba: 'notificacoes', rotulo: 'Abrir Notificações' },
    },
    {
      chave: 'openai', titulo: 'Chave da OpenAI',
      situacao: entrada.openaiConfigurada === null ? 'atencao' : entrada.openaiConfigurada ? 'ok' : 'pendente',
      detalhe: entrada.openaiConfigurada === null ? 'Não foi possível verificar.' : entrada.openaiConfigurada ? 'Configurada.' : 'Sem a chave o assistente não responde.',
      destino: { rota: '/configuration', rotulo: 'Abrir Configurações' },
    },
    {
      chave: 'prompt', titulo: 'Prompt publicado',
      situacao: entrada.versoesPrompt === null ? 'atencao' : entrada.versoesPrompt > 0 ? 'ok' : 'pendente',
      detalhe: entrada.versoesPrompt ? `${entrada.versoesPrompt} versão(ões) salva(s). Revise as regras para a sua empresa.` : 'Salve a primeira versão em Meu Prompt.',
      destino: { rota: '/my-prompt', rotulo: 'Abrir Meu Prompt' },
    },
  ];
}

