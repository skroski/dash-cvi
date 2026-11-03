import React, { useState } from 'react';
import { Search, Phone, User, KeyRound, Sparkles, MessageSquare, ArrowRight, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  searchConversationByPhoneAndFirstName,
  searchConversationByCode,
  ChatWebSearchResult,
  persistChatWebSession,
} from '@/services/chatWebSearch';

interface ChatWebFormProps {
  onStartSession: (result: ChatWebSearchResult) => void;
  initialPhone?: string;
  initialFirstName?: string;
  initialCode?: string;
}

// Máscara dinâmica de telefone brasileiro (DDD + 8 ou 9 dígitos)
function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export const ChatWebForm: React.FC<ChatWebFormProps> = ({
  onStartSession,
  initialPhone = '',
  initialFirstName = '',
  initialCode = '',
}) => {
  const [mode, setMode] = useState<'form' | 'code'>(initialCode ? 'code' : 'form');
  const [phone, setPhone] = useState(formatPhoneInput(initialPhone));
  const [firstName, setFirstName] = useState(initialFirstName);
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [isSearching, setIsSearching] = useState(false);
  const [previewResult, setPreviewResult] = useState<ChatWebSearchResult | null>(null);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhoneInput(e.target.value));
    setPreviewResult(null);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Apenas primeiro nome (sem espaços excessivos)
    const cleaned = e.target.value.trimStart();
    setFirstName(cleaned);
    setPreviewResult(null);
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCode(e.target.value.toUpperCase());
    setPreviewResult(null);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'code') {
      const cleanCode = code.trim();
      if (!cleanCode) {
        toast.error('Informe o código do ChatWeb');
        return;
      }
      setIsSearching(true);
      try {
        const res = await searchConversationByCode(cleanCode);
        if (!res) {
          toast.error('Código não encontrado', {
            description: 'Verifique se o código foi digitado corretamente ou inicie pelo telefone do tutor.',
          });
          return;
        }
        setPreviewResult(res);
      } catch {
        toast.error('Erro ao pesquisar código');
      } finally {
        setIsSearching(false);
      }
      return;
    }

    // Validação do micro formulário
    const rawDigits = phone.replace(/\D/g, '');
    if (rawDigits.length < 10) {
      toast.error('Telefone incompleto', {
        description: 'Digite o DDD e o número do celular ou telefone fixo.',
      });
      return;
    }

    const cleanFirstName = firstName.trim();
    if (!cleanFirstName) {
      toast.error('Informe o primeiro nome', {
        description: 'Digite o primeiro nome do tutor como está no WhatsApp.',
      });
      return;
    }

    setIsSearching(true);
    try {
      const result = await searchConversationByPhoneAndFirstName(phone, cleanFirstName);
      setPreviewResult(result);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao realizar busca');
    } finally {
      setIsSearching(false);
    }
  };

  const handleConfirmStart = async () => {
    if (!previewResult) return;
    try {
      await persistChatWebSession({
        code: previewResult.code,
        sessionId: previewResult.sessionId,
        tutorName: previewResult.name,
        phone: previewResult.phone,
        petName: previewResult.petName,
      });
    } catch (err) {
      console.warn('Erro ao persistir sessão:', err);
    }
    onStartSession(previewResult);
  };

  return (
    <div className="mx-auto w-full max-w-lg">
      <Card className="border-border/60 shadow-xl backdrop-blur-sm bg-card/95 transition-all">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner ring-1 ring-primary/20">
            <MessageSquare className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            ChatWeb Clínico
          </CardTitle>
          <CardDescription className="text-sm">
            {mode === 'form'
              ? 'Localize ou inicie uma conversa pelo telefone e primeiro nome no WhatsApp'
              : 'Digite o código da sessão para reabrir a conversa existente'}
          </CardDescription>

          <div className="mt-3 flex justify-center gap-1 rounded-lg bg-muted/60 p-1 text-xs">
            <button
              type="button"
              onClick={() => {
                setMode('form');
                setPreviewResult(null);
              }}
              className={`flex-1 rounded-md py-1.5 font-medium transition-all ${
                mode === 'form'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Telefone e Nome
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('code');
                setPreviewResult(null);
              }}
              className={`flex-1 rounded-md py-1.5 font-medium transition-all ${
                mode === 'code'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Buscar por Código
            </button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-0">
          <form onSubmit={handleSearch} className="space-y-4">
            {mode === 'form' ? (
              <>
                {/* Campo 1: Telefone do Tutor */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-primary" />
                    Telefone do Tutor (WhatsApp)
                  </label>
                  <div className="relative">
                    <Input
                      type="tel"
                      value={phone}
                      onChange={handlePhoneChange}
                      placeholder="(41) 99999-9999"
                      className="h-11 pl-3 text-base font-medium tracking-wide focus-visible:ring-primary"
                      autoFocus
                      required
                    />
                  </div>
                </div>

                {/* Campo 2: Primeiro Nome no WhatsApp */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-primary" />
                    Primeiro Nome no WhatsApp
                  </label>
                  <div className="relative">
                    <Input
                      type="text"
                      value={firstName}
                      onChange={handleNameChange}
                      placeholder="Ex: Carlos, Ana, Daniel"
                      className="h-11 pl-3 text-base focus-visible:ring-primary"
                      required
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Cruza dados do cliente com o perfil do WhatsApp para precisão na busca.
                  </p>
                </div>
              </>
            ) : (
              /* Busca por Código */
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 text-primary" />
                  Código da Conversa ChatWeb
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    value={code}
                    onChange={handleCodeChange}
                    placeholder="Ex: CW-89241"
                    className="h-11 uppercase font-mono tracking-widest text-center text-lg font-bold"
                    autoFocus
                    required
                  />
                </div>
                <p className="text-[11px] text-muted-foreground text-center">
                  Insira o código de atendimento gerado anteriormente.
                </p>
              </div>
            )}

            {!previewResult && (
              <Button
                type="submit"
                className="w-full h-11 text-base font-semibold shadow-md transition-all"
                disabled={isSearching}
              >
                {isSearching ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Buscando conversa...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Buscar Conversa
                  </>
                )}
              </Button>
            )}
          </form>

          {/* Resultado da busca / Preview antes de iniciar */}
          {previewResult && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                  {previewResult.found ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      Histórico / Contato Localizado
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      Nova Conversa Pronta para Início
                    </>
                  )}
                </span>
                <Badge variant="outline" className="font-mono text-xs border-primary/30 text-primary">
                  {previewResult.code}
                </Badge>
              </div>

              <div className="space-y-1 text-sm">
                <div className="font-semibold text-foreground flex items-center justify-between">
                  <span>{previewResult.name}</span>
                  {previewResult.petName && (
                    <Badge variant="secondary" className="text-[11px]">
                      Pet: {previewResult.petName}
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  WhatsApp: <span className="font-mono">{previewResult.phone}</span>
                </div>
                {previewResult.lastMessage && (
                  <div className="mt-2 text-xs italic text-muted-foreground line-clamp-2 rounded bg-background/60 p-2 border border-border/40">
                    "{previewResult.lastMessage}"
                  </div>
                )}
              </div>

              <div className="pt-2 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewResult(null)}
                  className="flex-1"
                >
                  Alterar dados
                </Button>
                <Button
                  size="sm"
                  onClick={handleConfirmStart}
                  className="flex-[2] gap-1.5 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
                >
                  Iniciar Conversa
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
