import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Lock, Maximize, Monitor, PawPrint, Sparkles, Unlock, Volume2, VolumeX, WifiOff } from 'lucide-react';
import TvVideo from '@/components/queue/TvVideo';
import { useFilaTv } from '@/hooks/useFilaTv';
import { urlPublicaFila } from '@/hooks/useFilaConfig';
import { desbloquearAudioFila, tocarSinalFila } from '@/lib/filaAudio';
import { estiloMarca } from '@/lib/filaCores';
import type { TvChamada, TvPainel } from '@/types/filaConfig';

type ProximoTv = TvPainel['proximos'][number];

const CHAVE_SOM = 'fila_tv_som';
const CHAVE_PRIVACIDADE = 'fila_tv_privacidade';

function lerPreferencia(chave: string): boolean | null {
  try {
    const valor = localStorage.getItem(chave);
    return valor === null ? null : valor === 'true';
  } catch {
    return null;
  }
}

function guardarPreferencia(chave: string, valor: boolean) {
  try {
    localStorage.setItem(chave, String(valor));
  } catch {
    /* navegador da TV sem armazenamento: vale só até recarregar */
  }
}

function nomeExibido(atual: TvChamada | null, privacidade: boolean): string {
  if (!atual) return 'Aguardando próxima chamada';
  if (privacidade) return `Senha ${atual.senha}`;
  if (atual.pet && atual.tutor) return `${atual.pet} (${atual.tutor})`;
  return atual.pet || atual.tutor || 'Paciente chamado';
}

const rotuloVet = (nome: string) => (/^dra?\.?\s/i.test(nome) ? nome : `Dr(a). ${nome}`);

function Marca({ logoUrl, className = 'h-10 w-10' }: { logoUrl: string | null; className?: string }) {
  return logoUrl ? (
    <img src={logoUrl} alt="" className={`${className} object-contain`} />
  ) : (
    <span className={`${className} grid place-items-center rounded-xl bg-fila-600 text-white`}>
      <PawPrint className="h-3/5 w-3/5" aria-hidden="true" />
    </span>
  );
}

/** Chamada atual: senha gigante, nome, sala e veterinário. */
function BlocoChamada({
  atual,
  privacidade,
  pulsando,
  compacto,
}: {
  atual: TvChamada | null;
  privacidade: boolean;
  pulsando: boolean;
  compacto: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center">
      <div className="inline-flex items-center gap-2 rounded-full bg-fila-500/15 px-6 py-2 text-sm font-semibold text-fila-300 md:text-lg">
        <Bell className="h-5 w-5 animate-bounce" aria-hidden="true" />
        <span>Chamada atual</span>
      </div>

      <div className={`${compacto ? 'mt-[1.5vh]' : 'mt-4'} transition-all duration-500 ${pulsando ? 'scale-110 text-fila-300' : 'text-white'}`}>
        <span
          className={`font-mono font-black leading-none tracking-tighter drop-shadow-[0_10px_35px_rgb(var(--fila-500)/0.35)] ${
            compacto ? '' : 'text-9xl md:text-[14rem]'
          }`}
          // No painel lateral a altura é o limite (TVs 1366x768): a senha cresce com a largura E com a altura.
          style={compacto ? { fontSize: 'clamp(3.5rem, min(9vw, 17vh), 9rem)' } : undefined}
        >
          {atual?.senha || '— —'}
        </span>
      </div>

      <p
        className={`max-w-4xl truncate font-extrabold tracking-tight text-white ${compacto ? 'mt-[1.5vh] max-w-full px-2' : 'mt-4 text-3xl md:text-6xl'}`}
        style={compacto ? { fontSize: 'clamp(1.4rem, min(2.4vw, 4.2vh), 2.4rem)' } : undefined}
      >
        {nomeExibido(atual, privacidade)}
      </p>

      <div
        className={`flex flex-wrap items-center justify-center gap-4 text-white/80 ${compacto ? 'mt-[2vh]' : 'mt-8 text-xl md:text-3xl'}`}
        style={compacto ? { fontSize: 'clamp(1rem, min(1.6vw, 3vh), 1.6rem)' } : undefined}
      >
        {atual ? (
          <div className={`flex flex-row flex-wrap items-center justify-center gap-3 rounded-2xl border border-white/10 bg-slate-900 shadow-lg ${compacto ? 'px-5 py-2.5' : 'px-6 py-4'}`}>
            <span className="font-bold text-fila-300">Dirija-se ao:</span>
            <strong className="font-black text-white">{atual.sala || 'Recepção'}</strong>
            {atual.veterinario && !privacidade && (
              <span className="border-l border-white/15 pl-3 text-[0.8em] text-white/70">{rotuloVet(atual.veterinario)}</span>
            )}
          </div>
        ) : (
          <div className="text-lg text-white/60">Por favor, aguarde no saguão. Acompanhe a chamada na tela.</div>
        )}
      </div>
    </div>
  );
}

/** Rodapé: chamadas recentes e próximos da fila. */
function Rodape({
  recentes,
  proximos,
  privacidade,
  compacto,
}: {
  recentes: TvChamada[];
  proximos: ProximoTv[];
  privacidade: boolean;
  compacto: boolean;
}) {
  const colunas = compacto ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4';
  return (
    <div className={`grid gap-4 ${compacto ? 'grid-cols-1' : 'grid-cols-1 gap-6 md:grid-cols-2'}`}>
      <section className="rounded-2xl border border-white/10 bg-slate-900 p-4">
        <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold text-white/60">
          <Monitor className="h-4 w-4 text-fila-300" aria-hidden="true" />
          Chamadas recentes
        </h2>
        <div className={`grid ${colunas} gap-2`}>
          {recentes.slice(0, compacto ? 2 : 4).map((item) => (
            <div key={item.id} className="rounded-lg border border-white/10 bg-slate-800 p-2.5 text-center">
              <div className="font-mono text-2xl font-bold text-white">{item.senha}</div>
              <div className="mt-0.5 truncate text-xs font-medium text-fila-300">{item.sala || 'Recepção'}</div>
            </div>
          ))}
          {recentes.length === 0 && <div className="col-span-full py-3 text-center text-xs text-white/50">Nenhuma outra chamada recente</div>}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900 p-4">
        <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold text-white/60">
          <Sparkles className="h-4 w-4 text-amber-300" aria-hidden="true" />
          Próximos a serem atendidos
        </h2>
        <div className={`grid ${colunas} gap-2`}>
          {proximos.slice(0, compacto ? 2 : 4).map((item) => (
            <div key={item.id} className="rounded-lg border border-white/10 bg-slate-800 p-2.5 text-center">
              <div className="font-mono text-xl font-bold text-white/90">{item.senha}</div>
              <div className="mt-0.5 truncate text-xs text-white/60">{privacidade ? 'Aguardando' : item.pet || 'Aguardando'}</div>
            </div>
          ))}
          {proximos.length === 0 && <div className="col-span-full py-3 text-center text-xs text-white/50">Nenhum paciente aguardando</div>}
        </div>
      </section>
    </div>
  );
}

/**
 * Layout "vídeo 16:9": a senha é o assunto da tela. Texto branco sobre fundo escuro (contraste acima de
 * 7:1, WCAG AAA); a chamada nova muda só a borda, nunca a cor do texto.
 */
function ChamadaDestaque({ atual, privacidade, pulsando }: { atual: TvChamada | null; privacidade: boolean; pulsando: boolean }) {
  return (
    <section
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label="Chamada atual"
      className={`flex h-full min-h-0 flex-col items-center justify-center gap-[2.5vh] rounded-lg border-4 bg-slate-900 px-6 py-4 text-center transition-colors duration-500 ${
        pulsando ? 'border-amber-400' : 'border-fila-500'
      }`}
    >
      <div className="flex items-center gap-3 font-bold uppercase tracking-widest text-white" style={{ fontSize: 'clamp(1.25rem, 2.2vw, 2.5rem)' }}>
        <Bell className="h-[1.2em] w-[1.2em]" aria-hidden="true" />
        <span>Chamada atual</span>
      </div>
      <div
        className={`font-mono font-black leading-none tabular-nums tracking-tight text-white transition-transform duration-500 ${pulsando ? 'scale-105' : ''}`}
        style={{ fontSize: 'clamp(6rem, min(21vw, 38vh), 26rem)' }}
      >
        {atual?.senha || '— —'}
      </div>
      <p className="max-w-full truncate font-extrabold text-white" style={{ fontSize: 'clamp(1.75rem, 3.6vw, 4.25rem)' }}>
        {nomeExibido(atual, privacidade)}
      </p>
      {atual ? (
        <div className="flex max-w-full flex-wrap items-baseline justify-center gap-x-4 gap-y-1 rounded-lg bg-white px-8 py-3 text-slate-950" style={{ fontSize: 'clamp(1.5rem, 3vw, 3.5rem)' }}>
          <span className="font-semibold">Dirija-se ao</span>
          <strong className="font-black">{atual.sala || 'Recepção'}</strong>
          {atual.veterinario && !privacidade && (
            <span className="font-semibold" style={{ fontSize: '0.7em' }}>
              {rotuloVet(atual.veterinario)}
            </span>
          )}
        </div>
      ) : (
        <p className="text-xl text-white">Por favor, aguarde no saguão. Acompanhe a chamada na tela.</p>
      )}
    </section>
  );
}

/** Coluna lateral do layout 16:9: chamadas anteriores e próximos, com senhas grandes. */
function ListasGrandes({ recentes, proximos, privacidade }: { recentes: TvChamada[]; proximos: ProximoTv[]; privacidade: boolean }) {
  // Limitada também pela altura: em telas baixas (1366x768) as duas listas precisam caber sem cortar.
  const senhaGrande = { fontSize: 'clamp(2rem, min(3.2vw, 5.2vh), 3.75rem)' };
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <section aria-label="Chamadas anteriores" className="rounded-lg border border-white/10 bg-slate-900 p-4">
        <h2 className="mb-2 text-lg font-bold text-white">Chamadas anteriores</h2>
        <ul className="space-y-1.5">
          {recentes.slice(0, 3).map((item, i) => (
            <li key={item.id} className={`items-baseline justify-between gap-3 rounded-lg bg-slate-800 px-4 py-1 ${i === 2 ? 'hidden [@media(min-height:860px)]:flex' : 'flex'}`}>
              <span className="font-mono font-black leading-tight tabular-nums text-white" style={senhaGrande}>
                {item.senha}
              </span>
              <span className="truncate text-xl font-bold text-white">{item.sala || 'Recepção'}</span>
            </li>
          ))}
          {recentes.length === 0 && <li className="py-2 text-lg text-white">Nenhuma outra chamada ainda</li>}
        </ul>
      </section>

      <section aria-label="Próximos a serem atendidos" className="min-h-0 flex-1 rounded-lg border border-white/10 bg-slate-900 p-4">
        <h2 className="mb-2 text-lg font-bold text-white">Próximos</h2>
        <ul className="grid grid-cols-2 gap-2">
          {proximos.slice(0, 4).map((item) => (
            <li key={item.id} className="rounded-lg bg-slate-800 px-3 py-1 text-center">
              <span className="block font-mono font-black leading-tight tabular-nums text-white" style={senhaGrande}>
                {item.senha}
              </span>
              {!privacidade && item.pet && (
                <span className="hidden truncate text-base font-semibold text-white [@media(min-height:860px)]:block">{item.pet}</span>
              )}
            </li>
          ))}
          {proximos.length === 0 && <li className="col-span-2 py-2 text-lg text-white">Ninguém aguardando agora</li>}
        </ul>
      </section>
    </div>
  );
}

export default function QueueTvPage() {
  const { painel, midias, offline, carregando } = useFilaTv();
  const config = painel?.config;
  const logoUrl = useMemo(() => urlPublicaFila(config?.logo_path), [config?.logo_path]);

  // Preferência deste aparelho (sobrepõe o padrão definido nos Ajustes da fila).
  const [somLocal, setSomLocal] = useState<boolean | null>(() => lerPreferencia(CHAVE_SOM));
  const [privacidadeLocal, setPrivacidadeLocal] = useState<boolean | null>(() => lerPreferencia(CHAVE_PRIVACIDADE));
  const somAtivo = somLocal ?? config?.tv_som ?? true;
  // A privacidade do servidor não pode ser desligada na TV (os nomes nem chegam).
  const privacidade = !!config?.tv_privacidade || privacidadeLocal === true;

  const [pulsando, setPulsando] = useState(false);
  const [aviso, setAviso] = useState(false);
  const [precisaToque, setPrecisaToque] = useState(true);
  const ultimaChamada = useRef<string | null>(null);

  const atual = painel?.atual ?? null;
  const recentes = painel?.recentes ?? [];
  const proximos = painel?.proximos ?? [];

  const temVideo = midias.length > 0;
  const layout = config?.tv_layout ?? 'lateral';
  const telaCheia = temVideo && layout === 'tela_cheia';
  const lateral = temVideo && layout === 'lateral';
  const compacto = temVideo && layout === 'video_16_9';

  useEffect(() => {
    if (config?.nome) document.title = `${config.nome} · Painel de atendimento`;
  }, [config?.nome]);

  // Nova chamada: animação, aviso em tela cheia e som. A primeira leitura só "memoriza" (não toca ao abrir a TV).
  // A dependência é a CHAVE da chamada (texto), não o objeto: a cada atualização o objeto é novo e
  // reiniciaria os temporizadores, deixando o aviso preso na tela.
  const chaveChamada = atual ? `${atual.id}_${atual.chamado_em || ''}` : '';
  const somRef = useRef(somAtivo);
  somRef.current = somAtivo;
  const segundosRef = useRef(config?.tv_aviso_segundos ?? 12);
  segundosRef.current = config?.tv_aviso_segundos ?? 12;

  useEffect(() => {
    if (carregando) return;
    if (ultimaChamada.current === null) {
      ultimaChamada.current = chaveChamada;
      return;
    }
    if (!chaveChamada || ultimaChamada.current === chaveChamada) return;
    ultimaChamada.current = chaveChamada;

    setPulsando(true);
    setAviso(true);
    const t1 = window.setTimeout(() => setPulsando(false), 2500);
    const t2 = window.setTimeout(() => setAviso(false), segundosRef.current * 1000);
    if (somRef.current) tocarSinalFila();
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      setPulsando(false);
      setAviso(false);
    };
  }, [chaveChamada, carregando]);

  const alternarSom = () => {
    desbloquearAudioFila();
    setPrecisaToque(false);
    const proximoValor = !somAtivo;
    setSomLocal(proximoValor);
    guardarPreferencia(CHAVE_SOM, proximoValor);
    if (proximoValor) tocarSinalFila();
  };

  const alternarPrivacidade = () => {
    const proximoValor = !privacidade;
    setPrivacidadeLocal(proximoValor);
    guardarPreferencia(CHAVE_PRIVACIDADE, proximoValor);
  };

  const telaCheiaNavegador = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const aoClicar = () => {
    desbloquearAudioFila();
    setPrecisaToque(false);
  };

  const raiz = estiloMarca(config?.cor_marca ?? '#2294aa');

  if (carregando) {
    return (
      <div style={raiz} className="grid min-h-screen place-items-center bg-slate-950 text-white">
        <div className="flex items-center gap-3 text-white/70">
          {offline ? <WifiOff className="h-5 w-5" aria-hidden="true" /> : <PawPrint className="h-5 w-5 animate-pulse" aria-hidden="true" />}
          <span>{offline ? 'Sem conexão com o servidor da clínica' : 'Carregando painel...'}</span>
        </div>
      </div>
    );
  }

  const controles = (
    <div className="flex shrink-0 items-center gap-3 whitespace-nowrap">
      {precisaToque && (
        <span className="hidden animate-bounce rounded-full bg-amber-400/15 px-3 py-1.5 text-xs font-medium text-amber-200 md:inline-flex">
          Toque na tela para ativar o áudio
        </span>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          telaCheiaNavegador();
        }}
        className="hidden h-9 w-9 place-items-center rounded-full border border-white/20 text-white/70 transition hover:bg-white/10 md:grid"
        aria-label="Tela cheia"
        title="Tela cheia"
      >
        <Maximize className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          alternarPrivacidade();
        }}
        disabled={!!config?.tv_privacidade}
        className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
          privacidade ? 'border-fila-400/50 bg-fila-500/15 text-fila-300' : 'border-white/20 bg-white/5 text-white/70 hover:bg-white/10'
        } disabled:cursor-not-allowed disabled:opacity-70`}
        title={config?.tv_privacidade ? 'Privacidade ativada nos Ajustes da fila' : 'Alternar privacidade de nomes'}
      >
        {privacidade ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
        <span className="hidden sm:inline">{privacidade ? 'Apenas senha' : 'Exibir nomes'}</span>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          alternarSom();
        }}
        className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
          somAtivo ? 'border-fila-400/50 bg-fila-500/15 text-fila-300 hover:bg-fila-500/25' : 'border-white/20 bg-white/5 text-white/60 hover:bg-white/10'
        }`}
        aria-label="Ativar ou desativar sinal sonoro"
      >
        {somAtivo ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        <span className="hidden md:inline">{somAtivo ? 'Sinal sonoro ativo' : 'Mudo'}</span>
      </button>
    </div>
  );

  const titulo = (
    <div className="flex min-w-0 items-center gap-4">
      <Marca logoUrl={logoUrl} />
      <h1 className="flex min-w-0 items-center gap-2 text-xl font-black tracking-tight text-white md:text-2xl">
        <span className="truncate">{config?.nome}</span>
        <span className="hidden whitespace-nowrap rounded-full bg-fila-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-fila-300 xl:inline-flex">
          {config?.subtitulo}
        </span>
      </h1>
    </div>
  );

  const faixaOffline = offline ? (
    <div role="alert" className="absolute inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-red-600 px-4 py-1.5 text-sm font-semibold text-white">
      <WifiOff className="h-4 w-4" aria-hidden="true" />
      Sem conexão com o servidor da clínica. Tentando reconectar...
    </div>
  ) : null;

  // ---------- Layout 1: vídeo em tela cheia; a chamada assume a tela por alguns segundos ----------
  if (telaCheia) {
    return (
      <div style={raiz} onClick={aoClicar} className="fixed inset-0 select-none overflow-hidden bg-black text-white">
        {faixaOffline}
        <TvVideo playlist={midias} muted={config?.tv_video_mudo ?? true} duck={aviso} className="absolute inset-0 h-full w-full" fit="cover" />

        <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-4 bg-gradient-to-b from-black/70 to-transparent p-4">
          {titulo}
          {controles}
        </div>

        {/* Faixa permanente com a última chamada */}
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-6 bg-gradient-to-t from-black/90 via-black/70 to-transparent px-8 pb-6 pt-16">
          <div className="flex min-w-0 items-end gap-5">
            <span className="font-mono text-6xl font-black leading-none xl:text-8xl">{atual?.senha || '— —'}</span>
            <div className="min-w-0 pb-1">
              <div className="text-sm font-semibold text-fila-300">Chamada atual</div>
              <div className="truncate text-xl font-bold xl:text-3xl">
                {atual ? `${nomeExibido(atual, privacidade)} · ${atual.sala || 'Recepção'}` : 'Aguardando próxima chamada'}
              </div>
            </div>
          </div>
          <div className="hidden items-center gap-3 pb-1 lg:flex">
            <span className="text-xs text-white/60">Próximos</span>
            {proximos.slice(0, 4).map((p) => (
              <span key={p.id} className="rounded-lg bg-white/10 px-3 py-1 font-mono text-2xl font-bold text-white">
                {p.senha}
              </span>
            ))}
          </div>
        </div>

        {/* Aviso de nova chamada em tela cheia */}
        {aviso && atual && (
          <div className="absolute inset-0 flex animate-in fade-in flex-col justify-center bg-slate-950/95 p-10 duration-300">
            <BlocoChamada atual={atual} privacidade={privacidade} pulsando={pulsando} compacto={false} />
          </div>
        )}
      </div>
    );
  }

  // ---------- Layout 2: vídeo à esquerda, painel de chamadas à direita ----------
  if (lateral) {
    return (
      <div style={raiz} onClick={aoClicar} className="relative flex h-screen select-none flex-col gap-4 overflow-hidden bg-slate-950 p-5 text-white">
        {faixaOffline}
        <header className="flex items-center justify-between gap-4 border-b border-white/15 pb-4">
          {titulo}
          {controles}
        </header>
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-5">
          <div className="min-h-0 overflow-hidden rounded-lg border border-white/10 bg-black">
            <TvVideo playlist={midias} muted={config?.tv_video_mudo ?? true} duck={pulsando} className="h-full w-full" fit="contain" />
          </div>
          <div className="flex min-h-0 flex-col justify-between gap-4 overflow-hidden">
            <div className="my-auto py-2">
              <BlocoChamada atual={atual} privacidade={privacidade} pulsando={pulsando} compacto />
            </div>
            <Rodape recentes={recentes} proximos={proximos} privacidade={privacidade} compacto />
          </div>
        </div>
      </div>
    );
  }

  // ---------- Layout 3: vídeo pequeno (sempre 16:9) e senha gigante ----------
  if (compacto) {
    return (
      <div style={raiz} onClick={aoClicar} className="relative flex min-h-screen select-none flex-col gap-4 bg-slate-950 p-5 text-white lg:h-screen lg:overflow-hidden">
        {faixaOffline}
        <header className="flex items-center justify-between gap-4 border-b border-white/15 pb-4">
          {titulo}
          {controles}
        </header>
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_clamp(20rem,28vw,38rem)]">
          <ChamadaDestaque atual={atual} privacidade={privacidade} pulsando={pulsando} />
          <div className="flex min-h-0 flex-col gap-3">
            <div className="aspect-video w-full shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black">
              <TvVideo playlist={midias} muted={config?.tv_video_mudo ?? true} duck={pulsando} className="h-full w-full" fit="contain" />
            </div>
            <ListasGrandes recentes={recentes} proximos={proximos} privacidade={privacidade} />
          </div>
        </div>
      </div>
    );
  }

  // ---------- Sem vídeos: chamada em destaque absoluto ----------
  return (
    <div style={raiz} onClick={aoClicar} className="relative flex min-h-screen select-none flex-col justify-between overflow-hidden bg-slate-950 p-6 text-white md:p-10">
      {faixaOffline}
      <header className="flex items-center justify-between gap-4 border-b border-white/15 pb-5">
        {titulo}
        {controles}
      </header>
      <main className="my-auto py-8">
        <BlocoChamada atual={atual} privacidade={privacidade} pulsando={pulsando} compacto={false} />
      </main>
      <footer className="border-t border-white/15 pt-6">
        <Rodape recentes={recentes} proximos={proximos} privacidade={privacidade} compacto={false} />
      </footer>
    </div>
  );
}
