
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Contact } from '@/types/client';

interface EditClientDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedContact: Contact | null;
  editContactData: Partial<Contact>;
  setEditContactData: (contact: Partial<Contact>) => void;
  handleEditContact: () => void;
}

const EditClientDialog = ({
  isOpen,
  onOpenChange,
  selectedContact,
  editContactData,
  setEditContactData,
  handleEditContact,
}: EditClientDialogProps) => {
  if (!selectedContact) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Editar Cliente</DialogTitle>
          <DialogDescription>
            Atualize as informações de {selectedContact.name}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-name" className="text-right">
                Nome
              </Label>
              <Input
                id="edit-name"
                value={editContactData.name || ''}
                onChange={(e) => setEditContactData({...editContactData, name: e.target.value})}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-phone" className="text-right">
                Telefone
              </Label>
              <Input
                id="edit-phone"
                value={editContactData.phone || ''}
                onChange={(e) => setEditContactData({...editContactData, phone: e.target.value})}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-email" className="text-right">
                Email
              </Label>
              <Input
                id="edit-email"
                type="email"
                value={editContactData.email || ''}
                onChange={(e) => setEditContactData({...editContactData, email: e.target.value})}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-cpfCnpj" className="text-right">
                CPF/CNPJ
              </Label>
              <Input
                id="edit-cpfCnpj"
                value={editContactData.cpfCnpj || ''}
                onChange={(e) => setEditContactData({...editContactData, cpfCnpj: e.target.value})}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-asaasId" className="text-right">
                ID Asaas
              </Label>
              <Input
                id="edit-asaasId"
                value={editContactData.asaasCustomerId || ''}
                onChange={(e) => setEditContactData({...editContactData, asaasCustomerId: e.target.value})}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-address" className="text-right">
                Endereço
              </Label>
              <Input
                id="edit-address"
                value={editContactData.address || ''}
                onChange={(e) => setEditContactData({...editContactData, address: e.target.value})}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-petName" className="text-right">
                Nome do Pet
              </Label>
              <Input
                id="edit-petName"
                value={editContactData.petName || ''}
                onChange={(e) => setEditContactData({...editContactData, petName: e.target.value})}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-petBreed" className="text-right">
                Raça do Pet
              </Label>
              <Input
                id="edit-petBreed"
                value={editContactData.petBreed || ''}
                onChange={(e) => setEditContactData({...editContactData, petBreed: e.target.value})}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-petSize" className="text-right">
                Porte do Pet
              </Label>
              <Select
                value={editContactData.petSize || ''}
                onValueChange={(value) => setEditContactData({...editContactData, petSize: value})}
              >
                <SelectTrigger id="edit-petSize" className="col-span-3">
                  <SelectValue placeholder="Selecione o porte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pequeno">Pequeno</SelectItem>
                  <SelectItem value="medio">Médio</SelectItem>
                  <SelectItem value="grande">Grande</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="edit-notes" className="text-right mt-2">
              Observações
            </Label>
            <Textarea
              id="edit-notes"
              value={editContactData.notes || ''}
              onChange={(e) => setEditContactData({...editContactData, notes: e.target.value})}
              className="col-span-3"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" onClick={handleEditContact}>Salvar Alterações</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditClientDialog;
