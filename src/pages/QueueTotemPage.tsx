/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, ChevronRight, MessageCircle, PawPrint, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useFilaConfig } from '@/hooks/useFilaConfig';
import { estiloMarca } from '@/lib/filaCores';
import { imprimirCupom, ROTULO_PRIORIDADE_CUPOM } from '@/lib/filaCupom';
import type { QueuePriority, QueueService } from '@/types/vetbotsModules';

const db = supabase as never as { from: (table: string) => any; rpc: (fn: string, args?: Record<string, unknown>) => any };

const SEGUNDOS_RETORNO = 8;
const SEGUNDOS_OCIOSO = 60;

interface SenhaEmitida {
  senha: string;
  servico: string;
  tutor: string;
  pet: string | null;
  chegadaEm: string;
  avisaPorWhatsapp: boolean;
}

const apenasDigitos = (valor: string) => valor.replace(/\D/g, '');

function mascararTelefone(valor: string): string {
  const d = apenasDigitos(valor).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function traduzirErroTotem(err: unknown): string {
  const msg = (err as { message?: string })?.message || '';
  if (msg.includes('Muitas senhas')) return 'Muitas senhas em pouco tempo. Procure a recepção.';
  if (msg.includes('Serviço indisponível')) return 'Este atendimento está indisponível no momento. Procure a recepção.';
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) return 'Sem conexão. Procure a recepção.';
  return 'Não foi possível emitir a senha. Procure a recepção.';
}

/**
 * Totem de autoatendimento (tablet/touch na entrada). Entra com um login de papel "Totem"
 * (Usuários → papel Totem): ele só emite senha; não lê nem altera mais nada no painel.
 * Quem é da equipe também pode abrir esta tela para testar.
 */
export default function QueueTotemPage() {
  const { papel } = useAuth();
  const { config, logoUrl } = useFilaConfig();
  const ehTotem = papel === 'totem';

  const servicos = useQuery({
    queryKey: ['totem-servicos'],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await db.from('fila_servicos').select('*').eq('ativo', true).order('ordem').order('nome');
      if (error) throw error;
      return (data || []).map((r: any): QueueService => ({ id: r.id, name: r.nome, prefix: r.prefixo, active: r.ativo, order: r.ordem })) as QueueService[];
    },
  });
  const lista = servicos.data ?? [];

  const [etapa, setEtapa] = useState<'escolha' | 'dados' | 'pronto'>('escolha');
  const [servicoId, setServicoId] = useState('');
  const [emergencia, setEmergencia] = useState(false);
  const [preferencial, setPreferencial] = useState(false);
  const [tutor, setTutor] = useState('');
  const [pet, setPet] = useState('');
  const [telefone, setTelefone] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [emitida, setEmitida] = useState<SenhaEmitida | null>(null);
  const [contagem, setContagem] = useState(SEGUNDOS_RETORNO);

  const pedeTelefone = config.totemPedeTelefone && config.whatsappAtivo;
  const nomeClinica = config.nomeExibicao || 'Atendimento';
  const servicoEscolhido = lista.find((s) => s.id === servicoId);
  const servicoEmergencia = lista.find((s) => (s.prefix || s.prefixo) === 'X') ?? lista[0];

  const reiniciar = useCallback(() => {
    setEtapa('escolha');
    setServicoId('');
    setEmergencia(false);
    setPreferencial(false);
    setTutor('');
    setPet('');
    setTelefone('');
    setEmitida(null);
    setEnviando(false);
  }, []);

  // Volta sozinho depois de emitir a senha.
  useEffect(() => {
    if (etapa !== 'pronto') return;
    setContagem(SEGUNDOS_RETORNO);
    const intervalo = window.setInterval(() => setContagem((c) => c - 1), 1000);
    return () => window.clearInterval(intervalo);
  }, [etapa]);
  useEffect(() => {
    if (etapa === 'pronto' && contagem <= 0) reiniciar();
  }, [contagem, etapa, reiniciar]);

  // Tutor que desistiu no meio do formulário: limpa a tela para o próximo (nome não fica exposto).
  useEffect(() => {
    if (etapa !== 'dados') return;
    let relogio = window.setTimeout(reiniciar, SEGUNDOS_OCIOSO * 1000);
    const reiniciarRelogio = () => {
      window.clearTimeout(relogio);
      relogio = window.setTimeout(reiniciar, SEGUNDOS_OCIOSO * 1000);
    };
    window.addEventListener('pointerdown', reiniciarRelogio);
    window.addEventListener('keydown', reiniciarRelogio);
    return () => {
      window.clearTimeout(relogio);
      window.removeEventListener('pointerdown', reiniciarRelogio);
      window.removeEventListener('keydown', reiniciarRelogio);
    };
  }, [etapa, reiniciar]);

  const escolher = (id: string, ehEmergencia: boolean) => {
    setServicoId(id);
    setEmergencia(ehEmergencia);
    setPreferencial(false);
    setEtapa('dados');
  };

  const telefoneValido = !telefone || apenasDigitos(telefone).length >= 10;

  const emitir = async () => {
    if (!tutor.trim() || !telefoneValido || enviando) return;
    const prioridade: QueuePriority = emergencia ? 'emergencia' : preferencial ? 'prioridade' : 'normal';
    const alvo = servicoId || servicoEmergencia?.id;
    if (!alvo) return;

    try {
      setEnviando(true);
      const { data, error } = await db.rpc('adicionar_item_fila', {
        p_servico_id: alvo,
        p_tutor_nome: tutor.trim(),
        p_pet_nome: pet.trim() || null,
        p_prioridade: prioridade,
        p_telefone: pedeTelefone && telefone ? apenasDigitos(telefone) : null,
        p_origem: 'totem',
      });
      if (error) throw error;

      const nomeServico = lista.find((s) => s.id === alvo)?.name || 'Atendimento';
      const dados: SenhaEmitida = {
        senha: data.senha,
        servico: nomeServico,
        tutor: tutor.trim(),
        pet: pet.trim() || null,
        chegadaEm: data.chegada_em,
        avisaPorWhatsapp: !!(pedeTelefone && telefone && data.telefone),
      };
      setEmitida(dados);
      setEtapa('pronto');

      imprimirCupom({
        clinica: nomeClinica,
        logoUrl: config.cupomLogo ? logoUrl : null,
        rodape: config.cupomRodape,
        larguraMm: Number(config.cupomLarguraMm),
        senha: dados.senha,
        servico: dados.servico,
        tutor: dados.tutor,
        pet: dados.pet,
        prioridade: ROTULO_PRIORIDADE_CUPOM[prioridade],
        chegadaEm: dados.chegadaEm,
      });
    } catch (err) {
      // Nunca imprime uma senha que não foi registrada.
      toast.error(traduzirErroTotem(err));
      setEnviando(false);
    }
  };

  const raiz = useMemo(() => estiloMarca(config.corMarca), [config.corMarca]);

  return (
    <div style={raiz} className="flex min-h-screen select-none flex-col justify-between bg-slate-950 p-6 text-white md:p-12">
      <header className="mx-auto max-w-2xl space-y-2 text-center">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="mx-auto mb-2 h-20 object-contain" />
        ) : (
          <span className="mx-auto mb-2 grid h-20 w-20 place-items-center rounded-2xl bg-fila-600 text-white">
            <PawPrint className="h-10 w-10" aria-hidden="true" />
          </span>
        )}
        <h1 className="text-3xl font-black tracking-tight md:text-5xl">{nomeClinica}</h1>
        <p className="text-base text-white/70 md:text-lg">Toque na tela para retirar sua senha de atendimento</p>
      </header>

      {servicos.isError && (
        <main className="mx-auto my-auto max-w-xl rounded-2xl border border-red-400/40 bg-red-500/10 p-8 text-center text-lg">
          Não foi possível carregar os atendimentos. Procure a recepção.
        </main>
      )}

      {!servicos.isError && etapa === 'escolha' && (
        <main className="mx-auto my-auto w-full max-w-4xl py-8">
          {lista.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-slate-900 p-8 text-center text-lg text-white/70">
              Nenhum atendimento disponível no momento. Procure a recepção.
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={() => servicoEmergencia && escolher(servicoEmergencia.id, true)}
                className="mb-6 flex w-full items-center justify-between rounded-2xl bg-red-600 p-6 text-left shadow-lg transition active:scale-[0.99] md:p-8"
              >
                <div className="flex items-center gap-5">
                  <div className="grid h-16 w-16 place-items-center rounded-lg bg-white/20 text-3xl" aria-hidden="true">
                    🚨
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-white/90">Atendimento imediato</span>
                    <h2 className="text-2xl font-black md:text-4xl">EMERGÊNCIA VETERINÁRIA</h2>
                    <p className="mt-1 text-sm text-white/90">Pets com risco à vida, convulsão, trauma grave ou dificuldade respiratória</p>
                  </div>
                </div>
                <ChevronRight className="h-8 w-8 text-white/80" aria-hidden="true" />
              </button>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {lista
                  .filter((s) => s.id !== servicoEmergencia?.id || lista.length === 1)
                  .map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => escolher(s.id, false)}
                      className="group flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900 p-6 text-left shadow transition hover:border-fila-400/60 active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-4">
                        <div className="grid h-12 w-12 place-items-center rounded-xl bg-fila-500/15 text-xl font-bold text-fila-300 transition group-hover:bg-fila-600 group-hover:text-white">
                          {s.prefix}
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-white">{s.name}</h3>
                          <span className="text-xs text-white/60">Toque para retirar a senha</span>
                        </div>
                      </div>
                      <ChevronRight className="h-6 w-6 text-white/40 transition group-hover:text-fila-300" aria-hidden="true" />
                    </button>
                  ))}
              </div>
            </>
          )}
        </main>
      )}

      {etapa === 'dados' && (
        <main className="mx-auto my-auto w-full max-w-xl space-y-6 rounded-2xl border border-white/10 bg-slate-900 p-8 shadow-lg">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <button type="button" onClick={reiniciar} className="flex items-center gap-2 rounded-lg px-3 py-2 text-white/80 hover:bg-white/10">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Voltar
            </button>
            <span className={`rounded-full px-4 py-1 text-sm font-semibold ${emergencia ? 'bg-red-500/20 text-red-200' : 'bg-fila-500/15 text-fila-300'}`}>
              {emergencia ? 'Emergência' : servicoEscolhido?.name}
            </span>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-bold">Nome do tutor (responsável) *</span>
              <input
                value={tutor}
                onChange={(e) => setTutor(e.target.value)}
                placeholder="Ex.: Carlos Alberto"
                maxLength={120}
                autoFocus
                className="h-14 w-full rounded-xl border border-white/20 bg-slate-800 px-4 text-lg text-white outline-none placeholder:text-white/30 focus:border-fila-400"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold">Nome do pet (opcional)</span>
              <input
                value={pet}
                onChange={(e) => setPet(e.target.value)}
                placeholder="Ex.: Thor, Mel, Bob"
                maxLength={120}
                className="h-14 w-full rounded-xl border border-white/20 bg-slate-800 px-4 text-lg text-white outline-none placeholder:text-white/30 focus:border-fila-400"
              />
            </label>

            {pedeTelefone && (
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-sm font-bold">
                  <MessageCircle className="h-4 w-4 text-fila-300" aria-hidden="true" />
                  WhatsApp para avisar quando for sua vez (opcional)
                </span>
                <input
                  value={telefone}
                  onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
                  placeholder="(41) 99999-0000"
                  inputMode="tel"
                  className="h-14 w-full rounded-xl border border-white/20 bg-slate-800 px-4 text-lg text-white outline-none placeholder:text-white/30 focus:border-fila-400"
                />
                {!telefoneValido && <span className="mt-1 block text-sm text-amber-300">Informe o DDD e o número, ou deixe em branco.</span>}
              </label>
            )}

            {!emergencia && (
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-slate-800 p-4">
                <input type="checkbox" checked={preferencial} onChange={(e) => setPreferencial(e.target.checked)} className="h-6 w-6 accent-[rgb(var(--fila-500))]" />
                <span className="text-sm font-medium text-white/85">Atendimento preferencial (Lei 10.048: 60+ anos, gestantes, PCD ou colo)</span>
              </label>
            )}
          </div>

          <button
            type="button"
            disabled={!tutor.trim() || !telefoneValido || enviando}
            onClick={emitir}
            className="flex h-16 w-full items-center justify-center gap-3 rounded-xl bg-fila-600 text-xl font-bold text-white transition enabled:hover:bg-fila-500 enabled:active:scale-[0.99] disabled:opacity-40"
          >
            <Printer className="h-6 w-6" aria-hidden="true" />
            {enviando ? 'Emitindo...' : 'Emitir senha agora'}
          </button>
        </main>
      )}

      {etapa === 'pronto' && emitida && (
        <main className="mx-auto my-auto w-full max-w-md space-y-6 rounded-2xl border-2 border-fila-400/50 bg-slate-900 p-8 text-center shadow-lg">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-fila-500/15 text-fila-300">
            <CheckCircle2 className="h-10 w-10" aria-hidden="true" />
          </div>
          <div>
            <span className="text-xs font-bold text-white/60">Senha gerada com sucesso</span>
            <div className="mt-2 font-mono text-7xl font-black">{emitida.senha}</div>
            <p className="mt-1 text-lg font-bold text-fila-300">{emitida.servico}</p>
          </div>
          <div className="space-y-1 rounded-lg bg-slate-800 p-4 text-left text-sm text-white/80">
            <div>
              <strong>Tutor:</strong> {emitida.tutor}
            </div>
            {emitida.pet && (
              <div>
                <strong>Pet:</strong> {emitida.pet}
              </div>
            )}
            <div className="border-t border-white/10 pt-2 text-xs text-white/60">
              {emitida.avisaPorWhatsapp
                ? 'Avisaremos pelo WhatsApp. Retire o cupom impresso e aguarde a chamada no telão.'
                : 'Retire seu cupom impresso e aguarde a chamada no telão da TV.'}
            </div>
          </div>
          <div className="text-xs text-white/60">Voltando à tela inicial em {Math.max(contagem, 0)} segundos...</div>
          <button type="button" onClick={reiniciar} className="h-12 w-full rounded-xl border border-fila-400/60 font-semibold text-fila-300 hover:bg-fila-500/10">
            Concluir e voltar ao início
          </button>
        </main>
      )}

      <footer className="text-center text-xs text-white/40">
        {!ehTotem ? (
          <Link to="/queue" className="underline hover:text-white/70">
            Sair do modo totem (voltar à fila)
          </Link>
        ) : (
          'Autoatendimento'
        )}
      </footer>
    </div>
  );
}
