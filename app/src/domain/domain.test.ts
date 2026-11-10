import { describe, expect, it } from 'vitest';
import { canTransition } from './stateMachine';
import { computeValue, SCENARIOS } from './value';
import { policyFor } from './payers';
import * as wf from './workflow';
import { setBreaker } from './payerAdapters';

describe('modelo de valor (docs/05 §1.2)', () => {
  it('escenario base ≈ $2,85 M', () => {
    const v = computeValue(SCENARIOS.Base);
    expect(v.total / 1e6).toBeCloseTo(2.848, 2);
    expect(Math.round(v.patientsRecovered)).toBe(662);
  });
  it('conservador ≈ $1,73 M y optimista ≈ $3,48 M', () => {
    expect(computeValue(SCENARIOS.Conservador).total / 1e6).toBeCloseTo(1.732, 2);
    expect(computeValue(SCENARIOS.Optimista).total / 1e6).toBeCloseTo(3.481, 2);
  });
});

describe('máquina de estados', () => {
  it('no permite radicar sin expediente completo', () => {
    expect(canTransition('DOCS_PENDING', 'SUBMITTED')).toBe(false);
    expect(canTransition('READY', 'SUBMITTED')).toBe(true);
  });
});

describe('flujo TO-BE', () => {
  it('pago directo no requiere PA y se agenda', () => {
    expect(policyFor('particular', '883522').requiresPA).toBe(false);
    const r = wf.createRequest({ patientId: 'p12', cups: '883522', physician: 'x', urgency: 'rutina' });
    expect(r.status).toBe('SCHEDULED');
  });
  it('faltante → médico completa → se radica sola', () => {
    let r = wf.createRequest({ patientId: 'p1', cups: '883522', physician: 'x', urgency: 'rutina' });
    expect(r.status).toBe('DOCS_PENDING');
    r = wf.provideEvidence(r, 'tratamiento_conservador', '8 semanas de fisioterapia');
    expect(['SUBMITTED', 'CLINICAL_REVIEW']).toContain(r.status);
  });
  it('circuito abierto difiere la radicación (no la pierde)', () => {
    setBreaker('eps-meridiano', 'abierto');
    const r = wf.createRequest({ patientId: 'p8', cups: '879301', physician: 'x', urgency: 'rutina' });
    expect(r.status).toBe('READY');
    expect(r.events.at(-1)?.type).toBe('submit.deferred');
  });
  it('negación con valor genera borrador y la apelación ganada agenda', () => {
    let r = wf.createRequest({ patientId: 'p2', cups: '883522', physician: 'x', urgency: 'rutina' });
    r = wf.payerDecision(r, false, 'falta_evidencia');
    expect(r.appeal?.status).toBe('draft');
    r = wf.signAppeal(r, r.appeal!.draft);
    r = wf.appealOutcome(r, true);
    expect(r.status).toBe('SCHEDULED');
  });
});
