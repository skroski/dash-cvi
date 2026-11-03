import { useRef, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, Eye, EyeOff, Film, Link2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { LIMITE_VIDEO_MB, useFilaMidias } from '@/hooks/useFilaConfig';
import { TV_LAYOUT_DESCRICAO, TV_LAYOUT_LABEL, type TvLayout } from '@/types/filaConfig';
import EnderecoCopiavel from './EnderecoCopiavel';
import { formatarBytes, type AbaConfigProps } from './tipos';

// Acima disto o aparelho da TV não guarda o vídeo e baixa de novo a cada volta da playlist.
const LIMITE_CACHE_MB = 100;

/** Layout, som, privacidade e playlist de vídeos da TV. */
export default function TvTab({ valor, alterar, somenteLeitura }: AbaConfigProps) {
  const { midias, enviarVideo, adicionarUrl, alternar, mover, remover } = useFilaMidias();
  const entrada = useRef<HTMLInputElement>(null);
  const [progresso, setProgresso] = useState<Record<string, number>>({});
  const [nomeUrl, setNomeUrl] = useState('');
  const [url, setUrl] = useState('');

  const enviar = async (arquivos: FileList | null) => {
    if (!arquivos?.length) return;
    for (const arquivo of Array.from(arquivos)) {
      const chave = `${arquivo.name}-${arquivo.size}`;
      try {
        setProgresso((p) => ({ ...p, [chave]: 0 }));
        await enviarVideo.mutateAsync({ arquivo, onProgress: (pct) => setProgresso((p) => ({ ...p, [chave]: pct })) });
        toast.success(`"${arquivo.name}" enviado.`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `Não foi possível enviar "${arquivo.name}".`);
      } finally {
        setProgresso((p) => {
          const resto = { ...p };
          delete resto[chave];
          return resto;
        });
      }
    }
    if (entrada.current) entrada.current.value = '';
  };

  const adicionarPorUrl = async () => {
    try {
      await adicionarUrl.mutateAsync({ nome: nomeUrl, url });
      setNomeUrl('');
      setUrl('');
      toast.success('Vídeo externo adicionado.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível adicionar a URL.');
    }
  };

  const excluir = async (id: string) => {
    const midia = midias.find((m) => m.id === id);
    if (!midia || !window.confirm(`Excluir o vídeo "${midia.nome}" da playlist?`)) return;
    try {
      await remover.mutateAsync(midia);
      toast.success('Vídeo removido.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível remover.');
    }
  };

  const total = midias.filter((m) => m.ativo).reduce((soma, m) => soma + m.tamanhoBytes, 0);
  const enviandoAgora = Object.entries(progresso);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="text-xs">Layout da TV (vale quando há vídeo ativo)</Label>
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(TV_LAYOUT_LABEL) as TvLayout[]).map((layout) => (
            <button
              key={layout}
              type="button"
              disabled={somenteLeitura}
              onClick={() => alterar({ tvLayout: layout })}
              className={`rounded-lg border p-3 text-left transition ${valor.tvLayout === layout ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50'}`}
            >
              <p className="text-sm font-semibold">{TV_LAYOUT_LABEL[layout]}</p>
              <p className="mt-1 text-xs text-muted-foreground">{TV_LAYOUT_DESCRICAO[layout]}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <span>
            <span className="block text-sm font-medium">Sinal sonoro ao chamar</span>
            <span className="text-xs text-muted-foreground">Padrão; cada TV pode mudar no próprio botão.</span>
          </span>
          <Switch checked={valor.tvSom} onCheckedChange={(v) => alterar({ tvSom: v })} disabled={somenteLeitura} />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <span>
            <span className="block text-sm font-medium">Privacidade (LGPD): só a senha</span>
            <span className="text-xs text-muted-foreground">Aplicada no servidor: os nomes nem chegam à TV.</span>
          </span>
          <Switch checked={valor.tvPrivacidade} onCheckedChange={(v) => alterar({ tvPrivacidade: v })} disabled={somenteLeitura} />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <span>
            <span className="block text-sm font-medium">Mostrar o primeiro nome do tutor</span>
            <span className="text-xs text-muted-foreground">
              A TV é pública (qualquer pessoa com o endereço do projeto consulta). Desligado: só pet e senha.
            </span>
          </span>
          <Switch checked={valor.tvMostrarTutor && !valor.tvPrivacidade} onCheckedChange={(v) => alterar({ tvMostrarTutor: v })} disabled={somenteLeitura || valor.tvPrivacidade} />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <span>
            <span className="block text-sm font-medium">Vídeos mudos</span>
            <span className="text-xs text-muted-foreground">Ligado, o sinal da chamada fica bem audível.</span>
          </span>
          <Switch checked={valor.tvVideoMudo} onCheckedChange={(v) => alterar({ tvVideoMudo: v })} disabled={somenteLeitura} />
        </label>
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <span>
            <span className="block text-sm font-medium">Aviso em tela cheia</span>
            <span className="text-xs text-muted-foreground">Segundos que a chamada ocupa a tela (4 a 60).</span>
          </span>
          <Input
            type="number"
            min={4}
            max={60}
            value={valor.tvAvisoSegundos}
            onChange={(e) => alterar({ tvAvisoSegundos: Math.min(60, Math.max(4, Number(e.target.value) || 12)) })}
            className="h-9 w-20"
            disabled={somenteLeitura}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <Label className="text-xs">Playlist de vídeos ({midias.filter((m) => m.ativo).length} ativos · {formatarBytes(total)})</Label>
            <p className="text-xs text-muted-foreground">MP4 H.264 + AAC é o formato seguro para Smart TVs. Até {LIMITE_VIDEO_MB} MB por vídeo (o plano do Supabase pode limitar menos).</p>
          </div>
          <div>
            <input ref={entrada} type="file" multiple accept="video/mp4,video/webm" className="hidden" onChange={(e) => enviar(e.target.files)} />
            <Button type="button" size="sm" className="gap-1.5" disabled={somenteLeitura || enviandoAgora.length > 0} onClick={() => entrada.current?.click()}>
              <Upload className="h-4 w-4" />
              Enviar vídeos
            </Button>
          </div>
        </div>

        {enviandoAgora.map(([chave, pct]) => (
          <div key={chave} className="space-y-1 rounded-lg border p-2">
            <p className="truncate text-xs">{chave.replace(/-\d+$/, '')}</p>
            <Progress value={pct} className="h-2" />
          </div>
        ))}

        <div className="space-y-1.5">
          {midias.length === 0 && (
            <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">Sem vídeos: a TV mostra só o painel de chamadas.</p>
          )}
          {midias.map((m, i) => (
            <div key={m.id} className={`flex items-center gap-2 rounded-lg border p-2 ${m.ativo ? '' : 'opacity-60'}`}>
              <Film className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{m.nome}</p>
                <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                  <span>{m.urlExterna ? 'URL externa' : formatarBytes(m.tamanhoBytes)}</span>
                  {!m.urlExterna && m.tamanhoBytes > LIMITE_CACHE_MB * 1024 * 1024 && (
                    <span className="inline-flex items-center gap-1 text-amber-600">
                      <AlertTriangle className="h-3 w-3" />
                      acima de {LIMITE_CACHE_MB} MB baixa a cada volta; prefira URL externa
                    </span>
                  )}
                </p>
              </div>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={somenteLeitura || i === 0} onClick={() => mover.mutate({ id: m.id, direcao: -1 })} aria-label="Subir">
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={somenteLeitura || i === midias.length - 1} onClick={() => mover.mutate({ id: m.id, direcao: 1 })} aria-label="Descer">
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={somenteLeitura} onClick={() => alternar.mutate({ id: m.id, ativo: !m.ativo })} aria-label={m.ativo ? 'Pausar' : 'Ativar'} title={m.ativo ? 'Pausar' : 'Ativar'}>
                {m.ativo ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" disabled={somenteLeitura} onClick={() => excluir(m.id)} aria-label="Excluir">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
            <Link2 className="h-3.5 w-3.5" />
            Adicionar por endereço (CDN ou servidor da clínica; não gasta o tráfego do Supabase)
          </p>
          <div className="flex flex-wrap gap-2">
            <Input value={nomeUrl} onChange={(e) => setNomeUrl(e.target.value)} placeholder="Nome" className="h-9 w-40" disabled={somenteLeitura} />
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://.../video.mp4" className="h-9 min-w-[220px] flex-1" disabled={somenteLeitura} />
            <Button type="button" size="sm" variant="outline" disabled={somenteLeitura || !url.trim()} onClick={adicionarPorUrl}>
              Adicionar
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">O servidor do vídeo precisa liberar CORS e aceitar pedidos por partes (Range).</p>
        </div>
      </div>

      <EnderecoCopiavel rotulo="Endereço da TV (abra no navegador da Smart TV; não precisa de login)" caminho="/tv" />
    </div>
  );
}
