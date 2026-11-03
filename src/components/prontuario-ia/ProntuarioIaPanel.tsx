import React, { useState, useEffect, useId } from 'react';
import {
  Mic,
  Square,
  Upload,
  Paperclip,
  FileAudio,
  FileText,
  Image as ImageIcon,
  File as FileIcon,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Save,
  Sparkles,
  Quote,
  ShieldCheck,
  Loader2,
  ExternalLink,
  Trash2,
  Activity,
  Stethoscope,
  ClipboardList,
  BedDouble,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  type AnamnesisData,
  type PhysicalExamData,
  type ProntuarioIaDiagnostico,
  type ProntuarioIaInternacao,
  type ProntuarioIaResult,
  type ProntuarioAnexo,
  type ProntuarioIaPorts,
  TERMO_CONSENTIMENTO_IA_TEXTO,
  TERMO_CONSENTIMENTO_IA_VERSAO,
  TERMO_CONSENTIMENTO_IA_OPERADORES,
} from '@/lib/prontuarioIaCore';
import { useProntuarioIa, useAnexos } from '@/hooks/useProntuarioIa';
import type { ProntuarioIaConfigRow } from '@/services/prontuarioIaAdapters';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Subcomponente: EvidenceTooltip (Seção 9.4) ──────────────────────────────

export function EvidenceTooltip({
  fieldKey,
  evidence,
}: {
  fieldKey: string;
  evidence?: Record<string, string>;
}) {
  const quote = evidence?.[fieldKey];
  if (!quote) return null;

  return (
    <span
      className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-300 border border-amber-500/20"
      title={`Trecho da consulta: "${quote}"`}
    >
      <Quote className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="truncate max-w-[260px]">“{quote}”</span>
    </span>
  );
}

// ─── Subcomponente: RecordingControl (Seção 9.4) ─────────────────────────────

export function RecordingControl({
  disabled,
  isRecording,
  duration,
  consentAccepted,
  onConsentChange,
  onStartRecording,
  onStopRecording,
  onCancelRecording,
  onSelectAudioFile,
}: {
  disabled: boolean;
  isRecording: boolean;
  duration: number;
  consentAccepted: boolean;
  onConsentChange: (checked: boolean) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCancelRecording: () => void;
  onSelectAudioFile: (file: File) => void;
}) {
  const audioInputId = useId();
  const consentId = useId();

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-foreground">
          <Mic className="h-4 w-4 text-primary" aria-hidden="true" />
          Gravar Consulta com IA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Consentimento LGPD e Aviso de Transferência Internacional (Seção 7.2 item 1 — G-09) */}
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3 space-y-2">
          <div className="flex items-start gap-2.5">
            <Checkbox
              id={consentId}
              checked={consentAccepted}
              onCheckedChange={(v) => onConsentChange(Boolean(v))}
              className="mt-0.5"
            />
            <Label
              htmlFor={consentId}
              className="text-xs leading-relaxed text-muted-foreground cursor-pointer font-normal"
            >
              <strong className="text-foreground font-semibold block mb-0.5">
                Consentimento do Tutor &amp; Aviso LGPD ({TERMO_CONSENTIMENTO_IA_VERSAO})
              </strong>
              Confirmo que o tutor foi informado e autorizou a gravação para transcrição e
              estruturação por IA de terceiros ({TERMO_CONSENTIMENTO_IA_OPERADORES}).
            </Label>
          </div>
          <details className="text-[11px] text-muted-foreground pl-6">
            <summary className="cursor-pointer font-medium text-primary hover:underline">
              Ler texto legal completo do termo
            </summary>
            <p className="mt-1.5 leading-relaxed">{TERMO_CONSENTIMENTO_IA_TEXTO}</p>
          </details>
        </div>

        {isRecording ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-destructive/10 border border-destructive/30">
              <span className="absolute inset-0 rounded-full bg-destructive/20 animate-ping" />
              <Mic className="h-8 w-8 text-destructive relative z-10" aria-hidden="true" />
            </div>
            <p
              className="font-mono text-2xl font-black text-foreground"
              aria-live="polite"
            >
              {formatDuration(duration)}
            </p>
            <div className="flex gap-2 w-full">
              <Button
                type="button"
                onClick={onStopRecording}
                className="flex-1 gap-2 font-semibold"
              >
                <Square className="h-4 w-4" aria-hidden="true" />
                Parar e processar
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={onCancelRecording}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Button
              type="button"
              size="lg"
              disabled={disabled || !consentAccepted}
              onClick={onStartRecording}
              className="w-full gap-2 font-bold shadow-sm"
            >
              <Mic className="h-4 w-4" aria-hidden="true" />
              Iniciar gravação da consulta
            </Button>

            <div className="relative flex items-center justify-center py-1">
              <div className="border-t border-border w-full" />
              <span className="shrink-0 whitespace-nowrap bg-card px-2 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                ou enviar áudio gravado
              </span>
              <div className="border-t border-border w-full" />
            </div>

            <div>
              <Label
                htmlFor={audioInputId}
                className={`flex items-center justify-center gap-2 w-full rounded-md border border-dashed border-border px-3 py-2.5 text-xs font-medium transition-colors ${
                  disabled || !consentAccepted
                    ? 'opacity-50 cursor-not-allowed'
                    : 'cursor-pointer hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                <Upload className="h-4 w-4 text-primary" aria-hidden="true" />
                Selecionar áudio (webm, ogg, mp3, m4a, wav)
              </Label>
              <input
                id={audioInputId}
                type="file"
                accept="audio/*"
                disabled={disabled || !consentAccepted}
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    onSelectAudioFile(file);
                    e.target.value = '';
                  }
                }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Subcomponente: ProcessingStatus (Seção 9.4) ─────────────────────────────

export function ProcessingStatus({
  kind,
  errorMessage,
  canRetry,
  onRetry,
  onReset,
}: {
  kind: 'uploading' | 'processing' | 'committing' | 'error';
  errorMessage?: string | null;
  canRetry?: boolean;
  onRetry: () => void;
  onReset: () => void;
}) {
  if (kind === 'error') {
    return (
      <div
        role="alert"
        className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 space-y-3"
      >
        <div className="flex items-start gap-2.5">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1 text-xs">
            <p className="font-bold text-destructive">Não foi possível concluir o processamento</p>
            <p className="text-foreground/90">{errorMessage || 'Erro inesperado.'}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          {canRetry ? (
            <Button type="button" size="sm" variant="default" onClick={onRetry} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Tentar de novo (mesmo áudio)
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="ghost" onClick={onReset}>
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  const label =
    kind === 'uploading'
      ? 'Enviando o áudio com segurança…'
      : kind === 'processing'
      ? 'A IA está ouvindo a consulta e preenchendo o rascunho… (cerca de 30 s)'
      : 'Salvando o prontuário…';

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-3 rounded-lg border border-primary/25 bg-primary/5 p-6 text-center"
    >
      <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden="true" />
      <p className="text-xs font-semibold text-foreground">{label}</p>
      <p className="text-[11px] text-muted-foreground">
        Mantenha esta tela aberta até o rascunho aparecer.
      </p>
    </div>
  );
}

// ─── Subcomponentes de Seção do DraftReview (Seção 9.4) ──────────────────────

export function SectionAnamnese({
  included,
  onToggleInclude,
  value,
  onChange,
  evidence,
}: {
  included: boolean;
  onToggleInclude: (v: boolean) => void;
  value: Partial<AnamnesisData>;
  onChange: (next: Partial<AnamnesisData>) => void;
  evidence?: Record<string, string>;
}) {
  const checkId = useId();
  return (
    <section className="rounded-lg border border-border p-4 space-y-4 bg-card">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id={checkId}
            checked={included}
            onCheckedChange={(v) => onToggleInclude(Boolean(v))}
          />
          <Label htmlFor={checkId} className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer">
            <ClipboardList className="h-4 w-4 text-primary" aria-hidden="true" />
            Anamnese (Incluir no prontuário)
          </Label>
        </div>
        <Badge variant={included ? 'default' : 'secondary'} className="text-[10px]">
          {included ? 'Será salvo' : 'Ignorado'}
        </Badge>
      </div>

      <div className={`space-y-3 ${!included ? 'opacity-45 pointer-events-none' : ''}`}>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">Queixa principal</Label>
            <EvidenceTooltip fieldKey="anamnese.queixa_principal" evidence={evidence} />
          </div>
          <Textarea
            rows={2}
            value={value.queixa_principal ?? ''}
            onChange={(e) => onChange({ ...value, queixa_principal: e.target.value })}
            placeholder="Não mencionado na consulta"
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">Histórico da doença atual (HDA)</Label>
            <EvidenceTooltip fieldKey="anamnese.historico_doenca_atual" evidence={evidence} />
          </div>
          <Textarea
            rows={2}
            value={value.historico_doenca_atual ?? ''}
            onChange={(e) => onChange({ ...value, historico_doenca_atual: e.target.value })}
            placeholder="Não mencionado na consulta"
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">Histórico médico pregresso</Label>
            <EvidenceTooltip fieldKey="anamnese.historico_medico_pregresso" evidence={evidence} />
          </div>
          <Textarea
            rows={2}
            value={value.historico_medico_pregresso ?? ''}
            onChange={(e) => onChange({ ...value, historico_medico_pregresso: e.target.value })}
            placeholder="Não mencionado na consulta"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-1">
              <Label className="text-xs">Vacinação</Label>
              <EvidenceTooltip fieldKey="anamnese.vacinacao" evidence={evidence} />
            </div>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
              value={value.vacinacao ?? ''}
              onChange={(e) =>
                onChange({
                  ...value,
                  vacinacao: (e.target.value || undefined) as AnamnesisData['vacinacao'],
                })
              }
            >
              <option value="">— Não dito —</option>
              <option value="sim">Sim (em dia)</option>
              <option value="nao">Não</option>
            </select>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-1">
              <Label className="text-xs">Apetite</Label>
              <EvidenceTooltip fieldKey="anamnese.apetite" evidence={evidence} />
            </div>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
              value={value.apetite ?? ''}
              onChange={(e) =>
                onChange({
                  ...value,
                  apetite: (e.target.value || undefined) as AnamnesisData['apetite'],
                })
              }
            >
              <option value="">— Não dito —</option>
              <option value="normal">Normal</option>
              <option value="diminuido">Diminuído</option>
              <option value="aumentado">Aumentado</option>
              <option value="anorexia">Anorexia</option>
            </select>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-1">
              <Label className="text-xs">Urina / Fezes</Label>
              <EvidenceTooltip fieldKey="anamnese.urina_fezes" evidence={evidence} />
            </div>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
              value={value.urina_fezes ?? ''}
              onChange={(e) =>
                onChange({
                  ...value,
                  urina_fezes: (e.target.value || undefined) as AnamnesisData['urina_fezes'],
                })
              }
            >
              <option value="">— Não dito —</option>
              <option value="normal">Normal</option>
              <option value="alterada">Alterada</option>
            </select>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SectionExameFisico({
  included,
  onToggleInclude,
  value,
  onChange,
  evidence,
}: {
  included: boolean;
  onToggleInclude: (v: boolean) => void;
  value: Partial<PhysicalExamData>;
  onChange: (next: Partial<PhysicalExamData>) => void;
  evidence?: Record<string, string>;
}) {
  const checkId = useId();
  const parseNumField = (raw: string): number | undefined => {
    if (!raw.trim()) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };

  return (
    <section className="rounded-lg border border-border p-4 space-y-4 bg-card">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id={checkId}
            checked={included}
            onCheckedChange={(v) => onToggleInclude(Boolean(v))}
          />
          <Label htmlFor={checkId} className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer">
            <Activity className="h-4 w-4 text-primary" aria-hidden="true" />
            Exame Físico &amp; Sinais Vitais
          </Label>
        </div>
        <Badge variant={included ? 'default' : 'secondary'} className="text-[10px]">
          {included ? 'Espelha vitais no prontuário' : 'Ignorado'}
        </Badge>
      </div>

      <div className={`space-y-3 ${!included ? 'opacity-45 pointer-events-none' : ''}`}>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Peso (kg)</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              value={value.peso ?? ''}
              onChange={(e) => onChange({ ...value, peso: parseNumField(e.target.value) })}
              placeholder="—"
            />
            <EvidenceTooltip fieldKey="exame_fisico.peso" evidence={evidence} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Temp (°C)</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              value={value.temperatura ?? ''}
              onChange={(e) => onChange({ ...value, temperatura: parseNumField(e.target.value) })}
              placeholder="—"
            />
            <EvidenceTooltip fieldKey="exame_fisico.temperatura" evidence={evidence} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">FC (bpm)</Label>
            <Input
              type="number"
              min="0"
              value={value.fc ?? ''}
              onChange={(e) => onChange({ ...value, fc: parseNumField(e.target.value) })}
              placeholder="—"
            />
            <EvidenceTooltip fieldKey="exame_fisico.fc" evidence={evidence} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">FR (mpm)</Label>
            <Input
              type="number"
              min="0"
              value={value.fr ?? ''}
              onChange={(e) => onChange({ ...value, fr: parseNumField(e.target.value) })}
              placeholder="—"
            />
            <EvidenceTooltip fieldKey="exame_fisico.fr" evidence={evidence} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">TPC (seg)</Label>
            <Input
              type="number"
              step="0.5"
              min="0"
              value={value.tpc ?? ''}
              onChange={(e) => onChange({ ...value, tpc: parseNumField(e.target.value) })}
              placeholder="—"
            />
            <EvidenceTooltip fieldKey="exame_fisico.tpc" evidence={evidence} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-1">
              <Label className="text-xs">Hidratação</Label>
              <EvidenceTooltip fieldKey="exame_fisico.hidratacao" evidence={evidence} />
            </div>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
              value={value.hidratacao ?? ''}
              onChange={(e) =>
                onChange({
                  ...value,
                  hidratacao: (e.target.value || undefined) as PhysicalExamData['hidratacao'],
                })
              }
            >
              <option value="">— Não dito —</option>
              <option value="normal">Normal</option>
              <option value="desidratado">Desidratado</option>
            </select>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-1">
              <Label className="text-xs">Mucosas</Label>
              <EvidenceTooltip fieldKey="exame_fisico.mucosas" evidence={evidence} />
            </div>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
              value={value.mucosas ?? ''}
              onChange={(e) =>
                onChange({
                  ...value,
                  mucosas: (e.target.value || undefined) as PhysicalExamData['mucosas'],
                })
              }
            >
              <option value="">— Não dito —</option>
              <option value="normocoradas">Normocoradas</option>
              <option value="hipocoradas">Hipocoradas</option>
              <option value="congestas">Congestas</option>
              <option value="cianoticas">Cianóticas</option>
              <option value="ictericas">Ictéricas</option>
            </select>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-1">
              <Label className="text-xs">Linfonodos</Label>
              <EvidenceTooltip fieldKey="exame_fisico.linfonodos" evidence={evidence} />
            </div>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
              value={value.linfonodos ?? ''}
              onChange={(e) =>
                onChange({
                  ...value,
                  linfonodos: (e.target.value || undefined) as PhysicalExamData['linfonodos'],
                })
              }
            >
              <option value="">— Não dito —</option>
              <option value="normais">Normais</option>
              <option value="aumentados">Aumentados</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Ausculta cardíaca</Label>
            <Input
              value={value.ausculta_cardiaca ?? ''}
              onChange={(e) => onChange({ ...value, ausculta_cardiaca: e.target.value })}
              placeholder="—"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Ausculta pulmonar</Label>
            <Input
              value={value.ausculta_pulmonar ?? ''}
              onChange={(e) => onChange({ ...value, ausculta_pulmonar: e.target.value })}
              placeholder="—"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Palpação abdominal</Label>
            <Input
              value={value.palpacao_abdominal ?? ''}
              onChange={(e) => onChange({ ...value, palpacao_abdominal: e.target.value })}
              placeholder="—"
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">Outros achados do exame físico</Label>
            <EvidenceTooltip fieldKey="exame_fisico.outros_achados" evidence={evidence} />
          </div>
          <Textarea
            rows={2}
            value={value.outros_achados ?? ''}
            onChange={(e) => onChange({ ...value, outros_achados: e.target.value })}
            placeholder="Não mencionado na consulta"
          />
        </div>
      </div>
    </section>
  );
}

export function SectionDiagnostico({
  included,
  onToggleInclude,
  value,
  hipotesesText,
  onChange,
  onChangeHipotesesText,
  evidence,
}: {
  included: boolean;
  onToggleInclude: (v: boolean) => void;
  value: ProntuarioIaDiagnostico;
  hipotesesText: string;
  onChange: (next: ProntuarioIaDiagnostico) => void;
  onChangeHipotesesText: (txt: string) => void;
  evidence?: Record<string, string>;
}) {
  const checkId = useId();
  return (
    <section className="rounded-lg border border-border p-4 space-y-4 bg-card">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id={checkId}
            checked={included}
            onCheckedChange={(v) => onToggleInclude(Boolean(v))}
          />
          <Label htmlFor={checkId} className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer">
            <Stethoscope className="h-4 w-4 text-primary" aria-hidden="true" />
            Diagnóstico &amp; Conduta Terapêutica
          </Label>
        </div>
        <Badge variant={included ? 'default' : 'secondary'} className="text-[10px]">
          {included ? 'Será salvo' : 'Ignorado'}
        </Badge>
      </div>

      <div className={`space-y-3 ${!included ? 'opacity-45 pointer-events-none' : ''}`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Diagnóstico definitivo</Label>
              <EvidenceTooltip fieldKey="diagnostico.diagnostico_definitivo" evidence={evidence} />
            </div>
            <Input
              value={value.diagnostico_definitivo ?? ''}
              onChange={(e) => onChange({ ...value, diagnostico_definitivo: e.target.value })}
              placeholder="Não mencionado na consulta"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">CID-Vet</Label>
              <EvidenceTooltip fieldKey="diagnostico.cid_vet" evidence={evidence} />
            </div>
            <Input
              value={value.cid_vet ?? ''}
              onChange={(e) => onChange({ ...value, cid_vet: e.target.value })}
              placeholder="—"
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">Hipóteses diagnósticas (uma por linha)</Label>
            <EvidenceTooltip fieldKey="diagnostico.hipoteses_diagnosticas" evidence={evidence} />
          </div>
          <Textarea
            rows={2}
            value={hipotesesText}
            onChange={(e) => onChangeHipotesesText(e.target.value)}
            placeholder="Uma hipótese por linha"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Tratamento / Conduta</Label>
              <EvidenceTooltip fieldKey="diagnostico.tratamento" evidence={evidence} />
            </div>
            <Textarea
              rows={2}
              value={value.tratamento ?? ''}
              onChange={(e) => onChange({ ...value, tratamento: e.target.value })}
              placeholder="—"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Medicamentos citados</Label>
              <EvidenceTooltip fieldKey="diagnostico.medicamentos" evidence={evidence} />
            </div>
            <Textarea
              rows={2}
              value={value.medicamentos ?? ''}
              onChange={(e) => onChange({ ...value, medicamentos: e.target.value })}
              placeholder="—"
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">Observações clínicas</Label>
            <EvidenceTooltip fieldKey="diagnostico.observacoes" evidence={evidence} />
          </div>
          <Textarea
            rows={2}
            value={value.observacoes ?? ''}
            onChange={(e) => onChange({ ...value, observacoes: e.target.value })}
            placeholder="—"
          />
        </div>
      </div>
    </section>
  );
}

export function SectionInternacao({
  included,
  onToggleInclude,
  value,
  onChange,
  evidence,
}: {
  included: boolean;
  onToggleInclude: (v: boolean) => void;
  value: ProntuarioIaInternacao;
  onChange: (next: ProntuarioIaInternacao) => void;
  evidence?: Record<string, string>;
}) {
  const checkId = useId();
  return (
    <section className="rounded-lg border border-amber-500/30 p-4 space-y-4 bg-amber-500/5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id={checkId}
            checked={included}
            onCheckedChange={(v) => onToggleInclude(Boolean(v))}
          />
          <Label htmlFor={checkId} className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer">
            <BedDouble className="h-4 w-4 text-amber-600" aria-hidden="true" />
            Internação Hospitalar Detectada
          </Label>
        </div>
        <Badge variant={included ? 'default' : 'secondary'} className="text-[10px]">
          {included ? 'Upsert em internações' : 'Ignorado'}
        </Badge>
      </div>

      <div className={`space-y-3 ${!included ? 'opacity-45 pointer-events-none' : ''}`}>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">Motivo da internação</Label>
            <EvidenceTooltip fieldKey="internacao.motivo" evidence={evidence} />
          </div>
          <Textarea
            rows={2}
            value={value.motivo ?? ''}
            onChange={(e) => onChange({ ...value, motivo: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Box / Leito</Label>
            <Input
              value={value.box ?? ''}
              onChange={(e) => onChange({ ...value, box: e.target.value })}
              placeholder="Ex.: Box 01"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Previsão de alta</Label>
            <Input
              type="date"
              value={value.previsao_alta ?? ''}
              onChange={(e) => onChange({ ...value, previsao_alta: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Objetos com o pet</Label>
            <Input
              value={value.objetos_com_pet ?? ''}
              onChange={(e) => onChange({ ...value, objetos_com_pet: e.target.value })}
              placeholder="Coleira, manta..."
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Sintomas na entrada</Label>
            <Textarea
              rows={2}
              value={value.sintomas_entrada ?? ''}
              onChange={(e) => onChange({ ...value, sintomas_entrada: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Observações da internação</Label>
            <Textarea
              rows={2}
              value={value.observacoes ?? ''}
              onChange={(e) => onChange({ ...value, observacoes: e.target.value })}
            />
          </div>
        </div>

        {value.eventos && value.eventos.length > 0 ? (
          <div className="rounded-md border border-border bg-background p-3 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {value.eventos.length} evento(s) de monitoramento serão gravados na timeline (fc/fr → frequencia_cardiaca/frequencia_respiratoria):
            </p>
            <ul className="space-y-1 text-xs">
              {value.eventos.map((ev, idx) => (
                <li key={idx} className="flex flex-wrap items-center gap-2 text-muted-foreground">
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {ev.tipo || 'evolucao'}
                  </Badge>
                  <span className="font-medium text-foreground">{ev.descricao || 'Monitoramento'}</span>
                  {ev.temperatura != null && <span>T: {ev.temperatura}°C</span>}
                  {ev.fc != null && <span>FC: {ev.fc} bpm</span>}
                  {ev.fr != null && <span>FR: {ev.fr} mpm</span>}
                  {ev.pressao_sistolica != null && <span>PA: {ev.pressao_sistolica} mmHg</span>}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

// ─── Subcomponente: CommitBar (Seção 9.4) ────────────────────────────────────

export function CommitBar({
  disabled,
  onConfirm,
  onDiscard,
}: {
  disabled: boolean;
  onConfirm: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/40 px-6 py-4 rounded-b-lg">
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden="true" />
        Só o que estiver marcado e revisado será salvo, com data e hora.
      </p>
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" onClick={onDiscard} disabled={disabled}>
          Descartar rascunho
        </Button>
        <Button
          type="button"
          onClick={onConfirm}
          disabled={disabled}
          className="gap-2 font-bold px-6 shadow-sm"
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          Confirmar e salvar no prontuário
        </Button>
      </div>
    </div>
  );
}

// ─── Subcomponente: DraftReview (Seção 9.4) ──────────────────────────────────

export function DraftReview({
  draft,
  isCommitting,
  onConfirmEdited,
  onDiscard,
}: {
  draft: ProntuarioIaResult;
  isCommitting: boolean;
  onConfirmEdited: (edited: ProntuarioIaResult) => void;
  onDiscard: () => void;
}) {
  // Regra de React (Seção 9.4): o rascunho editado vive em estado local do painel.
  // Ao confirmar, envia o objeto editado, nunca o original da IA.
  const [includeAnamnese, setIncludeAnamnese] = useState(Boolean(draft.anamnese));
  const [includeExame, setIncludeExame] = useState(Boolean(draft.exame_fisico));
  const [includeDiagnostico, setIncludeDiagnostico] = useState(Boolean(draft.diagnostico));
  const [includeInternacao, setIncludeInternacao] = useState(Boolean(draft.internacao));

  const [editAnamnese, setEditAnamnese] = useState<Partial<AnamnesisData>>(
    () => ({ ...(draft.anamnese ?? {}) })
  );
  const [editExame, setEditExame] = useState<Partial<PhysicalExamData>>(
    () => ({ ...(draft.exame_fisico ?? {}) })
  );
  const [editDiagnostico, setEditDiagnostico] = useState<ProntuarioIaDiagnostico>(
    () => ({ ...(draft.diagnostico ?? {}) })
  );
  const [hipotesesText, setHipotesesText] = useState<string>(
    () => (draft.diagnostico?.hipoteses_diagnosticas ?? []).join('\n')
  );
  const [editInternacao, setEditInternacao] = useState<ProntuarioIaInternacao>(
    () => ({ ...(draft.internacao ?? {}) })
  );

  useEffect(() => {
    setIncludeAnamnese(Boolean(draft.anamnese));
    setIncludeExame(Boolean(draft.exame_fisico));
    setIncludeDiagnostico(Boolean(draft.diagnostico));
    setIncludeInternacao(Boolean(draft.internacao));
    setEditAnamnese({ ...(draft.anamnese ?? {}) });
    setEditExame({ ...(draft.exame_fisico ?? {}) });
    setEditDiagnostico({ ...(draft.diagnostico ?? {}) });
    setHipotesesText((draft.diagnostico?.hipoteses_diagnosticas ?? []).join('\n'));
    setEditInternacao({ ...(draft.internacao ?? {}) });
  }, [draft]);

  const evidenceEntries = Object.entries(draft._evidence ?? {});

  const handleConfirm = () => {
    const edited: ProntuarioIaResult = {};
    if (draft.transcript) {
      edited.transcript = draft.transcript;
    }
    if (includeAnamnese) {
      edited.anamnese = editAnamnese;
    }
    if (includeExame) {
      edited.exame_fisico = editExame;
    }
    if (includeDiagnostico) {
      const hip = hipotesesText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      edited.diagnostico = {
        ...editDiagnostico,
        hipoteses_diagnosticas: hip.length > 0 ? hip : undefined,
      };
    }
    if (includeInternacao && draft.internacao != null) {
      edited.internacao = editInternacao;
    }
    if (draft._evidence) {
      edited._evidence = draft._evidence;
    }

    onConfirmEdited(edited);
  };

  return (
    <Card className="border-amber-500/35 shadow-sm overflow-hidden">
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-3.5 flex items-start gap-3">
        <Sparkles className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="text-xs leading-relaxed">
          <p className="font-bold text-foreground">
            Rascunho gerado por IA a partir do áudio da consulta — Revisão Humana Obrigatória
          </p>
          <p className="text-muted-foreground">
            Somente o que foi explicitamente dito foi preenchido (campos não ditos foram omitidos).
            Revise e edite cada seção antes de confirmar a gravação no prontuário.
          </p>
        </div>
      </div>

      <CardContent className="p-6 space-y-5">
        {/* Transcrição bruta pesquisável mesmo fechada via <details> nativo (search-hidden-content) */}
        {draft.transcript ? (
          <details className="rounded-lg border border-border bg-muted/30 p-3.5">
            <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-foreground">
              Transcrição bruta da consulta
            </summary>
            <p className="mt-2.5 text-xs whitespace-pre-wrap leading-relaxed text-muted-foreground">
              {draft.transcript}
            </p>
          </details>
        ) : null}

        <SectionAnamnese
          included={includeAnamnese}
          onToggleInclude={setIncludeAnamnese}
          value={editAnamnese}
          onChange={setEditAnamnese}
          evidence={draft._evidence}
        />

        <SectionExameFisico
          included={includeExame}
          onToggleInclude={setIncludeExame}
          value={editExame}
          onChange={setEditExame}
          evidence={draft._evidence}
        />

        <SectionDiagnostico
          included={includeDiagnostico}
          onToggleInclude={setIncludeDiagnostico}
          value={editDiagnostico}
          hipotesesText={hipotesesText}
          onChange={setEditDiagnostico}
          onChangeHipotesesText={setHipotesesText}
          evidence={draft._evidence}
        />

        {/* SectionInternacao só aparece se draft.internacao != null (Seção 9.4) */}
        {draft.internacao != null ? (
          <SectionInternacao
            included={includeInternacao}
            onToggleInclude={setIncludeInternacao}
            value={editInternacao}
            onChange={setEditInternacao}
            evidence={draft._evidence}
          />
        ) : null}

        {evidenceEntries.length > 0 ? (
          <details className="rounded-lg border border-border bg-muted/30 p-3.5">
            <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-foreground">
              Evidências da fala ({evidenceEntries.length} trecho(s) citado(s))
            </summary>
            <div className="mt-3 space-y-1.5 text-xs">
              {evidenceEntries.map(([key, quote]) => (
                <div key={key} className="flex flex-wrap gap-1.5">
                  <span className="font-mono font-semibold text-primary">{key}:</span>
                  <span className="text-muted-foreground italic">“{quote}”</span>
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </CardContent>

      <CommitBar
        disabled={isCommitting}
        onConfirm={handleConfirm}
        onDiscard={onDiscard}
      />
    </Card>
  );
}

// ─── Subcomponentes: UploadAnexoManual & AnexosList (Seção 9.4) ──────────────

export function UploadAnexoManual({
  disabled,
  uploading,
  onSelectFile,
}: {
  disabled: boolean;
  uploading: boolean;
  onSelectFile: (file: File) => void;
}) {
  const inputId = useId();
  return (
    <div>
      <Label
        htmlFor={inputId}
        className={`flex items-center justify-center gap-2 w-full rounded-md border border-dashed border-border px-3 py-2 text-xs font-medium transition-colors ${
          disabled || uploading
            ? 'opacity-50 cursor-not-allowed'
            : 'cursor-pointer hover:bg-accent hover:text-accent-foreground'
        }`}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
        ) : (
          <Paperclip className="h-4 w-4 text-primary" aria-hidden="true" />
        )}
        {uploading ? 'Enviando anexo…' : 'Anexar exame/arquivo manual (PDF, imagem, TXT, áudio)'}
      </Label>
      <input
        id={inputId}
        type="file"
        accept="image/*,application/pdf,text/plain,audio/*"
        disabled={disabled || uploading}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            onSelectFile(f);
            e.target.value = '';
          }
        }}
      />
    </div>
  );
}

function AnexoIcon({ type }: { type: ProntuarioAnexo['type'] }) {
  switch (type) {
    case 'audio':
      return <FileAudio className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />;
    case 'image':
      return <ImageIcon className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden="true" />;
    case 'pdf':
    case 'transcript':
    case 'txt':
      return <FileText className="h-4 w-4 text-amber-600 shrink-0" aria-hidden="true" />;
    default:
      return <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />;
  }
}

export function AnexosList({
  anexos,
  onOpenAnexo,
  onDeleteAudioTranscripts,
}: {
  anexos: ProntuarioAnexo[];
  onOpenAnexo: (anexo: ProntuarioAnexo) => void;
  onDeleteAudioTranscripts?: () => void;
}) {
  const hasAudioOrTranscript = anexos.some(
    (a) => a.type === 'audio' || a.type === 'transcript' || a.origem === 'audio_consulta' || a.origem === 'transcricao'
  );

  if (anexos.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2">
        Nenhum arquivo anexado a este prontuário ainda.
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      <ul className="space-y-1.5">
        {anexos.map((a) => (
          <li
            key={a.id}
            className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <AnexoIcon type={a.type} />
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{a.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {a.origem === 'audio_consulta'
                    ? 'Áudio da consulta'
                    : a.origem === 'transcricao'
                    ? 'Transcrição IA'
                    : 'Upload manual'}{' '}
                  · {new Date(a.uploadedAt).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onOpenAnexo(a)}
              className="h-7 px-2 text-xs gap-1 shrink-0"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              Abrir
            </Button>
          </li>
        ))}
      </ul>

      {hasAudioOrTranscript && onDeleteAudioTranscripts ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onDeleteAudioTranscripts}
          className="w-full text-[11px] text-destructive hover:text-destructive gap-1.5"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          Eliminar áudio e transcrição desta consulta (Direito do Titular LGPD)
        </Button>
      ) : null}
    </div>
  );
}

// ─── Componente Principal: <ProntuarioIaPanel petId recordId? /> (Seção 9.4) ─

export interface ProntuarioIaPanelProps {
  petId: string | null;
  recordId?: string | null;
  anexos?: ProntuarioAnexo[] | null;
  config?: Partial<ProntuarioIaConfigRow> | null;
  ports?: ProntuarioIaPorts;
  consentAlreadyRegistered?: boolean;
  onRegisterConsent?: () => Promise<void>;
  onCommitted?: () => void;
  onAnexoUploaded?: (anexo: ProntuarioAnexo) => void;
  onEliminateAudioTranscript?: () => Promise<void>;
}

export function ProntuarioIaPanel({
  petId,
  recordId,
  anexos: initialAnexos,
  config,
  ports,
  consentAlreadyRegistered = false,
  onRegisterConsent,
  onCommitted,
  onAnexoUploaded,
  onEliminateAudioTranscript,
}: ProntuarioIaPanelProps) {
  const ia = useProntuarioIa(petId, {
    ports,
    config,
    recordId,
    onCommitted,
  });

  const { anexos, getSignedUrl } = useAnexos(
    recordId ?? ia.recordId,
    initialAnexos,
    ia.ports.storage
  );

  const [consentAccepted, setConsentAccepted] = useState(consentAlreadyRegistered);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  useEffect(() => {
    setConsentAccepted(consentAlreadyRegistered);
  }, [consentAlreadyRegistered, petId]);

  const ensureConsentSaved = async () => {
    if (!consentAlreadyRegistered && onRegisterConsent) {
      await onRegisterConsent();
    }
  };

  const handleStartRecording = async () => {
    try {
      await ensureConsentSaved();
      await ia.startRecording();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao registrar consentimento.');
    }
  };

  const handleAudioFile = async (file: File) => {
    try {
      await ensureConsentSaved();
      await ia.processAudioFile(file);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao processar arquivo de áudio.');
    }
  };

  const handleManualAttachment = async (file: File) => {
    setUploadingAttachment(true);
    try {
      const saved = await ia.uploadManualAttachment(file, recordId);
      onAnexoUploaded?.(saved);
      toast.success(`Arquivo "${saved.name}" anexado ao prontuário.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha no upload do anexo.');
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleOpenAnexo = async (anexo: ProntuarioAnexo) => {
    try {
      const url = await getSignedUrl(anexo.url);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível gerar link assinado.');
    }
  };

  const isBusy =
    ia.state.kind === 'uploading' ||
    ia.state.kind === 'processing' ||
    ia.state.kind === 'committing';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Coluna esquerda: Gravação + Anexos */}
      <aside className="lg:col-span-4 space-y-5">
        <RecordingControl
          disabled={!petId || isBusy}
          isRecording={ia.isRecording}
          duration={ia.recordingDuration}
          consentAccepted={consentAccepted}
          onConsentChange={setConsentAccepted}
          onStartRecording={handleStartRecording}
          onStopRecording={() => void ia.stopRecording()}
          onCancelRecording={ia.cancelRecording}
          onSelectAudioFile={handleAudioFile}
        />

        {ia.recordingError ? (
          <div
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{ia.recordingError}</span>
          </div>
        ) : null}

        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-primary" aria-hidden="true" />
              Arquivos da consulta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <UploadAnexoManual
              disabled={!petId || isBusy}
              uploading={uploadingAttachment}
              onSelectFile={handleManualAttachment}
            />
            <AnexosList
              anexos={anexos}
              onOpenAnexo={handleOpenAnexo}
              onDeleteAudioTranscripts={onEliminateAudioTranscript}
            />
          </CardContent>
        </Card>
      </aside>

      {/* Coluna direita: Status de processamento, Revisão do Rascunho ou Sucesso */}
      <main className="lg:col-span-8">
        {ia.state.kind === 'uploading' ||
        ia.state.kind === 'processing' ||
        ia.state.kind === 'committing' ||
        ia.state.kind === 'error' ? (
          <ProcessingStatus
            kind={ia.state.kind}
            errorMessage={ia.state.kind === 'error' ? ia.state.message : null}
            canRetry={ia.hasRetryAudio}
            onRetry={() => void ia.retry()}
            onReset={ia.reset}
          />
        ) : ia.state.kind === 'ready' ? (
          <DraftReview
            draft={ia.state.draft}
            isCommitting={false}
            onConfirmEdited={(edited) => void ia.confirm(edited, recordId)}
            onDiscard={ia.discard}
          />
        ) : ia.state.kind === 'committed' ? (
          <Card className="border-emerald-500/35 bg-emerald-500/5 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-14 text-center space-y-3">
              <CheckCircle2 className="h-12 w-12 text-emerald-600" aria-hidden="true" />
              <h3 className="text-base font-bold text-foreground">
                Prontuário confirmado e atualizado com sucesso
              </h3>
              <p className="text-xs text-muted-foreground max-w-md">
                Os campos revisados, os sinais vitais e a transcrição foram salvos na ficha do pet.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={ia.reset}
                className="mt-2"
              >
                Gravar outra evolução / consulta
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed border-border bg-muted/20 shadow-none">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-2">
              <Mic className="h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
              <p className="text-sm font-semibold text-foreground">
                Grave a consulta para a IA estruturar o rascunho do prontuário
              </p>
              <p className="text-xs text-muted-foreground max-w-lg">
                Regra inviolável: somente o que for dito será preenchido. Campos não mencionados
                permanecem ausentes (nunca inventados). Você revisa tudo antes de salvar.
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

export default ProntuarioIaPanel;
