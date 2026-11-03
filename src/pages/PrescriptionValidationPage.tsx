import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  Clock,
  CheckCircle2,
  Stethoscope,
  Pill,
  QrCode,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ROTULO_MODALIDADE_ASSINATURA, type ModalidadeAssinatura } from '@/lib/receituarioPdf';

interface DadosReceitaValidada {
  valida: boolean;
  motivo?: string;
  status?: string;
  codigo_verificacao?: string;
  clinica?: string;
  veterinario_nome?: string;
  veterinario_crmv?: string;
  modalidade_assinatura?: ModalidadeAssinatura;
  hash_sha256?: string;
  assinado_em?: string;
  paciente?: {
    nome: string;
    especie: string;
    raca?: string | null;
    peso_kg: number;
    tutor_mascarado: string;
  };
  itens_prescricao?: Array<{
    nome_comercial_sugerido: string;
    principio_ativo: string;
    posologia: {
      quantidade_por_tomada: string;
      frequencia_horas: number;
      duracao_dias: number;
    };
    orientacoes_tutor: string;
  }>;
  cronograma?: Array<{
    horario: string;
    rotulo_periodo: string;
    itens: Array<{
      nome_exibicao: string;
      quantidade_por_tomada: string;
      rotulo_alimentar: string;
    }>;
  }>;
}

const db = supabase as unknown as {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: any }>;
};

export default function PrescriptionValidationPage() {
  const { codigo: codigoRota } = useParams();
  const [codigoInput, setCodigoInput] = useState<string>(codigoRota || '');
  const [carregando, setCarregando] = useState<boolean>(false);
  const [resultado, setResultado] = useState<DadosReceitaValidada | null>(null);

  const consultarCodigo = useCallback(async (cod: string) => {
    const limpo = cod.trim().toUpperCase();
    if (limpo.length < 6) return;
    setCarregando(true);
    try {
      const { data, error } = await db.rpc('validar_receita_publica', { p_codigo: limpo });
      if (error || !data) {
        setResultado({
          valida: false,
          motivo: 'Não foi possível verificar o código no momento ou a receita ainda não foi registrada.',
        });
      } else {
        setResultado(data as DadosReceitaValidada);
      }
    } catch {
      setResultado({
        valida: false,
        motivo: 'Falha ao consultar autenticidade da receita.',
      });
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (codigoRota) {
      setCodigoInput(codigoRota);
      consultarCodigo(codigoRota);
    }
  }, [codigoRota, consultarCodigo]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    consultarCodigo(codigoInput);
  };

  return (
    <main className="min-h-dvh bg-slate-50 dark:bg-slate-950 py-8 px-4">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-600 text-white shadow">
            <Stethoscope className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">
              Validar receita veterinária
            </h1>
            <p className="text-xs text-muted-foreground">
              Para tutores e farmácias conferirem se a receita foi emitida pela clínica. Dados pessoais aparecem mascarados.
            </p>
          </div>
        </div>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <QrCode className="h-4 w-4 text-teal-600" aria-hidden="true" />
              Consultar Código de Verificação
            </CardTitle>
            <CardDescription className="text-xs">
              Informe o código impresso no topo ou abaixo do QR Code do receituário (ex.: RX-2026-XXXXXX).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1">
                <Label htmlFor="codigo-verificacao-input" className="sr-only">
                  Código de verificação
                </Label>
                <Input
                  id="codigo-verificacao-input"
                  name="codigo"
                  value={codigoInput}
                  onChange={(e) => setCodigoInput(e.target.value.toUpperCase())}
                  placeholder="RX-2026-XXXXXX"
                  className="font-mono uppercase"
                  autoCorrect="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  required
                />
              </div>
              <Button type="submit" disabled={carregando} className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5">
                <Search className="h-4 w-4" aria-hidden="true" />
                {carregando ? 'Verificando...' : 'Validar Receita'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {resultado && (
          <Card
            className={`border-2 shadow-sm ${
              resultado.valida ? 'border-emerald-500' : 'border-amber-400'
            }`}
          >
            <CardContent className="p-5 space-y-4">
              {resultado.valida ? (
                <>
                  <div className="flex items-start justify-between gap-3 border-b pb-3">
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="h-7 w-7 text-emerald-600 shrink-0" aria-hidden="true" />
                      <div>
                        <h2 className="text-sm font-extrabold text-emerald-800 dark:text-emerald-300 uppercase">
                          Receita autêntica, registrada pela clínica
                        </h2>
                        <p className="text-xs text-muted-foreground">
                          Emitido por <strong>{resultado.clinica}</strong> em{' '}
                          {resultado.assinado_em
                            ? new Date(resultado.assinado_em).toLocaleString('pt-BR')
                            : ''}
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-emerald-600 text-white font-mono">
                      {resultado.codigo_verificacao}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-muted/40 rounded-lg p-3 border">
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                        Médico(a) Veterinário(a) Responsável
                      </span>
                      <strong className="text-sm">{resultado.veterinario_nome}</strong>
                      <span className="block font-mono text-teal-700">{resultado.veterinario_crmv}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                        Paciente & Tutor (Mascarado LGPD)
                      </span>
                      <strong className="text-sm">
                        {resultado.paciente?.nome} ({resultado.paciente?.peso_kg} kg •{' '}
                        {resultado.paciente?.especie})
                      </strong>
                      <span className="block text-muted-foreground">
                        Tutor: {resultado.paciente?.tutor_mascarado}
                      </span>
                    </div>
                  </div>

                  {Array.isArray(resultado.itens_prescricao) && resultado.itens_prescricao.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-teal-700 flex items-center gap-1.5">
                        <Pill className="h-3.5 w-3.5" aria-hidden="true" />
                        Medicamentos Prescritos e Validados
                      </h3>
                      {resultado.itens_prescricao.map((it, idx) => (
                        <div key={idx} className="rounded-lg border p-3 text-xs space-y-1 bg-background">
                          <div className="font-bold text-foreground">
                            {idx + 1}. {it.nome_comercial_sugerido} ({it.principio_ativo})
                          </div>
                          <div className="font-medium text-teal-800 dark:text-teal-300">
                            Posologia: {it.posologia.quantidade_por_tomada} a cada {it.posologia.frequencia_horas}h por{' '}
                            {it.posologia.duracao_dias} dias
                          </div>
                          <div className="text-muted-foreground">{it.orientacoes_tutor}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {Array.isArray(resultado.cronograma) && resultado.cronograma.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-teal-700 flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        Grade de Horários para o Tutor
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {resultado.cronograma.map((slot) => (
                          <div key={slot.horario} className="rounded border p-2.5 text-xs bg-background">
                            <div className="font-bold text-teal-700">
                              {slot.horario} ({slot.rotulo_periodo})
                            </div>
                            {slot.itens.map((item, i) => (
                              <div key={i} className="text-[11px] mt-1">
                                <strong>{item.nome_exibicao}:</strong> {item.quantidade_por_tomada} (
                                {item.rotulo_alimentar})
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="rounded border bg-slate-900 text-slate-200 p-2.5 font-mono text-[10px] break-all space-y-1">
                    <div className="flex items-center gap-1 text-emerald-400 font-sans font-semibold text-[11px]">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      {resultado.modalidade_assinatura
                        ? ROTULO_MODALIDADE_ASSINATURA[resultado.modalidade_assinatura]
                        : 'Registrada no sistema com código de verificação'}
                    </div>
                    <div>Hash SHA-256: {resultado.hash_sha256}</div>
                  </div>
                </>
              ) : (
                <div className="flex items-start gap-3 text-xs">
                  <ShieldAlert className="h-6 w-6 text-amber-600 shrink-0" aria-hidden="true" />
                  <div>
                    <div className="font-bold text-sm text-foreground">
                      Receita não encontrada
                    </div>
                    <p className="text-muted-foreground mt-1">
                      {resultado.motivo ||
                        'Confira o código impresso na receita ou fale com a clínica.'}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
