// Patrón State: transiciones válidas del caso (docs/04-arquitectura.md §7.1)
import type { RequestStatus } from './types';

export const TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  RECEIVED: ['ELIGIBILITY_CHECK'],
  ELIGIBILITY_CHECK: ['DOCS_PENDING', 'SCHEDULED'],
  DOCS_PENDING: ['DOCS_PENDING', 'READY'],
  READY: ['CLINICAL_REVIEW', 'SUBMITTED'],
  CLINICAL_REVIEW: ['READY', 'SUBMITTED'],
  SUBMITTED: ['DOCS_PENDING', 'APPROVED', 'DENIED'],
  DENIED: ['APPEALED', 'CLOSED'],
  APPEALED: ['APPROVED', 'CLOSED'],
  APPROVED: ['SCHEDULED'],
  SCHEDULED: ['CLOSED'],
  CLOSED: [],
};

export const canTransition = (from: RequestStatus, to: RequestStatus) => TRANSITIONS[from].includes(to);

export function assertTransition(from: RequestStatus, to: RequestStatus) {
  if (!canTransition(from, to)) throw new Error(`Transición inválida: ${from} → ${to}`);
}

export const STATUS_LABEL: Record<RequestStatus, string> = {
  RECEIVED: 'Recibida',
  ELIGIBILITY_CHECK: 'Elegibilidad',
  DOCS_PENDING: 'Faltan documentos',
  READY: 'Lista para radicar',
  CLINICAL_REVIEW: 'Revisión clínica',
  SUBMITTED: 'Radicada',
  APPROVED: 'Aprobada',
  DENIED: 'Negada',
  APPEALED: 'En apelación',
  SCHEDULED: 'Agendada',
  CLOSED: 'Cerrada',
};

export const STATUS_TONE: Record<RequestStatus, 'blue' | 'amber' | 'green' | 'red' | 'gray' | 'violet'> = {
  RECEIVED: 'gray',
  ELIGIBILITY_CHECK: 'gray',
  DOCS_PENDING: 'amber',
  READY: 'blue',
  CLINICAL_REVIEW: 'violet',
  SUBMITTED: 'blue',
  APPROVED: 'green',
  DENIED: 'red',
  APPEALED: 'violet',
  SCHEDULED: 'green',
  CLOSED: 'gray',
};

/** Pasos visibles del recorrido feliz para el stepper de la UI. */
export const HAPPY_PATH: RequestStatus[] = ['RECEIVED', 'DOCS_PENDING', 'READY', 'SUBMITTED', 'APPROVED', 'SCHEDULED'];
