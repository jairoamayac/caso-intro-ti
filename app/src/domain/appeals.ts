// Negaciones como inventario con valor (P7). Experto: la negación conoce su valor esperado.
import { patientById } from './seed';
import { payerById, procedureByCups } from './payers';
import type { AuthorizationRequest, Denial, DenialCategory } from './types';

export const CATEGORY_LABEL: Record<DenialCategory, string> = {
  falta_evidencia: 'Falta de evidencia clínica',
  no_pertinencia: 'No pertinencia médica',
  codigo_errado: 'Código / formato errado',
  no_cubierto: 'No cubierto por el plan',
  extemporanea: 'Radicación extemporánea',
};

/** Probabilidad histórica de revocación por categoría (supuesto ilustrativo). */
export const REVERSAL_P: Record<DenialCategory, number> = {
  falta_evidencia: 0.55,
  codigo_errado: 0.7,
  no_pertinencia: 0.32,
  extemporanea: 0.25,
  no_cubierto: 0.08,
};

export const APPEAL_THRESHOLD = 60; // USD de valor esperado

export function makeDenial(category: DenialCategory): Denial {
  const reasons: Record<DenialCategory, string> = {
    falta_evidencia: 'No se evidencia tratamiento conservador previo suficiente.',
    no_pertinencia: 'El procedimiento no se considera pertinente para el diagnóstico reportado.',
    codigo_errado: 'El código CUPS no corresponde al plan de beneficios del afiliado.',
    no_cubierto: 'Servicio excluido del plan contratado.',
    extemporanea: 'Solicitud radicada fuera de los términos.',
  };
  return { category, reason: reasons[category], reversalProbability: REVERSAL_P[category] };
}

export const expectedValue = (req: AuthorizationRequest) =>
  req.denial ? req.denial.reversalProbability * procedureByCups(req.cups).amount : 0;

export const shouldAppeal = (req: AuthorizationRequest) =>
  expectedValue(req) >= APPEAL_THRESHOLD || req.urgency !== 'rutina';

/** Simula el borrador generado por IA: solo cita evidencia presente en el expediente. */
export function draftAppeal(req: AuthorizationRequest): string {
  const p = patientById(req.patientId);
  const proc = procedureByCups(req.cups);
  const payer = payerById(req.payerId);
  const evidence = req.dossier
    .filter((d) => d.status !== 'missing')
    .map((d, i) => `  ${i + 1}. ${d.label}${d.source ? ` — fuente: ${d.source}` : ''}${d.excerpt ? `\n     ${d.excerpt}` : ''}`)
    .join('\n');
  return `Señores ${payer.name}
Área de autorizaciones

Ref.: Solicitud de revisión de la negación ${req.payerReference ?? ''} — ${proc.name} (CUPS ${proc.cups})
Paciente: ${p.name} · Documento ${p.documentId} · Plan ${p.plan}

Respetados señores:

Solicitamos la revisión de la negación notificada con el motivo "${req.denial?.reason}".
La necesidad médica del servicio está soportada por la siguiente evidencia contenida en la historia clínica:

${evidence}

Con base en lo anterior, el servicio es pertinente y necesario para el diagnóstico del paciente,
y su no realización compromete su evolución clínica. Solicitamos revocar la negación y emitir la
autorización correspondiente dentro de los términos establecidos.

Quedamos atentos a la llamada de revisión.

${req.physician}
Médico tratante — Organización de Salud Niágara

[Borrador generado por IA a partir del expediente. Requiere validación y firma del gestor clínico.]`;
}
