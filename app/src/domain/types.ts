// Modelo de dominio (ver docs/04-arquitectura.md §7)

export type PayerType = 'EPS' | 'Prepagada' | 'Sisbén' | 'Particular';
export type Channel = 'api' | 'portal' | 'whatsapp' | 'fax';

export interface Payer {
  id: string;
  name: string;
  type: PayerType;
  channel: Channel;
  slaHours: number;
  baseDenialRate: number; // tasa histórica de negación
}

export interface Procedure {
  cups: string;
  name: string;
  specialty: string;
  amount: number; // valor neto permitido USD
  highCost: boolean;
}

export type EvidenceCode =
  | 'nota_consulta'
  | 'diagnostico'
  | 'imagen_previa'
  | 'tratamiento_conservador'
  | 'laboratorios'
  | 'escala_funcional'
  | 'historia_previa'
  | 'concepto_especialista';

export interface EvidenceRequirement {
  code: EvidenceCode;
  label: string;
}

export interface PolicyResult {
  requiresPA: boolean;
  evidence: EvidenceRequirement[];
  slaHours: number;
  policyVersion: string;
}

export interface EvidenceItem {
  code: EvidenceCode;
  label: string;
  status: 'found' | 'missing' | 'provided';
  source?: string; // cita a la fuente en la HCE
  excerpt?: string;
  confidence?: number;
}

export interface Patient {
  id: string;
  name: string;
  documentId: string;
  payerId: string;
  plan: string;
  age: number;
  available: EvidenceCode[]; // documentos que existen en la HCE
}

export type RequestStatus =
  | 'RECEIVED'
  | 'ELIGIBILITY_CHECK'
  | 'DOCS_PENDING'
  | 'READY'
  | 'CLINICAL_REVIEW'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'DENIED'
  | 'APPEALED'
  | 'SCHEDULED'
  | 'CLOSED';

export type DenialCategory =
  | 'falta_evidencia'
  | 'no_pertinencia'
  | 'codigo_errado'
  | 'no_cubierto'
  | 'extemporanea';

export interface CaseEvent {
  id: string;
  at: number;
  type: string;
  actor: 'Plataforma' | 'Médico' | 'Gestor PA' | 'Pagador' | 'Paciente' | 'IA';
  detail: string;
}

export interface Denial {
  category: DenialCategory;
  reason: string;
  reversalProbability: number;
}

export interface Appeal {
  draft: string;
  status: 'draft' | 'signed' | 'won' | 'lost';
  signedBy?: string;
}

export interface AuthorizationRequest {
  id: string;
  patientId: string;
  payerId: string;
  cups: string;
  physician: string;
  urgency: 'rutina' | 'prioritaria' | 'urgente';
  status: RequestStatus;
  orderedAt: number;
  slaDueAt?: number;
  submittedAt?: number;
  decidedAt?: number;
  payerReference?: string;
  channel?: Channel;
  dossier: EvidenceItem[];
  riskScore?: number;
  humanTouches: number;
  denial?: Denial;
  appeal?: Appeal;
  appointment?: string;
  events: CaseEvent[];
}
