// Catálogo de pagadores, procedimientos y reglas de PA (DMN simplificado — ADR-002).
// Nombres de pagadores y códigos CUPS son ILUSTRATIVOS (caso ficticio).
import type { EvidenceCode, EvidenceRequirement, Payer, PolicyResult, Procedure } from './types';

export const PAYERS: Payer[] = [
  { id: 'eps-andina', name: 'EPS Andina', type: 'EPS', channel: 'api', slaHours: 72, baseDenialRate: 0.12 },
  { id: 'eps-sabana', name: 'EPS Sabana Salud', type: 'EPS', channel: 'api', slaHours: 72, baseDenialRate: 0.09 },
  { id: 'eps-cordillera', name: 'EPS Cordillera', type: 'EPS', channel: 'portal', slaHours: 96, baseDenialRate: 0.18 },
  { id: 'eps-meridiano', name: 'EPS Meridiano', type: 'EPS', channel: 'portal', slaHours: 96, baseDenialRate: 0.21 },
  { id: 'eps-altiplano', name: 'EPS Altiplano', type: 'EPS', channel: 'whatsapp', slaHours: 120, baseDenialRate: 0.24 },
  { id: 'pre-cumbre', name: 'Prepagada Cumbre', type: 'Prepagada', channel: 'api', slaHours: 48, baseDenialRate: 0.16 },
  { id: 'pre-horizonte', name: 'Prepagada Horizonte', type: 'Prepagada', channel: 'portal', slaHours: 48, baseDenialRate: 0.27 },
  { id: 'pre-aurora', name: 'Prepagada Aurora', type: 'Prepagada', channel: 'portal', slaHours: 48, baseDenialRate: 0.31 },
  { id: 'pre-faro', name: 'Prepagada Faro', type: 'Prepagada', channel: 'whatsapp', slaHours: 72, baseDenialRate: 0.22 },
  { id: 'pre-roble', name: 'Prepagada Roble', type: 'Prepagada', channel: 'api', slaHours: 48, baseDenialRate: 0.14 },
  { id: 'sis-norte', name: 'Sisbén · Subred Norte', type: 'Sisbén', channel: 'portal', slaHours: 120, baseDenialRate: 0.2 },
  { id: 'sis-sur', name: 'Sisbén · Subred Sur', type: 'Sisbén', channel: 'fax', slaHours: 120, baseDenialRate: 0.19 },
  { id: 'sis-occ', name: 'Sisbén · Subred Occidente', type: 'Sisbén', channel: 'portal', slaHours: 120, baseDenialRate: 0.17 },
  { id: 'particular', name: 'Pago directo', type: 'Particular', channel: 'api', slaHours: 0, baseDenialRate: 0 },
];

export const PROCEDURES: Procedure[] = [
  { cups: '883522', name: 'Resonancia magnética de rodilla', specialty: 'Ortopedia', amount: 540, highCost: false },
  { cups: '452301', name: 'Colonoscopia diagnóstica', specialty: 'Gastroenterología', amount: 610, highCost: false },
  { cups: '881201', name: 'Ecocardiograma transtorácico', specialty: 'Cardiología', amount: 380, highCost: false },
  { cups: '806101', name: 'Artroscopia de rodilla', specialty: 'Ortopedia', amount: 2400, highCost: true },
  { cups: '879301', name: 'TAC de tórax con contraste', specialty: 'Neumología', amount: 520, highCost: false },
  { cups: '133100', name: 'Cirugía de catarata con lente', specialty: 'Oftalmología', amount: 1650, highCost: true },
  { cups: '891901', name: 'Polisomnografía', specialty: 'Neurología', amount: 690, highCost: false },
  { cups: '890263', name: 'Consulta especializada de cardiología', specialty: 'Cardiología', amount: 95, highCost: false },
];

export const EVIDENCE_LABELS: Record<EvidenceCode, string> = {
  nota_consulta: 'Nota de consulta con justificación clínica',
  diagnostico: 'Diagnóstico CIE-10 confirmado',
  imagen_previa: 'Imagen diagnóstica previa (Rx / eco)',
  tratamiento_conservador: 'Tratamiento conservador ≥ 6 semanas documentado',
  laboratorios: 'Resultados de laboratorio recientes (< 90 días)',
  escala_funcional: 'Escala funcional / de severidad',
  historia_previa: 'Historial de tratamientos previos',
  concepto_especialista: 'Concepto de especialista tratante',
};

const BASE_EVIDENCE: Record<string, EvidenceCode[]> = {
  '883522': ['nota_consulta', 'diagnostico', 'imagen_previa', 'tratamiento_conservador'],
  '452301': ['nota_consulta', 'diagnostico', 'laboratorios'],
  '881201': ['nota_consulta', 'diagnostico'],
  '806101': ['nota_consulta', 'diagnostico', 'imagen_previa', 'tratamiento_conservador', 'escala_funcional'],
  '879301': ['nota_consulta', 'diagnostico', 'imagen_previa'],
  '133100': ['nota_consulta', 'diagnostico', 'escala_funcional', 'concepto_especialista'],
  '891901': ['nota_consulta', 'diagnostico', 'escala_funcional'],
  '890263': ['nota_consulta'],
};

export const payerById = (id: string) => PAYERS.find((p) => p.id === id)!;
export const procedureByCups = (cups: string) => PROCEDURES.find((p) => p.cups === cups)!;

/** Tabla de decisión: pagador × CUPS → requiere PA, evidencia, SLA. */
export function policyFor(payerId: string, cups: string): PolicyResult {
  const payer = payerById(payerId);
  const proc = procedureByCups(cups);
  if (payer.type === 'Particular') {
    return { requiresPA: false, evidence: [], slaHours: 0, policyVersion: 'v1' };
  }
  // consulta de cardiología solo requiere PA en Prepagada (requisito ampliado desde 2024)
  const requiresPA = cups !== '890263' || payer.type === 'Prepagada';
  const codes = [...(BASE_EVIDENCE[cups] ?? ['nota_consulta'])];
  if (payer.type === 'Prepagada' && proc.amount > 300 && !codes.includes('historia_previa')) codes.push('historia_previa');
  if (proc.highCost && !codes.includes('concepto_especialista')) codes.push('concepto_especialista');
  const evidence: EvidenceRequirement[] = codes.map((code) => ({ code, label: EVIDENCE_LABELS[code] }));
  return {
    requiresPA,
    evidence: requiresPA ? evidence : [],
    slaHours: payer.slaHours,
    policyVersion: payer.type === 'Prepagada' ? 'v2024.3' : 'v2023.1',
  };
}

export const CHANNEL_LABEL: Record<string, string> = {
  api: 'API',
  portal: 'Portal (RPA)',
  whatsapp: 'WhatsApp Business',
  fax: 'Fax saliente',
};
