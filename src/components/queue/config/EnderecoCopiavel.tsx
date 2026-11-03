import { Check, Copy, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

/** Endereço de uma tela da fila (TV, chamador, totem) com botões de copiar e abrir. */
export default function EnderecoCopiavel({ rotulo, caminho }: { rotulo: string; caminho: string }) {
  const [copiado, setCopiado] = useState(false);
  const url = `${window.location.origin}${caminho}`;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error('Não foi possível copiar. Selecione o endereço e copie manualmente.');
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
      <div className="min-w-0">
        <p className="text-xs font-semibold">{rotulo}</p>
        <p className="truncate font-mono text-xs text-muted-foreground">{url}</p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={copiar}>
          {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copiado ? 'Copiado' : 'Copiar'}
        </Button>
        <Button asChild type="button" size="sm" variant="outline" className="h-8 gap-1 text-xs">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir
          </a>
        </Button>
      </div>
    </div>
  );
}
