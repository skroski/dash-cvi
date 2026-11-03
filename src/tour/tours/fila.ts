import type { TourDef } from '../types';

/** Tours das telas de atendimento presencial, fila e novas funcionalidades. */

export const tourFila: TourDef = {
  id: 'queue',
  title: 'Fila de Atendimento',
  description: 'Gestão de senhas, triagem clínica, chamadas para consultórios e painel de TV.',
  routes: ['/queue'],
  steps: [
    {
      id: 'intro',
      title: 'Fila de Atendimento Presencial',
      text:
        '<p>Organize a recepção e o fluxo dos pets na clínica em tempo real.</p>' +
        '<p>Aqui você emite senhas, realiza a triagem com classificação de risco e direciona para os consultórios.</p>',
      element: '[data-tour="queue-header"]',
      on: 'bottom',
    },
    {
      id: 'emitir-senha',
      title: 'Emitir Nova Senha',
      text:
        '<p>Clique aqui para gerar uma nova senha na recepção: escolha o tipo de atendimento (Consulta, Retorno, Exame, Emergência) e a prioridade.</p>',
      element: '[data-tour="queue-btn-emitir"]',
      on: 'bottom',
    },
    {
      id: 'colunas-atendimento',
      title: 'Quadro Kanban da Fila',
      text:
        '<ul>' +
        '<li><strong>Aguardando Triagem:</strong> senhas recém-chegadas na recepção.</li>' +
        '<li><strong>Aguardando Atendimento:</strong> pets triados prontos para o veterinário.</li>' +
        '<li><strong>Em Atendimento:</strong> consultas em andamento nos consultórios.</li>' +
        '<li><strong>Finalizados:</strong> histórico de atendimentos concluídos no dia.</li>' +
        '</ul>',
      element: '[data-tour="queue-board"]',
      on: 'top',
    },
    {
      id: 'chamar-painel',
      title: 'Chamar na TV e Consultório',
      text:
        '<p>No cartão de cada pet, o botão <strong>Chamar</strong> emite o alerta sonoro e visual na TV da sala de espera, indicando o consultório de destino.</p>',
      element: '[data-tour="queue-card-action"]',
      on: 'left',
    },
    {
      id: 'atalhos-tv',
      title: 'Abrir TV e Chamador Rápido',
      text:
        '<p>Acesse a <strong>TV da Fila</strong> (para projetar na sala de espera) e o <strong>Chamador de Consultório</strong> (para o veterinário chamar de forma isolada).</p>',
      element: '[data-tour="queue-links"]',
      on: 'bottom',
    },
  ],
};

export const tourWebChat: TourDef = {
  id: 'web-chat',
  title: 'Web Chat',
  description: 'Atendimento pelo navegador com identificação por código ou telefone.',
  routes: ['/web-chat'],
  steps: [
    {
      id: 'intro',
      title: 'Atendimento via Web Chat',
      text:
        '<p>Permite iniciar ou continuar uma conversa com o tutor diretamente pelo navegador, sem depender do aplicativo do WhatsApp no celular do tutor.</p>',
    },
    {
      id: 'busca-sessao',
      title: 'Localizar Conversa',
      text:
        '<p>Digite o <strong>código de 6 dígitos</strong> fornecido ao tutor ou busque pelo <strong>telefone e primeiro nome</strong> para carregar o histórico completo.</p>',
      element: '[data-tour="webchat-form"]',
      on: 'bottom',
    },
    {
      id: 'recentes',
      title: 'Atendimentos Recentes',
      text:
        '<p>Acesso rápido aos últimos tutores que interagiram pelo Web Chat para retomar a conversa com 1 clique.</p>',
      element: '[data-tour="webchat-recents"]',
      on: 'left',
    },
  ],
};

export const tourPrompt: TourDef = {
  id: 'my-prompt',
  title: 'Meu Prompt (IA)',
  description: 'Instruções da inteligência artificial, versionamento e histórico auditável.',
  routes: ['/my-prompt'],
  papeis: ['admin'],
  steps: [
    {
      id: 'intro',
      title: 'Diretrizes da inteligência artificial',
      text:
        '<p>Este editor define como a IA conversa com os tutores: tom de voz, regras de agendamento, encaminhamentos e orientações clínicas permitidas.</p>',
    },
    {
      id: 'editor',
      title: 'Editor de Instruções',
      text:
        '<p>Escreva ou ajuste as orientações do assistente. O contador indica a quantidade de caracteres em uso.</p>',
      element: '[data-tour="prompt-editor"]',
      on: 'right',
    },
    {
      id: 'salvar-versao',
      title: 'Salvar Nova Versão',
      text:
        '<p>Ao salvar, uma nova versão é gravada no banco. A IA passa a consultar imediatamente a versão mais recente.</p>',
      element: '[data-tour="prompt-save"]',
      on: 'bottom',
    },
    {
      id: 'historico',
      title: 'Histórico de Versões',
      text:
        '<p>Consulte versões anteriores criadas pela equipe, veja quando foram salvas e restaure conteúdos antigos a qualquer momento.</p>',
      element: '[data-tour="prompt-history"]',
      on: 'left',
    },
  ],
};

export const tourTvEChamador: TourDef = {
  id: 'tv-caller',
  title: 'TV e Chamador de Consultório',
  description: 'Como usar a tela de TV na recepção e o chamador rápido para os veterinários.',
  routes: ['/tv', '/chamar'],
  steps: [
    {
      id: 'tv-info',
      title: 'Painel de TV da Recepção (/tv)',
      text:
        '<p>Abra a rota <code>/tv</code> em tela cheia na TV da recepção. Ela reproduz avisos sonoros e destaca a última senha chamada com nome do pet e consultório.</p>',
    },
    {
      id: 'caller-info',
      title: 'Chamador no Consultório (/chamar)',
      text:
        '<p>Cada veterinário pode manter <code>/chamar</code> aberta em seu computador para chamar o próximo pet da fila sem precisar acessar a tela principal.</p>',
    },
  ],
};
