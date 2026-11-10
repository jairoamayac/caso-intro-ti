# 03 · Pipelines de automatización

El proceso TO-BE se implementa como **pipelines encadenados por eventos**. Cada pipeline sigue el estilo **Pipes & Filters**: filtros independientes, sin estado compartido, que reciben un mensaje, lo transforman/enriquecen y lo pasan al siguiente. Esto permite agregar, quitar o reordenar pasos (por ejemplo, un nuevo pagador) sin tocar el resto.

```mermaid
flowchart LR
    P1[P1 · Ingesta<br/>de órdenes] -->|order.normalized| P2[P2 · Elegibilidad<br/>y reglas]
    P2 -->|pa.required| P3[P3 · Expediente<br/>clínico]
    P2 -->|pa.not_required| P6
    P3 -->|dossier.complete| P4[P4 · Radicación<br/>multi-pagador]
    P4 -->|request.submitted| P5[P5 · Seguimiento<br/>y SLA]
    P5 -->|decision.approved| P6[P6 · Agenda y<br/>notificación]
    P5 -->|decision.denied| P7[P7 · Negaciones<br/>y apelaciones]
    P7 -->|appeal.won| P6
    P1 & P2 & P3 & P4 & P5 & P6 & P7 -.->|todos los eventos| P8[P8 · Analítica<br/>y aprendizaje]
    P8 -.->|reglas v+1| P2
```

Convenciones comunes a todos los pipelines:

- **Mensaje**: sobre JSON con `case_id`, `event_id` (UUID, clave de idempotencia), `trace_id`, `payer_id`, `occurred_at`, `payload`.
- **Idempotencia**: cada filtro registra `event_id` procesados → un reintento nunca radica dos veces.
- **Error**: 3 reintentos con *backoff* exponencial + *jitter* → luego cola de mensajes muertos (DLQ) → tarea humana en la bandeja de excepciones.
- **Trazabilidad**: cada filtro publica un evento de dominio que queda en la bitácora del caso (auditoría).

---

## P1 · Ingesta de órdenes

| Filtro | Entrada | Salida | Tecnología |
|---|---|---|---|
| 1.1 Receptor multicanal | FHIR `ServiceRequest` (HCE), fax (PDF/TIFF), formulario web, correo | Documento crudo + canal | API REST, buzón de fax digital |
| 1.2 OCR | PDF/imagen | Texto + layout | Textract / Azure Document Intelligence / Tesseract |
| 1.3 Extracción IA | Texto | Campos: paciente, documento, CUPS, CIE-10, médico, urgencia | LLM con *structured output* + validación de esquema |
| 1.4 Normalización | Campos | Solicitud canónica (códigos validados contra catálogos CUPS / CIE-10) | Servicio de terminologías |
| 1.5 Deduplicación | Solicitud | Caso nuevo o vinculado | Hash (paciente + CUPS + fecha) |
| 1.6 Confianza | Solicitud + score | Si confianza < 0,9 → tarea humana de validación | Regla |

**Evento de salida:** `order.normalized`. **KPI:** % órdenes sin digitación humana (meta ≥ 95 %).

## P2 · Elegibilidad y reglas de PA

| Filtro | Qué hace |
|---|---|
| 2.1 Resolver pagador | Identifica EPS/Prepagada/Sisbén/particular por documento del paciente (caché 24 h) |
| 2.2 Consultar derechos | Adaptador del pagador: API (4 pagadores) o bot RPA (10) → afiliación activa, plan |
| 2.3 Motor de reglas (DMN) | `pagador × plan × CUPS → {requiere_pa, evidencia_requerida[], sla_horas, canal}` |
| 2.4 Priorización | Urgencia clínica + SLA → prioridad de cola |

**Eventos:** `pa.required` / `pa.not_required` / `eligibility.failed`. **KPI:** tiempo de elegibilidad < 2 min.

## P3 · Construcción del expediente clínico (el cuello de botella eliminado)

```mermaid
flowchart LR
    A[Checklist del pagador<br/>para el CUPS] --> B[Recuperar documentos HCE<br/>FHIR: DocumentReference,<br/>Observation, MedicationStatement]
    B --> C[IA: mapear evidencia<br/>a cada ítem del checklist<br/>con cita a la fuente]
    C --> D{Completitud}
    D -- 100% --> E[Puntaje necesidad médica<br/>+ riesgo de negación]
    D -- menor a 100% --> F[Tarea al médico:<br/>solo ítems faltantes<br/>+ texto sugerido]
    F --> B
    E --> G{Riesgo alto o<br/>costo alto?}
    G -- Sí --> H[Bandeja gestor clínico]
    G -- No --> I[dossier.complete]
    H --> I
```

- Cada ítem del checklist guarda **la cita exacta** a la fuente en la HCE (documento, fecha, fragmento) → auditable y sin alucinaciones aceptadas.
- El puntaje de riesgo usa histórico por pagador/CUPS/motivo de negación (modelo de clasificación simple, explicable).
- **KPI:** % expedientes completos sin contacto humano (meta ≥ 85 %), tiempo medio de completitud.

## P4 · Radicación multi-pagador

| Filtro | Qué hace |
|---|---|
| 4.1 Selección de adaptador | *Factory* devuelve el adaptador del pagador (API, RPA, WhatsApp Business, fax saliente) |
| 4.2 Transformación | Expediente canónico → formato del pagador (formularios, anexos PDF firmados) |
| 4.3 Envío idempotente | `idempotency_key = case_id + intento`; *circuit breaker* por pagador |
| 4.4 Acuse | Guarda número de radicado del pagador + evidencia (captura/recibo) |

**Evento:** `request.submitted`. **KPI:** % radicado automático (meta ≥ 80 %).

## P5 · Seguimiento de estado y SLA

- **Push**: webhooks de pagadores integrados.
- **Pull**: bot de consulta programado por pagador (cada 2–4 h, ventana hábil), no "cada día a mano".
- **Temporizador SLA** (BPMN timer): al 80 % del SLA → alerta; al 100 % → tarea de escalamiento al gestor.

**Eventos:** `decision.approved` / `decision.denied` / `decision.info_requested` / `sla.breached`.

## P6 · Agenda y notificación

1. Registrar número de autorización y vigencia.
2. Autoagendar en el Sistema de Citas (primer cupo disponible del especialista).
3. Notificar a médico (HCE) y paciente (WhatsApp/SMS/correo) con recordatorios a −72 h y −24 h.
4. Si `info_requested`: volver a P3 con los ítems nuevos.

**KPI:** días orden → cita; % pacientes que abandonan.

## P7 · Negaciones y apelaciones

```mermaid
flowchart LR
    A[decision.denied] --> B[Clasificar motivo<br/>catálogo: falta evidencia,<br/>no cubierto, código errado,<br/>no pertinencia, ...]
    B --> C[Calcular valor esperado<br/>VE = P revocar × monto]
    C --> D{VE mayor a umbral<br/>o urgencia clínica?}
    D -- No --> E[Cerrar con causa<br/>y aprendizaje]
    D -- Sí --> F[IA redacta apelación<br/>citando evidencia + guías]
    F --> G[Gestor clínico valida<br/>y firma]
    G --> H[Agendar llamada de<br/>revisión mismo día]
    H --> I{¿Revocada?}
    I -- Sí --> J[appeal.won → P6]
    I -- No --> K[Expediente de tutela<br/>acompañado]
    B --> L[(Feedback a reglas P2/P3)]
```

**KPI:** % negaciones evaluables apeladas (meta ≥ 85 %), tasa de revocación, $ recuperados.

## P8 · Analítica y aprendizaje (datos)

| Etapa | Qué hace |
|---|---|
| 8.1 Captura (CDC / eventos) | Todos los eventos de dominio → *data lake* (formato columnar) |
| 8.2 Modelo de datos | Hechos: casos, decisiones, apelaciones, tiempos por etapa. Dimensiones: pagador, CUPS, médico, sede |
| 8.3 Tablero | KPIs §4.4 en tiempo real; *ranking* de pagadores por negación y tiempo |
| 8.4 Reentrenamiento | Mensual: modelos de riesgo de negación y de revocación; validación con métricas y sesgo |
| 8.5 Propuesta de reglas | Motivos de negación recurrentes → propuesta de cambio en DMN/checklist → aprobación del líder PA → versión nueva |
| 8.6 Evidencia para pagadores | Reporte de tasa de aprobación por médico → negociación de *gold-carding* |

---

## P9 · Pipeline de entrega de software (CI/CD)

```mermaid
flowchart LR
    A[Commit / PR] --> B[Lint + tipos]
    B --> C[Pruebas unitarias<br/>dominio + reglas DMN]
    C --> D[Pruebas de contrato<br/>adaptadores de pagador]
    D --> E[SAST + escaneo de<br/>dependencias + secretos]
    E --> F[Build imagen<br/>contenedor firmada]
    F --> G[Deploy a staging<br/>datos sintéticos]
    G --> H[Pruebas E2E + regresión<br/>de prompts IA]
    H --> I{Aprobación<br/>manual}
    I --> J[Deploy producción<br/>canary 10% → 100%]
    J --> K[Monitoreo SLO<br/>rollback automático]
```

- **Pruebas de contrato por pagador**: cada adaptador tiene un *mock* del portal/API grabado; si el pagador cambia su portal, el bot RPA falla en staging antes que en producción.
- **Regresión de IA**: conjunto de 200 expedientes anonimizados con resultado esperado; un cambio de prompt o modelo no se despliega si la precisión de extracción baja > 2 pp.
- **Datos**: staging solo con datos sintéticos (Ley 1581 de 2012).

---

➡️ Continúa en [04-arquitectura.md](04-arquitectura.md).
