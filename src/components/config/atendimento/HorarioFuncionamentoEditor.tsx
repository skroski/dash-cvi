import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DIAS_ROTULO, textoHorarioFuncionamento } from '@/lib/horariosTexto';
import type { HorarioFuncionamento } from '@/types/atendimentoConfig';

const PADRAO: HorarioFuncionamento = { dias: [1, 2, 3, 4, 5], abre: '08:00', fecha: '18:00' };

/** Faixas de funcionamento: cada faixa tem os dias da semana e o horário de abrir/fechar. */
export function HorarioFuncionamentoEditor({
  valor, onChange,
}: { valor: HorarioFuncionamento[]; onChange: (valor: HorarioFuncionamento[]) => void }) {
  const alterar = (indice: number, parcial: Partial<HorarioFuncionamento>) =>
    onChange(valor.map((faixa, i) => (i === indice ? { ...faixa, ...parcial } : faixa)));
  const alternarDia = (indice: number, dia: number) => {
    const faixa = valor[indice];
    const dias = faixa.dias.includes(dia) ? faixa.dias.filter((d) => d !== dia) : [...faixa.dias, dia].sort((a, b) => a - b);
    alterar(indice, { dias });
  };

  return (
    <div className="space-y-3">
      {valor.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhuma faixa cadastrada: o assistente dirá que não tem essa informação.</p>
      )}
      {valor.map((faixa, indice) => (
        <div key={indice} className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
          <div className="flex gap-1" role="group" aria-label="Dias da semana">
            {DIAS_ROTULO.map((rotulo, dia) => {
              const ativo = faixa.dias.includes(dia);
              return (
                <button
                  key={dia}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => alternarDia(indice, dia)}
                  className={`h-8 w-11 rounded-md border text-xs font-medium transition-colors ${
                    ativo ? 'border-primary bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {rotulo}
                </button>
              );
            })}
          </div>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Abre</span>
            <Input type="time" className="h-8 w-28" value={faixa.abre.slice(0, 5)} onChange={(e) => alterar(indice, { abre: e.target.value })} />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Fecha</span>
            <Input type="time" className="h-8 w-28" value={faixa.fecha.slice(0, 5)} onChange={(e) => alterar(indice, { fecha: e.target.value })} />
          </label>
          <Button type="button" variant="ghost" size="icon" aria-label="Remover faixa" onClick={() => onChange(valor.filter((_, i) => i !== indice))}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...valor, { ...PADRAO, dias: [] }])}>
        <Plus className="mr-1 h-4 w-4" /> Adicionar faixa
      </Button>
      {valor.length > 0 && (
        <div className="rounded-md bg-muted/50 p-3 text-xs">
          <p className="mb-1 font-medium text-muted-foreground">Como o assistente informa ({'{{horario_funcionamento}}'}):</p>
          <pre className="whitespace-pre-wrap font-sans">{textoHorarioFuncionamento(valor) || 'Marque ao menos um dia em cada faixa.'}</pre>
        </div>
      )}
    </div>
  );
}
