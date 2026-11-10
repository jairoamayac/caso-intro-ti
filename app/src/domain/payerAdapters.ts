// Adapter + Factory Method + Circuit Breaker por pagador (docs/04-arquitectura.md §10)
// En producción viven en el Hub de integración; aquí se simulan en el navegador.
import { payerById } from './payers';
import type { AuthorizationRequest, Channel } from './types';

export interface SubmissionReceipt {
  reference: string;
  channel: Channel;
  detail: string;
}

export interface PayerAdapter {
  channel: Channel;
  submit(req: AuthorizationRequest): SubmissionReceipt;
}

const ref = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

class ApiPayerAdapter implements PayerAdapter {
  channel: Channel = 'api';
  constructor(private payerId: string) {}
  submit(): SubmissionReceipt {
    return { reference: ref('API'), channel: this.channel, detail: `POST /prior-auth → 201 Created (${this.payerId})` };
  }
}

/** Template Method en producción: login → navegar → formulario → anexos → acuse. */
class RpaPayerAdapter implements PayerAdapter {
  channel: Channel = 'portal';
  submit(): SubmissionReceipt {
    return { reference: ref('RAD'), channel: this.channel, detail: 'Bot RPA: login ✓ formulario ✓ 4 anexos ✓ acuse capturado' };
  }
}

class WhatsAppPayerAdapter implements PayerAdapter {
  channel: Channel = 'whatsapp';
  submit(): SubmissionReceipt {
    return { reference: ref('WA'), channel: this.channel, detail: 'Plantilla WhatsApp Business enviada con expediente PDF firmado' };
  }
}

class FaxPayerAdapter implements PayerAdapter {
  channel: Channel = 'fax';
  submit(): SubmissionReceipt {
    return { reference: ref('FAX'), channel: this.channel, detail: 'Fax digital saliente con confirmación de entrega' };
  }
}

// ---- Circuit breaker (estado en memoria por pagador)
export type BreakerState = 'cerrado' | 'abierto' | 'semiabierto';
const breakers: Record<string, BreakerState> = { 'pre-aurora': 'semiabierto', 'eps-meridiano': 'abierto' };
export const breakerState = (payerId: string): BreakerState => breakers[payerId] ?? 'cerrado';
export const setBreaker = (payerId: string, s: BreakerState) => (breakers[payerId] = s);

export function adapterFor(payerId: string): PayerAdapter {
  const payer = payerById(payerId);
  switch (payer.channel) {
    case 'api':
      return new ApiPayerAdapter(payerId);
    case 'portal':
      return new RpaPayerAdapter();
    case 'whatsapp':
      return new WhatsAppPayerAdapter();
    case 'fax':
      return new FaxPayerAdapter();
  }
}

/** Radicación idempotente: si ya tiene referencia, no se vuelve a radicar. */
export function submitIdempotent(req: AuthorizationRequest): SubmissionReceipt | { deferred: true; reason: string } {
  if (req.payerReference) return { reference: req.payerReference, channel: req.channel!, detail: 'Idempotencia: ya radicada' };
  if (breakerState(req.payerId) === 'abierto') {
    return { deferred: true, reason: 'Circuito abierto: portal del pagador no disponible. Reintento automático en 30 min.' };
  }
  return adapterFor(req.payerId).submit(req);
}
