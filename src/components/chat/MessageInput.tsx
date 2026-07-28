import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, Paperclip, Mic, Square, Trash2, X, FileText, Image as ImageIcon, Play, Pause, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Conversation, ChatMessage } from '@/types/chat';
import { toast } from 'sonner';
import { getActiveConfig, getWebhookUrl } from '@/config/env';
import { useAtendentes } from '@/hooks/useAtendentes';
import { useAtendenteAtivo } from '@/context/AtendenteAtivoContext';

interface MessageInputProps {
  selectedChat: string | null;
  selectedConversation?: Conversation;
  onNewMessage?: (message: ChatMessage) => void;
}

const getWebhookMessageUrl = (_sender: 'cvi' = 'cvi') => {
  return getWebhookUrl('mensagem', '/envia_mensagem');
};

type Sender = 'cvi';

const removeAccents = (str: string) => {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

const sanitizeName = (name: string) => {
  return removeAccents(name)
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/__+/g, '_')
    .replace(/^_+|_+$/g, '');
};

const getFormattedDate = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const MessageInput = ({ selectedChat, selectedConversation, onNewMessage }: MessageInputProps) => {
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedAtendente, setSelectedAtendente] = useState<string>('none');
  const { atendentes } = useAtendentes();
  const { atendenteAtivo } = useAtendenteAtivo();
  const atendentesAtivos = atendentes.filter((a) => a.ativo);
  const atendenteAtivoNome = atendenteAtivo?.nome ?? null;

  // Com atendente ativo escolhido no header, o chat já assina por ele;
  // sem atendente ativo, mantém a última escolha manual deste input
  useEffect(() => {
    if (atendenteAtivoNome) {
      setSelectedAtendente(atendenteAtivoNome);
      return;
    }
    const saved = localStorage.getItem('selectedAtendente');
    setSelectedAtendente(saved || 'none');
  }, [atendenteAtivoNome]);

  const handleAtendenteChange = (value: string) => {
    setSelectedAtendente(value);
    if (value !== 'none') {
      localStorage.setItem('selectedAtendente', value);
    } else {
      localStorage.removeItem('selectedAtendente');
    }
  };

  // Grupos são atendidos direto pela Uazapi (os webhooks do n8n são por cliente)
  const isGroup = !!selectedConversation?.isGroup;

  // File upload states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  // Nome editável do anexo (áudio/documento) — vira o fileName enviado e exibido no chat
  const [mediaName, setMediaName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audio recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);

  // Timer for audio recording
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingTime(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Max 15MB limit. A mensagem informa o tamanho real: laudos e exames em PDF
    // passam disso com frequência, e sem o número ninguém liga o erro à causa.
    if (file.size > 15 * 1024 * 1024) {
      const tamanhoMb = (file.size / (1024 * 1024)).toFixed(1);
      toast.error('Arquivo muito grande', {
        description: `"${file.name}" tem ${tamanhoMb}MB e o limite é 15MB. Comprima o arquivo ou envie em partes.`,
      });
      return;
    }

    setSelectedFile(file);
    // Clear audio if any file is uploaded
    setAudioBlob(null);
    setAudioPreviewUrl(null);

    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setFilePreview(url);
      setMediaName('');
    } else {
      setFilePreview(null);
      // Pré-preenche o nome editável com o nome original (sem extensão)
      const dot = file.name.lastIndexOf('.');
      setMediaName(dot > 0 ? file.name.slice(0, dot) : file.name);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioPreviewUrl(url);
        stream.getTracks().forEach((track) => track.stop());
      };

      // Clear files if recording starts
      setSelectedFile(null);
      setFilePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Nome padrão do áudio (editável no preview)
      const clientNameClean = selectedConversation?.name
        ? sanitizeName(selectedConversation.name)
        : 'cliente';
      setMediaName(`${clientNameClean}_${getFormattedDate()}`);

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone access error:', err);
      toast.error('Acesso ao microfone negado', { description: 'Por favor, conceda permissão de microfone para gravar mensagens de voz.' });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const cancelSelectedMedia = () => {
    setSelectedFile(null);
    setFilePreview(null);
    setAudioBlob(null);
    setAudioPreviewUrl(null);
    setMediaName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Extrai da exceção uma frase que sirva para o atendente relatar o problema.
   * A Uazapi responde com JSON (`{"error": "..."}`) ou texto puro; ambos são
   * mais úteis que "tente novamente", mas nenhum cabe inteiro num toast.
   */
  const descreverFalhaEnvio = (error: unknown): string => {
    const bruto = error instanceof Error ? error.message : String(error ?? '');
    if (!bruto) return 'Não foi possível enviar sua mensagem. Tente novamente.';

    const corpo = bruto.replace(/^Falha ao enviar mensagem:\s*/, '').trim();
    let texto = corpo;
    try {
      const json = JSON.parse(corpo);
      texto = json.error || json.message || json.detail || corpo;
    } catch {
      // Resposta em texto puro: usa como veio.
    }

    if (/Failed to fetch|NetworkError/i.test(texto)) {
      return 'Sem conexão com o servidor de mensagens. Verifique a internet e tente de novo.';
    }
    return texto.length > 180 ? `${texto.slice(0, 180)}…` : texto;
  };

  const fileToBase64 = (fileOrBlob: File | Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(fileOrBlob);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const sendMessage = async (sender: Sender) => {
    const hasMedia = !!selectedFile || !!audioBlob;
    if (!newMessage.trim() && !hasMedia || !selectedChat || !selectedConversation?.phone) return;

    try {
      setIsSending(true);

      let mediaData = '';
      let mediaType = '';
      let fileName = '';

      if (selectedFile) {
        mediaData = await fileToBase64(selectedFile);
        const isImage = selectedFile.type.startsWith('image/');
        mediaType = isImage ? 'image' : 'document';
        // Documento usa o nome editado no preview, preservando a extensão original
        const dot = selectedFile.name.lastIndexOf('.');
        const ext = dot > 0 ? selectedFile.name.slice(dot) : '';
        fileName = !isImage && mediaName.trim()
          ? `${mediaName.trim()}${ext}`
          : selectedFile.name;
      } else if (audioBlob) {
        mediaData = await fileToBase64(audioBlob);
        mediaType = 'audio';
        const clientNameClean = selectedConversation?.name
          ? sanitizeName(selectedConversation.name)
          : 'cliente';
        fileName = `${mediaName.trim() || `${clientNameClean}_${getFormattedDate()}`}.webm`;
      }

      let finalMessage = newMessage;
      if (selectedAtendente && selectedAtendente !== 'none' && !audioBlob) {
        if (newMessage.trim()) {
          finalMessage = `*${selectedAtendente}*:\n${newMessage}`;
        } else if (hasMedia) {
          finalMessage = `*${selectedAtendente}*:`;
        }
      }

      // Get UAZAPI config
      const config = getActiveConfig();
      const uazapiConfig = {
        serverUrl: config.UAZAPI_SERVER_URL,
        instanceToken: config.UAZAPI_INSTANCE_TOKEN,
      };

      let response;
      // Usar UAZAPI apenas quando houver mídia
      if (hasMedia && uazapiConfig.serverUrl && uazapiConfig.instanceToken) {
        const baseUrl = uazapiConfig.serverUrl.replace(/\/$/, '');
        const url = `${baseUrl}/send/media`;

        const typeVal = mediaType === 'audio' ? 'ptt' : mediaType;
        const body = JSON.stringify({
          number: selectedConversation.phone,
          type: typeVal,
          mediatype: typeVal,
          file: mediaData,
          media: mediaData,
          caption: finalMessage || '',
          filename: fileName,
          fileName: fileName
        });

        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'token': uazapiConfig.instanceToken
          },
          body,
        });
      } else if (isGroup && uazapiConfig.serverUrl && uazapiConfig.instanceToken) {
        // Texto para grupo: envia direto pela Uazapi usando o JID do grupo
        const baseUrl = uazapiConfig.serverUrl.replace(/\/$/, '');
        response = await fetch(`${baseUrl}/send/text`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'token': uazapiConfig.instanceToken
          },
          body: JSON.stringify({
            number: selectedConversation.phone,
            text: finalMessage,
          }),
        });
      } else {
        // Enviar via Webhook (Mensagem de texto normal ou fallback)
        const payload: any = {
          message: finalMessage,
          phoneNumber: selectedConversation.phone,
        };

        if (hasMedia) {
          payload.mediaData = mediaData;
          payload.mediaType = mediaType;
          payload.fileName = fileName;
        }

        response = await fetch(getWebhookMessageUrl(sender), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('UAZAPI error response:', errorText);
        throw new Error(`Falha ao enviar mensagem: ${errorText}`);
      }

      // Echo otimista: mostra a mensagem imediatamente, sem esperar o realtime
      if (onNewMessage) {
        // Imagens já têm filePreview; áudios têm audioPreviewUrl. Para
        // documentos/PDFs não há preview, então geramos uma URL local aqui —
        // sem isso o card do arquivo não renderiza no momento do envio.
        const localMediaUrl =
          filePreview ||
          audioPreviewUrl ||
          (selectedFile ? URL.createObjectURL(selectedFile) : undefined);
        onNewMessage({
          role: 'assistant',
          content: finalMessage,
          timestamp: new Date().toISOString(),
          type: hasMedia ? mediaType : undefined,
          mediaUrl: localMediaUrl,
          fileName: fileName || undefined,
        });
      }

      setNewMessage('');
      cancelSelectedMedia();

      if (isGroup) {
        toast.success('Mensagem enviada para o grupo', { description: 'Sua mensagem foi enviada com sucesso.' });
      } else {
        const senderLabel = sender === 'cvi' ? 'cvi' : 'Banho & Tosa';
        toast.success(`Mensagem enviada como ${senderLabel}`, { description: 'Sua mensagem foi enviada com sucesso.' });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Mostra o motivo real na tela: quem está atendendo não abre o console,
      // e sem isso toda falha de envio vira "tente novamente" sem diagnóstico.
      toast.error('Erro ao enviar mensagem', { description: descreverFalhaEnvio(error) });
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage('cvi');
    }
  };

  // Mídia pendente tem botão de envio próprio no box de pré-visualização;
  // os botões da barra (cvi / Banho & Tosa) ficam dedicados a texto
  const hasPendingMedia = !!selectedFile || !!audioBlob;
  const mediaSendLabel = audioBlob
    ? 'Enviar áudio'
    : selectedFile?.type.startsWith('image/')
      ? 'Enviar imagem'
      : 'Enviar arquivo';

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col gap-2 border-t bg-card p-3">
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*,application/pdf"
          className="hidden"
        />

        {/* Media Preview Box */}
        {(selectedFile || audioPreviewUrl) && (
          <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/50 p-2 shadow-inner animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex min-w-0 items-center gap-3">
              {selectedFile && filePreview && (
                <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded border">
                  <img src={filePreview} alt="Pré-visualização da imagem" className="h-full w-full object-cover" />
                </div>
              )}
              {selectedFile && !filePreview && (
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded bg-accent text-accent-foreground">
                  <FileText size={24} aria-hidden="true" />
                </div>
              )}
              {audioPreviewUrl && (
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded bg-accent text-accent-foreground">
                  <Mic size={24} className="animate-pulse" aria-hidden="true" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                {audioBlob || (selectedFile && !selectedFile.type.startsWith('image/')) ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={mediaName}
                      onChange={(e) => setMediaName(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={audioBlob ? 'Nome do áudio' : 'Nome do arquivo'}
                      aria-label="Nome do anexo"
                      disabled={isSending}
                      className="h-8 w-full max-w-[260px] text-sm font-medium"
                    />
                    <span className="flex-shrink-0 text-xs text-muted-foreground">
                      {audioBlob
                        ? '.webm'
                        : selectedFile && selectedFile.name.lastIndexOf('.') > 0
                          ? selectedFile.name.slice(selectedFile.name.lastIndexOf('.'))
                          : ''}
                    </span>
                  </div>
                ) : (
                  <p className="truncate text-sm font-medium">{selectedFile?.name}</p>
                )}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {selectedFile
                    ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`
                    : 'Mensagem de voz · pronta para enviar'}
                </p>
              </div>
            </div>

            {audioPreviewUrl && (
              <div className="max-w-xs flex-1 px-2">
                <audio src={audioPreviewUrl} controls className="h-8 max-h-8 w-full" />
              </div>
            )}

            <div className="flex flex-shrink-0 items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Remover anexo"
                    onClick={cancelSelectedMedia}
                    disabled={isSending}
                    className="h-9 w-9 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Descartar anexo</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    aria-label={mediaSendLabel}
                    onClick={() => sendMessage('cvi')}
                    disabled={isSending || !selectedConversation}
                    className="h-9 gap-2 bg-primary px-4 text-primary-foreground hover:bg-primary/90"
                  >
                    {isSending ? (
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Send size={16} aria-hidden="true" />
                    )}
                    {mediaSendLabel}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="font-semibold">{mediaSendLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {audioBlob ? 'Envia a mensagem de voz gravada' : 'Envia o anexo com a legenda digitada'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}

        {/* Input Controls */}
        <div className="flex items-center gap-2">
          {/* Attendant Selector */}
          <Select value={selectedAtendente} onValueChange={handleAtendenteChange}>
            <SelectTrigger className="w-32 h-10 shrink-0">
              <SelectValue placeholder="Atendente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {atendentesAtivos.map((atendente) => (
                <SelectItem key={atendente.id} value={atendente.nome}>{atendente.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Attachment Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Anexar imagem ou PDF"
                disabled={!selectedConversation || isRecording || isSending}
                onClick={triggerFileInput}
                className="flex-shrink-0 hover:border-primary hover:text-primary"
              >
                <Paperclip size={18} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="font-semibold">Anexar mídia</p>
              <p className="text-xs text-muted-foreground">Imagem, PDF (Máx 15MB)</p>
            </TooltipContent>
          </Tooltip>

          {/* Voice Message Recorder Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              {isRecording ? (
                <Button
                  type="button"
                  size="icon"
                  aria-label="Parar gravação"
                  onClick={stopRecording}
                  className="flex-shrink-0 animate-pulse bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  <Square size={18} />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label="Gravar mensagem de voz"
                  disabled={!selectedConversation || !!selectedFile || isSending}
                  onClick={startRecording}
                  className="flex-shrink-0 hover:border-destructive hover:text-destructive"
                >
                  <Mic size={18} />
                </Button>
              )}
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="font-semibold">{isRecording ? 'Parar gravação' : 'Gravar áudio'}</p>
              <p className="text-xs text-muted-foreground">Enviar como mensagem de voz</p>
            </TooltipContent>
          </Tooltip>

          {/* Input field */}
          {isRecording ? (
            <div className="flex flex-1 animate-pulse items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive" role="status">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-destructive" aria-hidden="true" />
              <span>Gravando áudio: {formatRecordingTime(recordingTime)}</span>
            </div>
          ) : (
            <Input
              placeholder={
                selectedFile
                  ? 'Adicione uma legenda (opcional)...'
                  : audioBlob
                  ? 'Legenda não disponível para áudios'
                  : 'Digite uma mensagem'
              }
              className="flex-1"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSending || (!!audioBlob && !selectedFile)}
            />
          )}

          {/* Send cvi Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                aria-label="Enviar texto como cvi"
                className="flex-shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={
                  isSending ||
                  isRecording ||
                  hasPendingMedia ||
                  !newMessage.trim() ||
                  !selectedConversation
                }
                onClick={() => sendMessage('cvi')}
              >
                <Send size={18} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="font-semibold">{isGroup ? 'Enviar texto para o grupo' : 'Enviar texto como cvi'}</p>
              <p className="text-xs text-muted-foreground">
                {isGroup ? 'Envia direto pela Uazapi no grupo' : 'Responde pelo número da cvi'}
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default MessageInput;
