import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useFilaConfig } from '@/hooks/useFilaConfig';
import { imprimirCupom } from '@/lib/filaCupom';
import type { AbaConfigProps } from './tipos';

const FUSOS_BR = [
  'America/Sao_Paulo',
  'America/Manaus',
  'America/Belem',
  'America/Fortaleza',
  'America/Recife',
  'America/Bahia',
  'America/Cuiaba',
  'America/Campo_Grande',
  'America/Porto_Velho',
  'America/Rio_Branco',
  'America/Noronha',
];

/** Cupom térmico, numeração das senhas e fuso horário do "dia" da fila. */
export default function CupomTab({ valor, alterar, somenteLeitura }: AbaConfigProps) {
  const { logoUrl } = useFilaConfig();
  const fusos = FUSOS_BR.includes(valor.fusoHorario) ? FUSOS_BR : [valor.fusoHorario, ...FUSOS_BR];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Largura do papel</Label>
          <Select value={valor.cupomLarguraMm} onValueChange={(v) => alterar({ cupomLarguraMm: v as '58' | '80' })} disabled={somenteLeitura}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="58">58 mm</SelectItem>
              <SelectItem value="80">80 mm</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center justify-between gap-3 rounded-lg border p-3 sm:mt-5">
          <span className="text-sm font-medium">Logotipo no cupom (preto e branco)</span>
          <Switch checked={valor.cupomLogo} onCheckedChange={(v) => alterar({ cupomLogo: v })} disabled={somenteLeitura} />
        </label>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Mensagem do rodapé</Label>
        <Input value={valor.cupomRodape} onChange={(e) => alterar({ cupomRodape: e.target.value })} maxLength={120} disabled={somenteLeitura} />
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() =>
          imprimirCupom({
            clinica: valor.nomeExibicao || 'Clínica Veterinária',
            logoUrl: valor.cupomLogo ? logoUrl : null,
            rodape: valor.cupomRodape,
            larguraMm: Number(valor.cupomLarguraMm),
            senha: 'A014',
            servico: 'Consulta',
            tutor: 'Carlos Alberto',
            pet: 'Thor',
            prioridade: 'NORMAL',
          })
        }
      >
        <Printer className="h-4 w-4" />
        Imprimir cupom de teste
      </Button>

      <div className="space-y-3 rounded-lg border p-3">
        <h4 className="text-sm font-semibold">Numeração das senhas</h4>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { diaria: true, titulo: 'Reinicia todo dia', texto: 'A001 volta a existir amanhã. Senhas esquecidas na fila de ontem continuam contando para não repetir número.' },
            { diaria: false, titulo: 'Contínua', texto: 'A numeração nunca reinicia. Útil só se a clínica quer um número único para sempre.' },
          ].map((opcao) => (
            <button
              key={opcao.titulo}
              type="button"
              disabled={somenteLeitura}
              onClick={() => alterar({ numeracaoDiaria: opcao.diaria })}
              className={`rounded-lg border p-3 text-left transition ${valor.numeracaoDiaria === opcao.diaria ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50'}`}
            >
              <p className="text-sm font-semibold">{opcao.titulo}</p>
              <p className="mt-1 text-xs text-muted-foreground">{opcao.texto}</p>
            </button>
          ))}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Fuso horário do &quot;dia&quot; da fila</Label>
          <Select value={valor.fusoHorario} onValueChange={(v) => alterar({ fusoHorario: v })} disabled={somenteLeitura}>
            <SelectTrigger className="sm:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {fusos.map((fuso) => (
                <SelectItem key={fuso} value={fuso}>
                  {fuso.replace('America/', '').replace(/_/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">Impressão sem janela de confirmação</p>
        <p className="mt-1">
          Defina a impressora térmica como padrão do computador e abra o navegador do totem com <code className="rounded bg-muted px-1">--kiosk --kiosk-printing</code>. O passo a passo está na skill
          sistema-fila-presencial-dashboard.
        </p>
      </div>
    </div>
  );
}
