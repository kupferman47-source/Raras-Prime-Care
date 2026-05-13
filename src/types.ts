export interface Client {
  id: string;
  name: string;
  phone: string;
  secondaryPhone?: string;
  email?: string;
  birthDate: string;
  address: string;
  gender?: 'Masculino' | 'Feminino' | 'Outro' | 'Prefiro não dizer';
  cpf?: string;
  rg?: string;
  cep?: string;
  state?: string;
  city?: string;
  neighborhood?: string;
  avatarUrl?: string;
  legacyHistory?: string;
  lastBirthdayMessageSentDate?: string;
  isDeleted?: boolean;
  deletedAt?: any;
  createdAt: any;
  updatedAt?: any;
}

export interface Anamnesis {
  id: string;
  clientId: string;
  smoking: boolean;
  diabetes: boolean;
  hypertension: boolean;
  cardiacDisease: boolean;
  pacemaker: boolean;
  anticoagulant: boolean;
  renalProblem: boolean;
  hepatitis: boolean;
  cancer: boolean;
  pregnancy: boolean;
  allergyMetals: boolean;
  mycosisNails: boolean;
  mycosisSkin: boolean;
  sports: boolean;
  painSensitivity: boolean;
  leprosy: boolean;
  circulatoryDisorder: boolean;
  lowerLimbSurgery: boolean;
  shoeType: string;
  shoeSize: string;
  sockType: string;
  footAssessmentLeft: string;
  footAssessmentRight: string;
  dermatologicalPathologies: string[];
  nailPathologies: string[];
  imageAuthorization: boolean;
  generalObservations: string;
  aids: boolean;
  signatureDataUrl?: string;
  onicomicose: boolean;
  onicofose: boolean;
  orteses: boolean;
  ungueal: boolean;
  verrugaPlantar: boolean;
  fissuras: boolean;
  onicocriptose: boolean;
  onicogrifose: boolean;
  micoseUngeualMao: boolean;
  compromisedNailsHands: string[]; // e.g. ["thumb-left", "index-left", ...]
  compromisedNailsFeet: string[]; // e.g. ["hallux-left", ...]
  medications: string;
  allergies: string;
  nailCondition: string;
  skinCondition: string;
  footType: string;
  sensibilityFoot: string;
  assessment: string;
  disclaimerAccepted: boolean;
  absenceTermAccepted: boolean;
  isDeleted?: boolean;
  deletedAt?: any;
  updatedAt: any;
}

export interface Service {
  name: string;
  price: number;
  netPrice?: number;
  professionalId?: string;
  professionalName?: string;
  commissionRate?: number;
  commissionValue?: number;
}

export interface Professional {
  id: string;
  name: string;
  defaultCommission: number;
  color?: string;
  email?: string;
  phone?: string;
  password?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  role: 'admin' | 'professional';
  professionalId?: string;
  createdAt: any;
}

export interface RegisteredService {
  id: string;
  name: string;
  defaultPrice: number;
  category?: 'Podologia' | 'Manicure/Pedicure' | 'Sobrancelhas' | 'Depilação' | 'Cílios' | 'Outros';
  updatedAt: any;
}

export interface ClinicBranch {
  id: string;
  name: string;
  address?: string;
  mapsUrl?: string;
  updatedAt: any;
}

export interface Command {
  id: string;
  clientId: string;
  clientName: string;
  services: Service[];
  total: number;
  netTotal?: number;
  feeAmount?: number;
  status: 'open' | 'paid' | 'cancelled';
  paymentMethod?: 'Dinheiro' | 'Pix' | 'Cartão de Crédito' | 'Cartão de Débito' | 'Link de Pagamento';
  cardBrand?: 'Visa' | 'Mastercard' | 'Elo' | 'Amex' | 'Hipercard';
  installments?: number;
  paymentLink?: string;
  date: any;
  closedAt?: any;
  updatedAt?: any;
}

export interface EvolutionEntry {
  id: string;
  clientId: string;
  date: any;
  description: string;
  images?: string[];
  professionalId?: string;
  professionalName?: string;
  updatedAt: any;
}

export interface ProfessionalTransaction {
  id: string;
  professionalId: string;
  type: 'payment' | 'advance' | 'commission'; // advance = vale, commission = from commands
  amount: number;
  date: any;
  notes?: string;
  commandId?: string; // Reference to the command that generated this
}

export interface AppSettings {
  backupEmail: string;
  fees?: {
    debitVisaMaster: number;
    debitEloAmex: number;
    creditVisaMaster: number[];
    creditEloAmex: number[];
    paymentLink: number[];
  };
  updatedAt: any;
}

export interface Appointment {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  professionalId: string;
  professionalName: string;
  serviceName: string;
  locationId?: string;
  locationName?: string;
  date: any;
  endDate?: any;
  duration?: number;
  price?: number;
  paymentMethod?: 'Dinheiro' | 'Pix' | 'Cartão de Crédito' | 'Cartão de Débito';
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'attended';
  notes?: string;
  createdAt: any;
}

export interface Feedback {
  id: string;
  appointmentId: string;
  clientId: string;
  clientName: string;
  professionalId: string;
  professionalName: string;
  rating: number;
  comment?: string;
  createdAt: any;
}
