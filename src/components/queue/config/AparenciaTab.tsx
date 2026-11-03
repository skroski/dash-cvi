import { useRef, useState } from 'react';
import { ImageUp, PawPrint, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { enviarLogoFila, removerArquivoFila, useFilaConfig } from '@/hooks/useFilaConfig';
import { CORES_PRONTAS_FILA, estiloMarca, HEX_VALIDO } from '@/lib/filaCores';
import type { AbaConfigProps } from './tipos';

/** Nome, cor da marca e logotipo da TV, do totem e do cupom. */
export default function AparenciaTab({ valor, alterar, somenteLeitura }: AbaConfigProps) {
  const { logoUrl, atualizar } = useFilaConfig();
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [hexDigitado, setHexDigitado] = useState(valor.corMarca);

  const trocarCor = (hex: string) => {
    setHexDigitado(hex);
    if (HEX_VALIDO.test(hex)) alterar({ corMarca: hex.toLowerCase() });
  };

  const enviarLogo = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    const anterior = valor.logoPath;
    try {
      setEnviando(true);
      const path = await enviarLogoFila(arquivo);
      await atualizar.mutateAsync({ logoPath: path });
      alterar({ logoPath: path });
      await removerArquivoFila(anterior);
      toast.success('Logotipo atualizado.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível enviar o logotipo.');
    } finally {
      setEnviando(false);
      if (entrada.current) entrada.current.value = '';
    }
  };

  const removerLogo = async () => {
    const anterior = valor.logoPath;
    try {
      await atualizar.mutateAsync({ logoPath: null });
      alterar({ logoPath: null });
      await removerArquivoFila(anterior);
      toast.success('Logotipo removido.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível remover o logotipo.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Nome exibido na TV, no totem e no cupom</Label>
          <Input
            value={valor.nomeExibicao ?? ''}
            onChange={(e) => alterar({ nomeExibicao: e.target.value || null })}
            placeholder="Vazio = nome da empresa (Configuração do atendimento)"
            maxLength={80}
            disabled={somenteLeitura}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Subtítulo</Label>
          <Input value={valor.subtitulo} onChange={(e) => alterar({ subtitulo: e.target.value })} maxLength={80} disabled={somenteLeitura} />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Cor da marca (TV, totem e botões do totem)</Label>
        <div className="flex flex-wrap items-center gap-2">
          {CORES_PRONTAS_FILA.map((cor) => (
            <button
              key={cor.hex}
              type="button"
              title={cor.nome}
              aria-label={cor.nome}
              disabled={somenteLeitura}
              onClick={() => trocarCor(cor.hex)}
              className={`h-8 w-8 rounded-full border-2 transition ${valor.corMarca === cor.hex ? 'border-foreground' : 'border-transparent hover:border-muted-foreground/50'}`}
              style={{ backgroundColor: cor.hex }}
            />
          ))}
          <input
            type="color"
            value={HEX_VALIDO.test(valor.corMarca) ? valor.corMarca : '#2294aa'}
            onChange={(e) => trocarCor(e.target.value)}
            disabled={somenteLeitura}
            className="h-8 w-10 cursor-pointer rounded border bg-transparent p-0.5"
            aria-label="Escolher outra cor"
          />
          <Input
            value={hexDigitado}
            onChange={(e) => trocarCor(e.target.value)}
            className="h-8 w-28 font-mono text-xs"
            maxLength={7}
            disabled={somenteLeitura}
            aria-label="Código da cor"
          />
        </div>
        <p className="text-xs text-muted-foreground">Os tons claros e escuros são gerados sozinhos, com contraste de leitura garantido.</p>
      </div>

      {/* Prévia: é exatamente a mesma escala que a TV usa. */}
      <div style={estiloMarca(valor.corMarca)} className="rounded-xl bg-slate-950 p-4 text-white">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-9 w-9 object-contain" />
          ) : (
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-fila-600 text-white">
              <PawPrint className="h-5 w-5" />
            </span>
          )}
          <span className="font-bold">{valor.nomeExibicao || 'Nome da clínica'}</span>
          <span className="rounded-full bg-fila-500/15 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-fila-300">{valor.subtitulo}</span>
        </div>
        <div className="mt-3 flex items-end gap-4">
          <span className="font-mono text-5xl font-black leading-none text-white">A014</span>
          <span className="rounded-lg border border-white/10 bg-slate-900 px-3 py-1 text-sm">
            Dirija-se ao <strong className="text-fila-300">Consultório 2</strong>
          </span>
          <span className="rounded-lg bg-fila-600 px-3 py-1 text-sm font-semibold text-white">Emitir senha</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Logotipo (PNG, JPG, WebP ou SVG, até 5 MB; fundo transparente fica melhor)</Label>
        <div className="flex flex-wrap items-center gap-2">
          <input ref={entrada} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => enviarLogo(e.target.files?.[0])} />
          <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={somenteLeitura || enviando} onClick={() => entrada.current?.click()}>
            <ImageUp className="h-4 w-4" />
            {enviando ? 'Enviando...' : logoUrl ? 'Trocar logotipo' : 'Enviar logotipo'}
          </Button>
          {logoUrl && (
            <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-destructive" disabled={somenteLeitura} onClick={removerLogo}>
              <Trash2 className="h-4 w-4" />
              Remover
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
