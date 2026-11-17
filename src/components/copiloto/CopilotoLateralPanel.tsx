import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowUp,
  Bot,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Kanban,
  Layers,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getRouteTitle } from '@/components/layout/routeMeta';
import { useCopilotoOperacional } from '@/hooks/useCopilotoOperacional';
import { ROTAS_INTERNAS_PERMITIDAS } from '@/lib/copilotoOperacionalMotor';
import {
  type AtalhoRotaCopiloto,
  type MensagemCopiloto,
  MODELO_COPILOTO_FIXO,
} from '@/types/copilotoOperacional';

interface CopilotoContextValue {
  aberto: boolean;
  abrir: () => void;
  fechar: () => void;
  alternar: () => void;
  perguntarDireto: (pergunta: string) => void;
  copiloto: ReturnType<typeof useCopilotoOperacional>;
}

const CopilotoContext = createContext<CopilotoContextValue | null>(null);

export function useCopilotoContext() {
  const ctx = useContext(CopilotoContext);
  if (!ctx) {
    throw new Error('useCopilotoContext deve ser usado dentro de CopilotoOperacionalProvider');
  }
  return ctx;
}

/**
 * Renderizador 100% React JSX nativo com escape automático do framework.
 * Formata negrito (**texto**), código inline (`codigo`) e remove links markdown brutos já exibidos nos botões.
 */
function renderizarLinhaFormatada(linha: string, keyPrefix: string): React.ReactNode[] {
  const semLinksMd = linha.replace(/\[([^\]]+)\]\((\/[a-z0-9-]+)\)/gi, '$1 ($2)');
  const partes = semLinksMd.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

  return partes.map((parte, idx) => {
    const k = `${keyPrefix}-${idx}`;
    if (parte.startsWith('**') && parte.endsWith('**') && parte.length > 4) {
      return (
        <strong key={k} className="font-semibold text-foreground">
          {parte.slice(2, -2)}
        </strong>
      );
    }
    if (parte.startsWith('`') && parte.endsWith('`') && parte.length > 2) {
      return (
        <code
          key={k}
          className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-primary"
        >
          {parte.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={k}>{parte}</React.Fragment>;
  });
}

function CorpoMensagemSegura({ conteudo }: { conteudo: string }) {
  const linhas = conteudo.split('\n');

  return (
    <div className="space-y-1.5 text-xs leading-relaxed text-foreground/90">
      {linhas.map((linhaBruta, i) => {
        const linha = linhaBruta.trim();
        if (!linha) {
          return <div key={`sp-${i}`} className="h-1" />;
        }
        if (linha.startsWith('• ') || linha.startsWith('- ')) {
          return (
            <div key={`li-${i}`} className="flex items-start gap-1.5 pl-1">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" aria-hidden="true" />
              <span className="flex-1">{renderizarLinhaFormatada(linha.slice(2), `b-${i}`)}</span>
            </div>
          );
        }
        const matchNum = /^(\d+)\.\s+(.*)$/.exec(linha);
        if (matchNum) {
          return (
            <div key={`num-${i}`} className="flex items-start gap-1.5 pl-1">
              <span className="font-mono text-[11px] font-semibold text-primary shrink-0">
                {matchNum[1]}.
              </span>
              <span className="flex-1">{renderizarLinhaFormatada(matchNum[2], `n-${i}`)}</span>
            </div>
          );
        }
        return <p key={`p-${i}`}>{renderizarLinhaFormatada(linha, `p-${i}`)}</p>;
      })}
    </div>
  );
}

function CardMensagemCopiloto({
  mensagem,
  onNavegarRota,
}: {
  mensagem: MensagemCopiloto;
  onNavegarRota: (url: string) => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const isUser = mensagem.role === 'user';

  const handleCopiar = () => {
    navigator.clipboard.writeText(mensagem.content);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1800);
  };

  const atalhosValidos = (mensagem.atalhosRota || []).filter(
    (a: AtalhoRotaCopiloto) => Boolean(ROTAS_INTERNAS_PERMITIDAS[a.url])
  );

  if (isUser) {
    return (
      <div className="flex flex-col items-end">
        <div className="max-w-[90%] rounded-xl rounded-tr-xs border border-primary/20 bg-primary/10 px-3 py-2 text-xs text-foreground shadow-2xs">
          <p className="whitespace-pre-wrap break-words">{mensagem.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="group rounded-xl border border-border/70 bg-card/95 p-3 shadow-2xs transition-colors hover:border-border">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Bot className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <span className="text-[11px] font-semibold text-foreground">Copiloto</span>
          <span className="rounded border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.2 font-mono text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
            {MODELO_COPILOTO_FIXO}
          </span>
        </div>

        <button
          type="button"
          onClick={handleCopiar}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground opacity-70 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
          title="Copiar resposta"
          aria-label="Copiar resposta do copiloto"
        >
          {copiado ? (
            <>
              <Check className="h-3 w-3 text-emerald-500" aria-hidden="true" />
              <span>Copiado</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" aria-hidden="true" />
              <span>Copiar</span>
            </>
          )}
        </button>
      </div>

      <CorpoMensagemSegura conteudo={mensagem.content} />

      {atalhosValidos.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-border/50 pt-2">
          {atalhosValidos.map((atalho) => (
            <button
              key={atalho.url}
              type="button"
              onClick={() => onNavegarRota(atalho.url)}
              className="inline-flex items-center gap-1 rounded-md border border-primary/25 bg-primary/5 px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/15"
            >
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
              <span>{atalho.label}</span>
            </button>
          ))}
        </div>
      )}

      {typeof mensagem.tempoMs === 'number' && (
        <div className="mt-1.5 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground/70">
          <Zap className="h-2.5 w-2.5 text-amber-500" aria-hidden="true" />
          <span>{mensagem.tempoMs} ms</span>
        </div>
      )}
    </div>
  );
}

export function CopilotoOperacionalProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const tituloTela = getRouteTitle(location.pathname);
  const [aberto, setAberto] = useState<boolean>(false);

  const copiloto = useCopilotoOperacional(location.pathname);

  const abrir = useCallback(() => setAberto(true), []);
  const fechar = useCallback(() => setAberto(false), []);
  const alternar = useCallback(() => setAberto((prev) => !prev), []);

  const perguntarDireto = useCallback(
    (pergunta: string) => {
      setAberto(true);
      void copiloto.enviarPergunta(pergunta, tituloTela);
    },
    [copiloto, tituloTela]
  );

  // Atalho de teclado estilo Editor (Ctrl+J / Cmd+J) para abrir/recolher o Copiloto a qualquer momento
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j') {
        event.preventDefault();
        setAberto((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <CopilotoContext.Provider
      value={{
        aberto,
        abrir,
        fechar,
        alternar,
        perguntarDireto,
        copiloto,
      }}
    >
      {children}
    </CopilotoContext.Provider>
  );
}

/**
 * Botão compacto no AppHeader para abrir/recolher a aba lateral direita do Copiloto.
 */
export function CopilotoHeaderTrigger() {
  const { aberto, alternar } = useCopilotoContext();

  return (
    <Button
      type="button"
      variant={aberto ? 'default' : 'outline'}
      size="sm"
      onClick={alternar}
      aria-expanded={aberto}
      aria-controls="copiloto-lateral-panel"
      title="Abrir ou recolher Copiloto da Operação (Ctrl+J / ⌘J)"
      className="gap-1.5 text-xs"
    >
      <Sparkles className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
      <span className="hidden sm:inline">Copiloto</span>
      <span className="hidden lg:inline-block rounded bg-emerald-500/15 px-1 py-0.2 font-mono text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
        5.4-nano
      </span>
      {aberto ? (
        <PanelRightClose className="h-3.5 w-3.5 opacity-80" aria-hidden="true" />
      ) : (
        <PanelRightOpen className="h-3.5 w-3.5 opacity-80" aria-hidden="true" />
      )}
    </Button>
  );
}

/**
 * Aba lateral direita retrátil + Painel estilo Editor Simplificado (modelo único gpt-5.4-nano).
 */
export function CopilotoLateralPanel() {
  const { aberto, abrir, fechar, copiloto } = useCopilotoContext();
  const location = useLocation();
  const navigate = useNavigate();
  const tituloTela = getRouteTitle(location.pathname);
  const inputId = useId();

  const [textoPergunta, setTextoPergunta] = useState('');
  const fimMensagensRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const {
    mensagens,
    enviando,
    snapshot,
    atualizandoSnapshot,
    atualizarSnapshot,
    sugestoes,
    enviarPergunta,
    limparConversa,
  } = copiloto;

  useEffect(() => {
    if (aberto) {
      fimMensagensRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensagens.length, enviando, aberto]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const limpa = textoPergunta.trim();
    if (!limpa || enviando) return;
    setTextoPergunta('');
    void enviarPergunta(limpa, tituloTela);
  };

  const handleKeyDownTextarea = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleNavegarRota = (url: string) => {
    if (ROTAS_INTERNAS_PERMITIDAS[url]) {
      navigate(url);
    }
  };

  return (
    <>
      {/* ABA LATERAL DIREITA RETRÁTIL (sempre visível na borda direita quando o painel está recolhido) */}
      {!aberto && (
        <button
          type="button"
          onClick={abrir}
          aria-expanded={false}
          aria-controls="copiloto-lateral-panel"
          title="Abrir Copiloto da Operação — GPT-5.4 Nano (Ctrl+J)"
          className="fixed right-0 top-1/2 z-40 flex -translate-y-1/2 flex-col items-center gap-1.5 rounded-l-xl border border-r-0 border-primary/30 bg-card/95 px-2 py-3 text-xs font-medium text-foreground shadow-lg backdrop-blur-xs transition-all hover:bg-primary/5 hover:pr-3 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ChevronLeft className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <span
            className="text-[11px] font-semibold tracking-wide text-foreground"
            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
          >
            Copiloto
          </span>
          <span className="rounded bg-emerald-500/15 px-1 py-0.5 font-mono text-[9px] font-bold text-emerald-700 dark:text-emerald-300">
            5.4
          </span>
        </button>
      )}

      {/* Backdrop leve apenas no mobile quando aberto */}
      {aberto && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] lg:hidden"
          onClick={fechar}
          aria-hidden="true"
        />
      )}

      {/* PAINEL DIREITO RETRÁTIL ESTILO EDITOR SIMPLIFICADO */}
      <aside
        id="copiloto-lateral-panel"
        aria-label="Copiloto da Operação"
        className={`relative z-50 flex h-svh shrink-0 flex-col border-l bg-card transition-all duration-200 ease-in-out ${
          aberto
            ? 'fixed right-0 top-0 w-[min(92vw,390px)] shadow-2xl lg:static lg:w-[370px] xl:w-[400px] lg:shadow-none'
            : 'w-0 overflow-hidden border-l-0'
        }`}
      >
        {aberto && (
          <>
            {/* Aba de recolhimento colada na borda esquerda do painel direito */}
            <button
              type="button"
              onClick={fechar}
              title="Recolher Copiloto (Ctrl+J)"
              aria-label="Recolher painel do Copiloto"
              className="absolute -left-3 top-1/2 z-10 hidden h-12 w-3 -translate-y-1/2 items-center justify-center rounded-l-md border border-r-0 bg-card text-muted-foreground shadow-xs hover:bg-muted hover:text-foreground lg:flex"
            >
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
            </button>

            {/* 1. TOPO DO EDITOR SIMPLIFICADO (Título + Modelo Único Fixo + Ações) */}
            <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-muted/20 px-3">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className="truncate text-xs font-bold tracking-tight text-foreground">
                      Copiloto da Operação
                    </h2>
                    <Badge
                      variant="outline"
                      className="border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0 font-mono text-[10px] font-semibold text-emerald-700 dark:text-emerald-300"
                      title="Modelo único fixo configurado para respostas rápidas e baixo custo"
                    >
                      {MODELO_COPILOTO_FIXO}
                    </Badge>
                  </div>
                  <p className="truncate text-[10px] text-muted-foreground">
                    Sistema & indicadores de {snapshot.empresa.nome_empresa}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => void atualizarSnapshot()}
                  disabled={atualizandoSnapshot}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  title="Sincronizar dados da operação agora"
                  aria-label="Sincronizar dados da operação"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${atualizandoSnapshot ? 'animate-spin text-primary' : ''}`}
                    aria-hidden="true"
                  />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={limparConversa}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  title="Nova conversa / limpar histórico"
                  aria-label="Limpar conversa"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={fechar}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  title="Recolher aba lateral (Ctrl+J)"
                  aria-label="Recolher Copiloto"
                >
                  <PanelRightClose className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>

            {/* 2. BARRA DE CONTEXTO ATIVO (Tela Atual + Pulso da Operação em <details>) */}
            <div className="shrink-0 border-b bg-muted/10 px-3 py-2">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
                  <span className="truncate font-medium text-foreground">
                    Tela: <span className="text-primary">{tituloTela}</span>
                  </span>
                  <code className="rounded bg-muted px-1 py-0.2 font-mono text-[10px] text-muted-foreground">
                    {location.pathname}
                  </code>
                </div>
              </div>

              <details className="group mt-1.5">
                <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg border border-border/60 bg-background/80 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground">
                  <span className="flex items-center gap-1.5">
                    <Layers className="h-3 w-3 text-primary" aria-hidden="true" />
                    <span>
                      Pulso da Operação: <strong>{snapshot.atendimento.conversas_abertas}</strong> chats ·{' '}
                      <strong>{snapshot.agenda.agendamentos_hoje}</strong> agenda hoje ·{' '}
                      <strong>{snapshot.clientes.total_clientes}</strong> clientes
                    </span>
                  </span>
                  <span className="text-[10px] text-primary group-open:rotate-90 transition-transform">
                    ▸
                  </span>
                </summary>

                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      void enviarPergunta(
                        'Como estão as conversas e atendimentos no WhatsApp hoje?',
                        tituloTela
                      )
                    }
                    className="flex flex-col rounded-lg border bg-card p-2 text-left transition-colors hover:border-primary/40"
                  >
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <MessageSquare className="h-2.5 w-2.5 text-sky-500" aria-hidden="true" />
                      Conversas
                    </span>
                    <span className="mt-0.5 text-xs font-bold text-foreground">
                      {snapshot.atendimento.conversas_abertas} abertas
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {snapshot.atendimento.conversas_hoje} hoje
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void enviarPergunta(
                        'Quantos agendamentos temos hoje e nos próximos 7 dias?',
                        tituloTela
                      )
                    }
                    className="flex flex-col rounded-lg border bg-card p-2 text-left transition-colors hover:border-primary/40"
                  >
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <CalendarDays className="h-2.5 w-2.5 text-emerald-500" aria-hidden="true" />
                      Agenda
                    </span>
                    <span className="mt-0.5 text-xs font-bold text-foreground">
                      {snapshot.agenda.agendamentos_hoje} hoje
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {snapshot.agenda.agendamentos_proximos_7d} em 7d
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void enviarPergunta(
                        'Qual a situação dos nossos Pipelines CRM e cards urgentes?',
                        tituloTela
                      )
                    }
                    className="flex flex-col rounded-lg border bg-card p-2 text-left transition-colors hover:border-primary/40"
                  >
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Kanban className="h-2.5 w-2.5 text-violet-500" aria-hidden="true" />
                      Pipelines
                    </span>
                    <span className="mt-0.5 text-xs font-bold text-foreground">
                      {snapshot.pipelines.total_cards} cards
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {snapshot.pipelines.cards_urgentes} urgentes
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void enviarPergunta(
                        'Quantos clientes e pets temos cadastrados na clínica?',
                        tituloTela
                      )
                    }
                    className="flex flex-col rounded-lg border bg-card p-2 text-left transition-colors hover:border-primary/40"
                  >
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Users className="h-2.5 w-2.5 text-teal-500" aria-hidden="true" />
                      Clientes
                    </span>
                    <span className="mt-0.5 text-xs font-bold text-foreground">
                      {snapshot.clientes.total_clientes} tutores
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {snapshot.clientes.total_pets} pets
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void enviarPergunta(
                        'Como estão os lembretes de vacina e retorno agendados?',
                        tituloTela
                      )
                    }
                    className="flex flex-col rounded-lg border bg-card p-2 text-left transition-colors hover:border-primary/40"
                  >
                    <span className="text-[10px] text-muted-foreground">Lembretes</span>
                    <span className="mt-0.5 text-xs font-bold text-foreground">
                      {snapshot.lembretes.agendados} fila
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {snapshot.lembretes.confirmados} confirm.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void enviarPergunta(
                        'Qual a versão ativa e quantas regras estão ativas no Meu Prompt?',
                        tituloTela
                      )
                    }
                    className="flex flex-col rounded-lg border bg-card p-2 text-left transition-colors hover:border-primary/40"
                  >
                    <span className="text-[10px] text-muted-foreground">Meu Prompt</span>
                    <span className="mt-0.5 text-xs font-bold text-foreground">
                      v{snapshot.prompt_ia.versao_ativa}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {snapshot.prompt_ia.regras_ativas} regras
                    </span>
                  </button>
                </div>
              </details>
            </div>

            {/* 3. LISTA DE MENSAGENS (Estilo Chat do Editor) */}
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 space-y-3">
              {/* Sugestões rápidas no topo da conversa */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Perguntas rápidas sobre operação & sistema
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {sugestoes.map((sug) => (
                    <button
                      key={sug.id}
                      type="button"
                      disabled={enviando}
                      onClick={() => void enviarPergunta(sug.pergunta, tituloTela)}
                      className="rounded-lg border border-border/80 bg-muted/40 px-2.5 py-1 text-left text-[11px] font-medium text-foreground/90 transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                    >
                      {sug.titulo}
                    </button>
                  ))}
                </div>
              </div>

              {mensagens.map((msg) => (
                <CardMensagemCopiloto
                  key={msg.id}
                  mensagem={msg}
                  onNavegarRota={handleNavegarRota}
                />
              ))}

              {enviando && (
                <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden="true" />
                  <span>
                    Consultando operação com <code className="font-mono">{MODELO_COPILOTO_FIXO}</code>...
                  </span>
                </div>
              )}

              <div ref={fimMensagensRef} />
            </div>

            {/* 4. COMPOSITOR INFERIOR (Caixa Estilo Editor Simplificado com Modelo Fixo) */}
            <form onSubmit={handleSubmit} className="shrink-0 border-t bg-muted/15 p-2.5">
              <div className="rounded-xl border border-border bg-background p-2 shadow-2xs focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20">
                <label htmlFor={inputId} className="sr-only">
                  Pergunte ao Copiloto sobre sua operação ou sobre o sistema
                </label>
                <textarea
                  id={inputId}
                  ref={textareaRef}
                  rows={2}
                  maxLength={1000}
                  value={textoPergunta}
                  onChange={(e) => setTextoPergunta(e.target.value)}
                  onKeyDown={handleKeyDownTextarea}
                  placeholder="Pergunte sobre sua operação (agenda, chats, clientes, fila) ou como usar esta tela..."
                  className="w-full resize-none bg-transparent text-xs leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-hidden"
                />

                <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-border/50 pt-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span
                      className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono font-medium text-foreground/80"
                      title="Modelo único fixo: GPT-5.4 Nano"
                    >
                      <Zap className="h-2.5 w-2.5 text-emerald-500" aria-hidden="true" />
                      {MODELO_COPILOTO_FIXO}
                    </span>
                    <span className="hidden sm:inline truncate">
                      · Contexto: Operação + {tituloTela}
                    </span>
                  </div>

                  <Button
                    type="submit"
                    size="icon"
                    disabled={!textoPergunta.trim() || enviando}
                    className="h-7 w-7 rounded-lg"
                    title="Enviar pergunta (Enter)"
                    aria-label="Enviar pergunta ao Copiloto"
                  >
                    <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </form>
          </>
        )}
      </aside>
    </>
  );
}
