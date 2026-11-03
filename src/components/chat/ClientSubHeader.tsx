
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Heart, PawPrint, MapPin, Edit3, Save, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Conversation } from '@/types/chat';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ClientSubHeaderProps {
  selectedConversation?: Conversation;
  onConversationUpdate?: () => void;
  updateConversationLocal?: (sessionId: string, data: Partial<Conversation>) => void;
}

const ClientSubHeader = ({ selectedConversation, onConversationUpdate, updateConversationLocal }: ClientSubHeaderProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContact, setEditedContact] = useState<any>(null);
  const [showPets, setShowPets] = useState(false);

  const handleEdit = () => {
    setEditedContact(selectedConversation?.clientData);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (editedContact && onConversationUpdate && selectedConversation?.clientData) {
      try {
        const { error } = await supabase
          .from('dados_cliente')
          .update({
            nome: editedContact.nome,
            email: editedContact.email,
            cpf_cnpj: editedContact.cpf_cnpj,
            servico: editedContact.servico,
          })
          .eq('id', selectedConversation.clientData.id);

        if (error) throw error;

        if (updateConversationLocal && selectedConversation) {
          updateConversationLocal(selectedConversation.id, {
            name: editedContact.nome || 'Cliente sem nome',
            email: editedContact.email || 'Sem email',
            clientData: {
              ...selectedConversation.clientData,
              nome: editedContact.nome,
              email: editedContact.email,
              cpf_cnpj: editedContact.cpf_cnpj,
              servico: editedContact.servico,
            }
          });
        }

        toast.success("Cliente atualizado", { description: "As informações do cliente foram salvas com sucesso." });

        onConversationUpdate();
        setIsEditing(false);
        setEditedContact(null);
      } catch (error) {
        console.error('Erro ao atualizar cliente:', error);
        toast.error("Erro ao salvar", { description: "Não foi possível atualizar o cliente no banco de dados." });
      }
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedContact(null);
  };

  if (!selectedConversation?.clientData) {
    return null;
  }

  const clientData = selectedConversation.clientData;

  return (
    <div className="border-b bg-card">
      <div className="p-4">
        <div className="mb-4">
          {isEditing ? (
            <Input
              value={editedContact?.nome || ''}
              onChange={(e) => setEditedContact((prev: any) => prev ? {...prev, nome: e.target.value} : null)}
              className="text-lg font-semibold"
            />
          ) : (
            <h3 className="text-lg font-semibold leading-snug">
              {clientData.nome || 'Cliente sem nome'}
            </h3>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPets(!showPets)}
              className="flex items-center gap-2"
            >
              <PawPrint className="h-4 w-4" />
              {showPets ? 'Ocultar Pets' : 'Ver Pets'}
            </Button>

            {isEditing ? (
              <>
                <Button size="sm" onClick={handleSave} aria-label="Salvar alterações do cliente">
                  <Save className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancel} aria-label="Cancelar edição">
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={handleEdit} aria-label="Editar cliente">
                <Edit3 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div className="space-y-1">
            <span className="font-medium text-foreground">Email:</span>
            {isEditing ? (
              <Input
                value={editedContact?.email || ''}
                onChange={(e) => setEditedContact((prev: any) => prev ? {...prev, email: e.target.value} : null)}
                className="w-full"
              />
            ) : (
              <p className="break-all text-muted-foreground">
                {clientData.email || 'Não informado'}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <span className="font-medium text-foreground">CPF/CNPJ:</span>
            {isEditing ? (
              <Input
                value={editedContact?.cpf_cnpj || ''}
                onChange={(e) => setEditedContact((prev: any) => prev ? {...prev, cpf_cnpj: e.target.value} : null)}
                className="w-full"
              />
            ) : (
              <p className="text-muted-foreground">
                {clientData.cpf_cnpj || 'Não informado'}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <span className="flex items-center gap-2 font-medium text-foreground">
              <Heart className="h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
              Observações:
            </span>
            {isEditing ? (
              <Textarea
                value={editedContact?.servico || ''}
                onChange={(e) => setEditedContact((prev: any) => prev ? {...prev, servico: e.target.value} : null)}
                className="mt-1 w-full"
                rows={3}
              />
            ) : (
              <p className="text-muted-foreground">
                {clientData.servico || 'Nenhuma observação registrada'}
              </p>
            )}
          </div>
        </div>

        {showPets && (
          <div className="mt-4 space-y-2 rounded-lg border bg-accent/50 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent-foreground">
              <PawPrint className="h-3.5 w-3.5" /> Informações do Pet
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="block text-muted-foreground">Nome:</span>
                <span className="font-semibold">{selectedConversation?.petName || 'Não informado'}</span>
              </div>
              <div>
                <span className="block text-muted-foreground">Porte:</span>
                <span className="font-semibold">{selectedConversation?.petType || 'Não informado'}</span>
              </div>
              <div>
                <span className="block text-muted-foreground">Raça:</span>
                <span className="font-semibold">{selectedConversation?.petBreed || 'Não informado'}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientSubHeader;
