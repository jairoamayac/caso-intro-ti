// Experto: el expediente calcula su propia completitud.
// Strategy: el puntaje de riesgo es intercambiable (reglas hoy, modelo ML mañana).
import { EVIDENCE_LABELS, payerById, procedureByCups } from './payers';
import type { AuthorizationRequest, EvidenceItem, EvidenceRequirement, Patient } from './types';

export function completeness(dossier: EvidenceItem[]): number {
  if (dossier.length === 0) return 1;
  return dossier.filter((d) => d.status !== 'missing').length / dossier.length;
}

export const missingItems = (dossier: EvidenceItem[]) => dossier.filter((d) => d.status === 'missing');

const SOURCES: Record<string, string> = {
  nota_consulta: 'HCE › Evolución médica',
  diagnostico: 'HCE › Diagnósticos',
  imagen_previa: 'PACS › Informe de imagen',
  tratamiento_conservador: 'HCE › Plan de manejo',
  laboratorios: 'LIS › Resultados',
  escala_funcional: 'HCE › Escalas',
  historia_previa: 'HCE › Antecedentes',
  concepto_especialista: 'HCE › Interconsultas',
};

const EXCERPTS: Record<string, string> = {
  nota_consulta: '"Dolor persistente que limita actividades diarias; se solicita estudio para definir conducta."',
  diagnostico: 'Código CIE-10 confirmado por médico tratante en la consulta.',
  imagen_previa: '"Rx sin lesión ósea; hallazgos no concluyentes, se sugiere estudio complementario."',
  tratamiento_conservador: '"8 semanas de fisioterapia y AINES sin mejoría significativa."',
  laboratorios: 'Hemograma y química sanguínea de hace 34 días.',
  escala_funcional: 'Escala de severidad registrada: moderada-severa.',
  historia_previa: 'Antecedentes y manejos previos registrados en 2 consultas.',
  concepto_especialista: '"Paciente candidato a procedimiento según especialista tratante."',
};

/** Simula la extracción con IA (P3): busca cada requisito en la HCE y cita la fuente. */
export function extractEvidence(patient: Patient, reqs: EvidenceRequirement[]): EvidenceItem[] {
  return reqs.map((r, i) => {
    const found = patient.available.includes(r.code);
    return found
      ? {
          code: r.code,
          label: r.label,
          status: 'found',
          source: `${SOURCES[r.code]} · ${new Date(Date.now() - (i + 3) * 86400000 * 4).toLocaleDateString('es-CO')}`,
          excerpt: EXCERPTS[r.code],
          confidence: 0.9 + ((patient.name.length + i) % 9) / 100,
        }
      : { code: r.code, label: EVIDENCE_LABELS[r.code], status: 'missing' };
  });
}

export interface RiskScorer {
  name: string;
  score(req: Pick<AuthorizationRequest, 'payerId' | 'cups' | 'dossier' | 'urgency'>): number;
}

/** Estrategia por reglas: base del pagador, ajustada por completitud y costo. */
export const RuleBasedScorer: RiskScorer = {
  name: 'Reglas v1',
  score(req) {
    const payer = payerById(req.payerId);
    const proc = procedureByCups(req.cups);
    const c = completeness(req.dossier);
    let risk = payer.baseDenialRate * (c < 1 ? 2.2 : 0.55);
    if (proc.highCost) risk += 0.08;
    if (req.urgency === 'urgente') risk -= 0.03;
    return Math.max(0.02, Math.min(0.95, risk));
  },
};

export const needsClinicalReview = (risk: number, cups: string) =>
  risk >= 0.2 || procedureByCups(cups).highCost;
