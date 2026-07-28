
import React, { useState, useEffect } from 'react';
import { User, Edit3, Save, X } from 'lucide-react';
import UserAvatar from '@/components/shared/UserAvatar';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getWebhookUrl } from '@/config/env';
import { Conversation } from '@/types/chat';
import GroupInfoPanel from './GroupInfoPanel';
import PendenciasSection from '@/components/pendencias/PendenciasSection';
import TagPicker from '@/components/tags/TagPicker';
import TagBadge from '@/components/tags/TagBadge';
import { useTags } from '@/hooks/useTags';

interface ClientInfoPanelProps {
  selectedChat: string | null;
  selectedConversation: Conversation | undefined;
  onConversationUpdate?: () => void;
  updateConversationLocal?: (sessionId: string, data: Partial<Conversation>) => void;
}

const ClientInfoPanel = ({ selectedChat, selectedConversation, onConversationUpdate, updateConversationLocal }: ClientInfoPanelProps) => {
  const [isEditingPet, setIsEditingPet] = useState(false);
  const [petName, setPetName] = useState('');
  const [petType, setPetType] = useState('');
  const [petBreed, setPetBreed] = useState('');

  const { tagsPorCliente, unassignTag } = useTags();
  const clientId = selectedConversation?.clientData?.id ?? null;
  const clientTags = clientId ? tagsPorCliente.get(clientId) || [] : [];

  useEffect(() => {
    if (selectedConversation) {
      setPetName(selectedConversation.petName === 'Não informado' ? '' : selectedConversation.petName || '');
      setPetType(selectedConversation.petType === 'Não informado' ? '' : selectedConversation.petType || '');
      setPetBreed(selectedConversation.petBreed === 'Não informado' ? '' : selectedConversation.petBreed || '');
      setIsEditingPet(false);
    }
  }, [selectedConversation]);

  const handleSavePet = async () => {
    if (!selectedConversation) return;

    try {
      const query = supabase
        .from('dados_cliente')
        .update({
          nome_pet: petName || null,
          porte_pet: petType || null,
          raca_pet: petBreed || null,
        });

      const { error } = selectedConversation.clientData?.id
        ? await query.eq('id', selectedConversation.clientData.id)
        : await query.eq('sessionid', selectedConversation.sessionId);

      if (error) throw error;

      if (updateConversationLocal) {
        updateConversationLocal(selectedConversation.id, {
          petName: petName || 'Não informado',
          petType: petType || 'Não informado',
          petBreed: petBreed || 'Não informado',
        });
      }

      // Sync webhook
      try {
        await fetch(getWebhookUrl('edita_usuario', '/edita_usuario'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: selectedConversation.clientData?.id,
            name: selectedConversation.clientData?.nome || selectedConversation.name,
            email: selectedConversation.clientData?.email || selectedConversation.email,
            phone: selectedConversation.clientData?.telefone || selectedConversation.phone,
            petName: petName || '',
            petSize: petType || '',
            petBreed: petBreed || '',
            cpfCnpj: selectedConversation.clientData?.cpf_cnpj || '',
            asaasCustomerId: selectedConversation.clientData?.asaas_customer_id || '',
          }),
        });
      } catch (webhookError) {
        console.error('Erro ao enviar para webhook:', webhookError);
      }

      toast.success("Pet atualizado", { description: "As informações do pet foram atualizadas com sucesso." });

      if (onConversationUpdate) {
        onConversationUpdate();
      }
      setIsEditingPet(false);
    } catch (error) {
      console.error('Erro ao salvar dados do pet:', error);
      toast.error("Erro ao salvar", { description: "Não foi possível atualizar os dados do pet no banco de dados." });
    }
  };

  if (!selectedChat) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
        <User size={64} className="mb-4 opacity-50" />
        <h3 className="text-xl font-medium mb-2">Informações do Cliente</h3>
        <p className="text-sm text-center px-4">Selecione uma conversa para ver as informações do cliente</p>
      </div>
    );
  }

  // Grupos não têm cadastro de cliente/pet: mostra os dados do grupo via Uazapi
  if (selectedConversation?.isGroup) {
    return <GroupInfoPanel conversation={selectedConversation} />;
  }

  return (
    <div className="h-full flex flex-col">
      <div className="border-b p-6 text-center">
        <UserAvatar
          src={selectedConversation?.avatar}
          name={selectedConversation?.name}
          isGroup={selectedConversation?.isGroup}
          className="mx-auto mb-4 h-24 w-24"
        />
        <h2 className="text-xl font-semibold">{selectedConversation?.name}</h2>
        <p className="text-muted-foreground">{selectedConversation?.phone}</p>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-4">
          <Tabs defaultValue="info">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="info">Informações</TabsTrigger>
              <TabsTrigger value="pet">Pet</TabsTrigger>
              <TabsTrigger value="pendencias">Pendências</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="mt-4 space-y-4">
              <Card className="p-4">
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">Tags</h3>
                {clientId ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {clientTags.map(tag => (
                      <TagBadge
                        key={tag.id}
                        tag={tag}
                        onRemove={() => unassignTag.mutate({ clientId, tagId: tag.id })}
                      />
                    ))}
                    <TagPicker clientId={clientId} />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Cliente sem cadastro</p>
                )}
              </Card>

              <Card className="p-4">
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">Email</h3>
                <p>{selectedConversation?.email}</p>
              </Card>
              
              <Card className="p-4">
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">Telefone</h3>
                <p>{selectedConversation?.phone}</p>
              </Card>
              
              <Card className="p-4">
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">Endereço</h3>
                <p>{selectedConversation?.address || 'Não informado'}</p>
              </Card>
              
              <Card className="p-4">
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">Session ID</h3>
                <p className="text-xs break-all">{selectedConversation?.sessionId || 'Não informado'}</p>
              </Card>
            </TabsContent>
            
            <TabsContent value="pet" className="mt-4 space-y-4">
              <div className="flex justify-end mb-2">
                {isEditingPet ? (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSavePet} className="gap-1">
                      <Save className="h-4 w-4" />
                      Salvar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setIsEditingPet(false)} className="gap-1">
                      <X className="h-4 w-4" />
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setIsEditingPet(true)} className="gap-1">
                    <Edit3 className="h-4 w-4" />
                    Editar Pet
                  </Button>
                )}
              </div>

              <Card className="p-4">
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">Nome do Pet</h3>
                {isEditingPet ? (
                  <Input 
                    value={petName} 
                    onChange={e => setPetName(e.target.value)} 
                    placeholder="Ex: Rex"
                  />
                ) : (
                  <p>{selectedConversation?.petName || 'Não informado'}</p>
                )}
              </Card>
              
              <Card className="p-4">
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">Porte</h3>
                {isEditingPet ? (
                  <Input 
                    value={petType} 
                    onChange={e => setPetType(e.target.value)} 
                    placeholder="Ex: Pequeno, Médio, Grande"
                  />
                ) : (
                  <p>{selectedConversation?.petType || 'Não informado'}</p>
                )}
              </Card>
              
              <Card className="p-4">
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">Raça</h3>
                {isEditingPet ? (
                  <Input 
                    value={petBreed} 
                    onChange={e => setPetBreed(e.target.value)} 
                    placeholder="Ex: Labrador, Poodle, Vira-lata"
                  />
                ) : (
                  <p>{selectedConversation?.petBreed || 'Não informado'}</p>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="pendencias" className="mt-4">
              <PendenciasSection clientId={clientId} />
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
};

export default ClientInfoPanel;
