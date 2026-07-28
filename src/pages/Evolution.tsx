import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, QrCode, Loader2, RefreshCw, Check, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import PageContainer from '@/components/layout/PageContainer';
import { getWebhookUrl } from '@/config/env';

const Evolution = () => {
  const navigate = useNavigate();
  const [instanceName, setInstanceName] = useState('');
  const [webhookPath, setWebhookPath] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [confirmationStatus, setConfirmationStatus] = useState<'waiting' | 'confirmed' | 'failed' | null>(null);
  const statusCheckIntervalRef = useRef<number | null>(null);
  const retryCountRef = useRef<number>(0);
  const maxRetries = 3;
  
  useEffect(() => {
    return () => {
      if (statusCheckIntervalRef.current !== null) {
        clearInterval(statusCheckIntervalRef.current);
      }
    };
  }, []);
  
  const checkConnectionStatus = async () => {
    try {
      console.log('Checking connection status for:', instanceName);
      const response = await fetch(getWebhookUrl('confirma', '/confirma'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          instanceName: instanceName.trim() 
        }),
      });
      
      if (response.ok) {
        const responseText = await response.text();
        console.log('Connection status response:', responseText);
        
        let responseData;
        
        try {
          responseData = JSON.parse(responseText);
          console.log('Parsed response data:', responseData);
        } catch (parseError) {
          console.error('Error parsing response JSON:', parseError);
          toast.error("Erro no formato da resposta", { description: "Não foi possível processar a resposta do servidor." });
          return;
        }
        
        if (responseData && typeof responseData.respond === 'string') {
          const status = responseData.respond;
          console.log('Response status value:', status);
          
          if (status === "positivo") {
            console.log('Connection confirmed - stopping interval');
            if (statusCheckIntervalRef.current !== null) {
              clearInterval(statusCheckIntervalRef.current);
              statusCheckIntervalRef.current = null;
            }
            setConfirmationStatus('confirmed');
            retryCountRef.current = 0; // Reset retry counter on success
            toast.success("Conexão estabelecida!", { description: "Seu WhatsApp foi conectado com sucesso." });
          } else if (status === "negativo") {
            retryCountRef.current += 1;
            console.log(`Connection failed - attempt ${retryCountRef.current} of ${maxRetries}`);
            
            if (retryCountRef.current >= maxRetries) {
              console.log('Maximum retry attempts reached - updating QR code');
              if (statusCheckIntervalRef.current !== null) {
                clearInterval(statusCheckIntervalRef.current);
                statusCheckIntervalRef.current = null;
              }
              setConfirmationStatus('failed');
              retryCountRef.current = 0; // Reset retry counter
              toast.error("Falha na conexão", { description: "Não foi possível conectar após várias tentativas. Obtendo novo QR code..." });
              updateQrCode(); // Automatically get a new QR code
            } else {
              console.log(`Retrying... (${retryCountRef.current}/${maxRetries})`);
              toast.success("Tentando novamente", { description: `Tentativa ${retryCountRef.current} de ${maxRetries}` });
            }
          } else {
            console.log('Unknown status value:', status);
            toast.error("Status desconhecido", { description: "Recebemos uma resposta inesperada do servidor." });
          }
        } else {
          console.log('Response does not have a valid respond property:', responseData);
          toast.error("Formato inesperado", { description: "A resposta do servidor não está no formato esperado." });
        }
      } else {
        console.error('Erro ao verificar status:', await response.text());
        toast.error("Erro na verificação", { description: "Não foi possível verificar o status da conexão." });
      }
    } catch (error) {
      console.error('Erro ao verificar status da conexão:', error);
      toast.error("Erro de conexão", { description: "Ocorreu um erro ao verificar o status da conexão." });
    }
  };
  
  const updateQrCode = async () => {
    try {
      setIsLoading(true);
      console.log('Updating QR code for instance:', instanceName);
      const response = await fetch(getWebhookUrl('atualizarQrCode', '/atualizar-qr-code'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          instanceName: instanceName.trim() 
        }),
      });
      
      console.log('QR code update response status:', response.status);
      
      if (response.ok) {
        const blob = await response.blob();
        console.log('Received blob content type:', blob.type);
        
        const qrCodeUrl = URL.createObjectURL(blob);
        setQrCodeData(qrCodeUrl);
        setConfirmationStatus('waiting');
        retryCountRef.current = 0; // Reset retry counter when getting new QR code
        console.log('QR code updated successfully');
        
        if (statusCheckIntervalRef.current !== null) {
          clearInterval(statusCheckIntervalRef.current);
        }
        
        console.log('Starting new polling interval');
        statusCheckIntervalRef.current = window.setInterval(() => {
          checkConnectionStatus();
        }, 10000);
        
        toast.success("QR Code atualizado", { description: "Escaneie o novo QR code para conectar seu WhatsApp." });
      } else {
        const errorText = await response.text();
        console.error('Falha ao atualizar QR code:', errorText);
        toast.error("Erro", { description: "Não foi possível atualizar o QR code. Tente novamente." });
      }
    } catch (error) {
      console.error('Erro ao atualizar QR code:', error);
      toast.error("Erro", { description: "Ocorreu um erro ao atualizar o QR code." });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCreateInstance = async () => {
    if (!instanceName.trim()) {
      toast.error("Nome obrigatório", { description: "Por favor, informe um nome para a instância." });
      return;
    }

    if (!webhookPath.trim()) {
      toast.error("Caminho do webhook obrigatório", { description: "Por favor, informe o caminho do webhook." });
      return;
    }

    setIsLoading(true);
    setQrCodeData(null);
    setConfirmationStatus(null);
    retryCountRef.current = 0; // Reset retry counter for new instance creation
    
    try {
      console.log('Creating instance:', { instanceName, webhookPath });
      const response = await fetch(getWebhookUrl('instanciaEvolution', '/instanciaevolution'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          instanceName: instanceName.trim(),
          webhookPath: webhookPath.trim()
        }),
      });
      
      console.log('Create instance response status:', response.status);
      
      if (response.ok) {
        const blob = await response.blob();
        console.log('Received blob content type:', blob.type);
        
        const qrCodeUrl = URL.createObjectURL(blob);
        setQrCodeData(qrCodeUrl);
        setConfirmationStatus('waiting');
        
        if (statusCheckIntervalRef.current !== null) {
          clearInterval(statusCheckIntervalRef.current);
        }
        
        console.log('Starting status checking interval');
        statusCheckIntervalRef.current = window.setInterval(() => {
          checkConnectionStatus();
        }, 10000);
        
        toast.success("Instância criada!", { description: "Escaneie o QR code para conectar seu WhatsApp." });
      } else {
        const errorText = await response.text();
        console.error('Falha ao criar instância:', errorText);
        throw new Error('Falha ao criar instância');
      }
    } catch (error) {
      console.error('Erro ao criar instância:', error);
      toast.error("Erro", { description: "Não foi possível criar a instância. Tente novamente." });
      setConfirmationStatus(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTryAgain = () => {
    setIsLoading(true);
    setQrCodeData(null);
    setConfirmationStatus(null);
    retryCountRef.current = 0; // Reset retry counter
    handleCreateInstance();
  };

  const resetQrCode = () => {
    setQrCodeData(null);
    setConfirmationStatus(null);
    retryCountRef.current = 0; // Reset retry counter
    if (statusCheckIntervalRef.current !== null) {
      clearInterval(statusCheckIntervalRef.current);
      statusCheckIntervalRef.current = null;
    }
  };
  
  return (
    <PageContainer>
        <div className="max-w-xl mx-auto">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                {qrCodeData ? (
                  <QrCode className="h-5 w-5" />
                ) : (
                  <Plus className="h-5 w-5" />
                )}
                {qrCodeData ? "Conectar WhatsApp" : "Criar Nova Instância"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {qrCodeData ? (
                <div className="space-y-6 text-center">
                  {confirmationStatus === 'waiting' ? (
                    <>
                      <div className="bg-white p-4 rounded-md inline-block mx-auto">
                        <img 
                          src={qrCodeData} 
                          alt="QR Code para conectar WhatsApp" 
                          className="mx-auto max-w-full h-auto"
                          style={{ maxHeight: '250px' }}
                        />
                      </div>
                      
                      <div className="space-y-2 text-center">
                        <h3 className="font-medium text-lg">Conecte seu WhatsApp</h3>
                        <ol className="list-decimal space-y-2 pl-5 text-left text-sm text-muted-foreground">
                          <li>Abra o WhatsApp no seu celular</li>
                          <li>Toque em Menu ou Configurações e selecione Aparelhos conectados</li>
                          <li>Toque em Conectar um aparelho</li>
                          <li>Escaneie o código QR</li>
                        </ol>
                        
                        <div className="mt-4 flex items-center justify-center space-x-2 text-warning" role="status">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>
                            Aguardando conexão
                            {retryCountRef.current > 0 ? ` (Tentativa ${retryCountRef.current}/${maxRetries})` : '...'}
                          </span>
                        </div>
                      </div>
                    </>
                  ) : confirmationStatus === 'confirmed' ? (
                    <div className="p-6 text-center">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                        <Check className="h-10 w-10 text-success" aria-hidden="true" />
                      </div>
                      <h3 className="mb-2 text-xl font-medium">Conectado com Sucesso!</h3>
                      <p className="mb-4 text-muted-foreground">
                        Seu WhatsApp foi conectado à instância <span className="font-semibold">{instanceName}</span>.
                      </p>
                      <Button 
                        onClick={() => navigate('/dashboard')}
                        variant="default"
                        className="mt-4"
                      >
                        Voltar ao Dashboard
                      </Button>
                    </div>
                  ) : confirmationStatus === 'failed' ? (
                    <div className="p-6 text-center">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                        <XCircle className="h-10 w-10 text-destructive" aria-hidden="true" />
                      </div>
                      <h3 className="mb-2 text-xl font-medium">Falha na Conexão</h3>
                      <p className="mb-4 text-muted-foreground">
                        Não foi possível conectar o WhatsApp à instância <span className="font-semibold">{instanceName}</span> após várias tentativas.
                      </p>
                      <Button 
                        onClick={handleTryAgain}
                        variant="default"
                        className="mt-4"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <span className="flex items-center justify-center">
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
                  ) : null}
                  
                  {confirmationStatus !== 'confirmed' && confirmationStatus !== 'failed' && (
                    <Button 
                      onClick={resetQrCode}
                      variant="outline"
                      className="mt-4"
                    >
                      Voltar
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="instance-name">Nome da Instância</Label>
                      <Input 
                        id="instance-name" 
                        placeholder="Ex: Atendimento Principal" 
                        className=""
                        value={instanceName}
                        onChange={(e) => setInstanceName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="webhook-path">Caminho do Webhook</Label>
                      <Input 
                        id="webhook-path" 
                        placeholder="Ex: /webhook/atendimento" 
                        className=""
                        value={webhookPath}
                        onChange={(e) => setWebhookPath(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div className="pt-4">
                    <Button 
                      onClick={handleCreateInstance}
                      className="w-full"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <span className="flex items-center justify-center">
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Criando...
                        </span>
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" />
                          Criar Instância
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
    </PageContainer>
  );
};

export default Evolution;
