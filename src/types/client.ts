
export interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address?: string;
  petName: string | null;
  petSize: string | null;
  petBreed: string | null;
  cpfCnpj: string | null;
  asaasCustomerId: string | null;
  payments?: any;
  status: 'Active' | 'Inactive';
  notes?: string;
  lastContact: string;
}
