import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  CircleAlert,
  Loader2,
  MessageCircle,
  Plus,
  QrCode,
  RefreshCw,
  Server,
  Unlink,
  XCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageContainer from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { connectUazapi, disconnectUazapi, getUazapiConnectionStatus, type UazapiConnectionStatus } from '@/services/uazapi';
import { getWebhookUrl } from '@/config/env';
import { toast } from 'sonner';

const Evolution = () => {
  const navigate = useNavigate();

  // ---------------------------------------------------------------------------
  // 1. ESTADO UAZAPI
  // ---------------------------------------------------------------------------
  const [uazStatus, setUazStatus] = useState<UazapiConnectionStatus | null>(null);
  const [uazLoading, setUazLoading] = useState(true);
  const [uazActionLoading, setUazActionLoading] = useState(false);
  const [uazError, setUazError] = useState<string | null>(null);

  const refreshUaz = useCallback(async () => {
    setUazLoading(true);
    setUazError(null);
    try {
      const res = await getUazapiConnectionStatus();
      setUazStatus(res);
      return res;
    } catch {
      setUazError('Não foi possível consultar a instância UAZ agora. Confira os Secrets e tente novamente.');
      return null;
    } finally {
      setUazLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUaz();
  }, [refreshUaz]);

  // Polling automático para UAZAPI enquanto o QR Code estiver visível
  useEffect(() => {
    if (!uazStatus?.qrcode || uazStatus?.connected) return;
    const interval = setInterval(async () => {
      try {
        const res = await getUazapiConnectionStatus();
        if (res.connected) {
          setUazStatus(res);
          toast.success('WhatsApp conectado com sucesso via Uazapi!');
        }
      } catch {
        // Silencioso durante polling
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [uazStatus?.qrcode, uazStatus?.connected]);

  const handleUazConnect = async () => {
    setUazActionLoading(true);
    try {
      // Dispara POST /instance/connect com body: {}
      const res = await connectUazapi();
      setUazStatus(res);
      if (res.connected) {
        toast.success('Instância Uazapi já está conectada!');
      } else if (res.qrcode) {
        toast.info('QR Code gerado. Aponte a câmera do WhatsApp para conectar.');
      }
    } catch (err) {
      toast.error('Erro ao conectar Uazapi: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUazActionLoading(false);
    }
  };

  const handleUazDisconnect = async () => {
    if (!confirm('Deseja realmente desconectar o WhatsApp da instância UAZAPI?')) return;
    setUazActionLoading(true);
    try {
      await disconnectUazapi();
      toast.success('WhatsApp desconectado da UAZAPI.');
      await refreshUaz();
    } catch (err) {
      toast.error('Erro ao desconectar: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUazActionLoading(false);
    }
  };

  const uazConnected = uazStatus?.connected === true;
  const uazUnavailable = !!uazError || uazStatus?.connected === false;

  // ---------------------------------------------------------------------------
  // 2. ESTADO EVOLUTION (LEGADO)
  // ---------------------------------------------------------------------------
  const [evoInstanceName, setEvoInstanceName] = useState('');
  const [evoWebhookPath, setEvoWebhookPath] = useState('');
  const [evoLoading, setEvoLoading] = useState(false);
  const [evoQrCodeData, setEvoQrCodeData] = useState<string | null>(null);
  const [evoConfirmationStatus, setEvoConfirmationStatus] = useState<'waiting' | 'confirmed' | 'failed' | null>(null);
  const evoIntervalRef = useRef<number | null>(null);
  const evoRetryRef = useRef<number>(0);
  const maxRetries = 3;

  useEffect(() => {
    return () => {
      if (evoIntervalRef.current !== null) {
        clearInterval(evoIntervalRef.current);
      }
    };
  }, []);

  const checkEvoConnectionStatus = async () => {
    try {
      const response = await fetch(getWebhookUrl('confirma', '/confirma'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceName: evoInstanceName.trim() }),
      });

      if (response.ok) {
        const text = await response.text();
        let data: { respond?: string };
        try {
          data = JSON.parse(text);
        } catch {
          return;
        }

        if (data?.respond === 'positivo') {
          if (evoIntervalRef.current !== null) {
            clearInterval(evoIntervalRef.current);
            evoIntervalRef.current = null;
          }
          setEvoConfirmationStatus('confirmed');
          evoRetryRef.current = 0;
          toast.success('Conexão estabelecida via Evolution!');
        } else if (data?.respond === 'negativo') {
          evoRetryRef.current += 1;
          if (evoRetryRef.current >= maxRetries) {
            if (evoIntervalRef.current !== null) {
              clearInterval(evoIntervalRef.current);
              evoIntervalRef.current = null;
            }
            setEvoConfirmationStatus('failed');
            evoRetryRef.current = 0;
            toast.error('Falha na conexão da Evolution.');
            void updateEvoQrCode();
          }
        }
      }
    } catch (e) {
      console.error('Erro na checagem Evolution:', e);
    }
  };

  const updateEvoQrCode = async () => {
    try {
      setEvoLoading(true);
      const response = await fetch(getWebhookUrl('atualizarQrCode', '/atualizar-qr-code'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceName: evoInstanceName.trim() }),
      });

      if (response.ok) {
        const blob = await response.blob();
        setEvoQrCodeData(URL.createObjectURL(blob));
        setEvoConfirmationStatus('waiting');
        evoRetryRef.current = 0;

        if (evoIntervalRef.current !== null) {
          clearInterval(evoIntervalRef.current);
        }
        evoIntervalRef.current = window.setInterval(checkEvoConnectionStatus, 10000);
        toast.success('Novo QR Code gerado.');
      }
    } catch (err) {
      toast.error('Erro ao atualizar QR Code Evolution.');
    } finally {
      setEvoLoading(false);
    }
  };

  const handleCreateEvoInstance = async () => {
    if (!evoInstanceName.trim() || !evoWebhookPath.trim()) {
      toast.error('Preencha o nome da instância e o webhook.');
      return;
    }

    setEvoLoading(true);
    setEvoQrCodeData(null);
    setEvoConfirmationStatus(null);
    evoRetryRef.current = 0;

    try {
      const response = await fetch(getWebhookUrl('instanciaEvolution', '/instanciaevolution'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceName: evoInstanceName.trim(),
          webhookPath: evoWebhookPath.trim(),
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        setEvoQrCodeData(URL.createObjectURL(blob));
        setEvoConfirmationStatus('waiting');

        if (evoIntervalRef.current !== null) {
          clearInterval(evoIntervalRef.current);
        }
        evoIntervalRef.current = window.setInterval(checkEvoConnectionStatus, 10000);
        toast.success('Instância Evolution criada! Leia o QR Code.');
      } else {
        throw new Error('Falha na criação da instância Evolution');
      }
    } catch (err) {
      toast.error('Erro ao criar instância Evolution: ' + (err instanceof Error ? err.message : String(err)));
      setEvoConfirmationStatus(null);
    } finally {
      setEvoLoading(false);
    }
  };

  return (
    <PageContainer>
      <div className="mx-auto max-w-2xl" data-tour="evolution-card">
        <Card className="shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-primary">
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
              Conexão WhatsApp
            </CardTitle>
            <CardDescription>
              Escolha o provedor para conectar e parear seu WhatsApp via QR Code.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs defaultValue="uazapi" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="uazapi" className="flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  UAZAPI (Recomendado)
                </TabsTrigger>
                <TabsTrigger value="evolution" className="flex items-center gap-2">
                  <QrCode className="h-4 w-4" />
                  Evolution (Legado)
                </TabsTrigger>
              </TabsList>

              {/* -----------------------------------------------------------
                  ABA UAZAPI
              ------------------------------------------------------------ */}
              <TabsContent value="uazapi" className="space-y-4 pt-3">
                <div className="rounded-lg border bg-muted/30 p-4" aria-live="polite">
                  {uazLoading ? (
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Consultando status da instância UAZAPI…
                    </div>
                  ) : uazConnected ? (
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                        <div>
                          <p className="font-semibold text-emerald-700 dark:text-emerald-300">Instância Conectada</p>
                          <p className="text-sm text-muted-foreground">
                            {uazStatus?.phone ? `Número conectado: +${uazStatus.phone}.` : 'O WhatsApp está autenticado e pronto para envio.'}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleUazDisconnect}
                        disabled={uazActionLoading}
                        className="shrink-0"
                      >
                        <Unlink className="mr-1.5 h-4 w-4" />
                        Desconectar
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <CircleAlert className="mt-0.5 h-5 w-5 text-amber-500" aria-hidden="true" />
                        <div>
                          <p className="font-semibold text-amber-700 dark:text-amber-400">
                            {uazUnavailable ? 'Instância Desconectada' : 'Status pendente'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {uazError || (uazStatus?.label ? `Status: ${uazStatus.label}` : 'Conecte o WhatsApp gerando o QR Code abaixo.')}
                          </p>
                        </div>
                      </div>

                      {uazStatus?.qrcode && (
                        <div className="flex flex-col items-center justify-center p-4 bg-background rounded-lg border shadow-inner">
                          <p className="text-sm font-medium mb-3 text-center">
                            Abra o WhatsApp &gt; Dispositivos Conectados &gt; Conectar Dispositivo:
                          </p>
                          <div className="p-3 bg-white rounded-lg shadow-sm">
                            <img
                              src={uazStatus.qrcode.startsWith('data:') ? uazStatus.qrcode : `data:image/png;base64,${uazStatus.qrcode}`}
                              alt="QR Code WhatsApp Uazapi"
                              className="w-64 h-64 object-contain"
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5 animate-pulse">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Aguardando leitura do código...
                          </p>
                        </div>
                      )}

                      {!uazStatus?.qrcode && (
                        <div className="pt-2">
                          <Button
                            onClick={handleUazConnect}
                            disabled={uazActionLoading || uazLoading}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            {uazActionLoading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Conectando e gerando QR Code...
                              </>
                            ) : (
                              <>
                                <QrCode className="mr-2 h-4 w-4" />
                                Gerar QR Code Uazapi
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    <Button onClick={() => void refreshUaz()} disabled={uazLoading || uazActionLoading} variant="outline" size="sm">
                      <RefreshCw className={`mr-2 h-4 w-4 ${uazLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
                      Atualizar status
                    </Button>
                    {uazStatus?.qrcode && !uazConnected && (
                      <Button onClick={handleUazConnect} disabled={uazActionLoading} variant="ghost" size="sm">
                        Recarregar QR Code
                      </Button>
                    )}
                  </div>
                  <Button onClick={() => navigate('/dashboard')} variant="default" size="sm">
                    Ir para atendimentos
                  </Button>
                </div>
              </TabsContent>

              {/* -----------------------------------------------------------
                  ABA EVOLUTION (LEGADO)
              ------------------------------------------------------------ */}
              <TabsContent value="evolution" className="space-y-4 pt-3">
                {evoQrCodeData ? (
                  <div className="space-y-4">
                    {evoConfirmationStatus === 'confirmed' ? (
                      <div className="p-6 text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
                          <Check className="h-10 w-10 text-emerald-600" aria-hidden="true" />
                        </div>
                        <h3 className="mb-2 text-xl font-medium">WhatsApp Conectado!</h3>
                        <p className="mb-4 text-muted-foreground">
                          Instância <span className="font-semibold">{evoInstanceName}</span> conectada com sucesso.
                        </p>
                        <Button onClick={() => navigate('/dashboard')} className="mt-4">
                          Voltar ao Dashboard
                        </Button>
                      </div>
                    ) : evoConfirmationStatus === 'failed' ? (
                      <div className="p-6 text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                          <XCircle className="h-10 w-10 text-destructive" aria-hidden="true" />
                        </div>
                        <h3 className="mb-2 text-xl font-medium">Falha na Conexão</h3>
                        <p className="mb-4 text-muted-foreground">
                          Não foi possível conectar o WhatsApp na Evolution.
                        </p>
                        <Button onClick={updateEvoQrCode} variant="default" className="mt-4" disabled={evoLoading}>
                          {evoLoading ? (
                            <span className="flex items-center">
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Processando...
                            </span>
                          ) : (
                            <>
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Tentar Novamente
                            </>
                          )}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-4 bg-background rounded-lg border">
                        <p className="text-sm font-medium mb-3 text-center">
                          Aponte a câmera do WhatsApp para conectar:
                        </p>
                        <div className="p-3 bg-white rounded-lg shadow-sm">
                          <img src={evoQrCodeData} alt="QR Code Evolution" className="w-64 h-64 object-contain" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5 animate-pulse">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Aguardando confirmação da Evolution...
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEvoQrCodeData(null);
                            setEvoConfirmationStatus(null);
                          }}
                          className="mt-4"
                        >
                          Voltar
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="evo-instance-name">Nome da Instância</Label>
                      <Input
                        id="evo-instance-name"
                        placeholder="Ex: Atendimento Principal"
                        value={evoInstanceName}
                        onChange={(e) => setEvoInstanceName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="evo-webhook-path">Caminho do Webhook</Label>
                      <Input
                        id="evo-webhook-path"
                        placeholder="Ex: /webhook/atendimento"
                        value={evoWebhookPath}
                        onChange={(e) => setEvoWebhookPath(e.target.value)}
                      />
                    </div>

                    <div className="pt-2">
                      <Button
                        onClick={handleCreateEvoInstance}
                        className="w-full"
                        disabled={evoLoading}
                      >
                        {evoLoading ? (
                          <span className="flex items-center justify-center">
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Criando Instância Evolution...
                          </span>
                        ) : (
                          <>
                            <Plus className="mr-2 h-4 w-4" />
                            Criar Instância e Gerar QR Code
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
};

export default Evolution;
