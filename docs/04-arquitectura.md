# 04 · Arquitectura técnica — Plataforma "Niágara Autoriza"

> Elaborada con la skill [arquitectura-de-software](https://github.com/jairoamayac/arquitectura-de-software): diagnóstico primero, estilo según atributos de calidad, documentación C4 por niveles, patrones con sus 4 elementos (nombre, problema, solución, consecuencias). Decisiones registradas en [`adr/`](adr/).

---

## 1. Diagnóstico del sistema actual

| Síntoma de mal diseño | Evidencia en Niágara | Anti-patrón | Corrección |
|---|---|---|---|
| **Rigidez** | Agregar un pagador o cambiar una regla de Prepagada exige reentrenar personas | Conocimiento tribal, *Golden Hammer* (todo en Excel) | Reglas como datos (DMN) + Adapter por pagador |
| **Fragilidad** | Si un coordinador se va (34 %), se pierde cómo funciona un portal | *God Object* humano: una persona = todo el proceso | Workflow explícito, roles por bandeja |
| **Inmovilidad** | El Excel no se puede reutilizar para analítica ni integración | *Big Ball of Mud* (hoja compartida sin modelo) | Modelo de dominio + base de datos transaccional |
| **Viscosidad** | Es más fácil llamar que corregir el proceso | Proceso guiado por la herramienta | BPMN ejecutable + métricas |
| Consistencia | Estado del caso en Excel, portal, WhatsApp y correo a la vez | *Dual write* manual | Fuente única de verdad + Outbox |

## 2. Atributos de calidad (drivers)

| Prioridad | Atributo | Escenario medible |
|---|---|---|
| 1 | **Seguridad y privacidad** | Datos clínicos cifrados en tránsito y reposo; acceso por rol mínimo; 100 % de accesos auditados (Ley 1581/2012, Res. 1995/1999). |
| 2 | **Modificabilidad** | Agregar un pagador nuevo en ≤ 2 semanas sin tocar el núcleo; cambiar una regla en ≤ 1 día sin despliegue. |
| 3 | **Resiliencia / disponibilidad** | Caída del portal de un pagador no afecta a los otros 13; 99,5 % disponibilidad hábil. |
| 4 | **Trazabilidad** | Reconstruir la historia completa de cualquier caso (quién, qué, cuándo, con qué evidencia). |
| 5 | **Interoperabilidad** | HL7 FHIR R4 con la HCE; formatos de cada pagador vía adaptadores. |
| 6 | **Rendimiento** | Elegibilidad < 2 min; expediente < 5 min; tablero < 2 s. Volumen bajo (~2.400/mes, picos 200/día). |
| 7 | **Explicabilidad de la IA** | Toda salida de IA cita su fuente; ninguna decisión clínica final sin humano. |

## 3. Decisión de estilo arquitectónico

**Volumen bajo (≈ 110 solicitudes/día) + equipo de TI pequeño ⇒ NO microservicios por defecto.**

Se elige un **monolito modular hexagonal** (núcleo de dominio) + **motor de workflow BPMN** + **un servicio separado de integración con pagadores**, comunicados por **eventos**:

| Pieza | Estilo | Por qué |
|---|---|---|
| Núcleo PA | Monolito modular en capas / hexagonal | Un solo despliegue, transacciones locales, fácil de operar. Módulos con bajo acoplamiento listos para extraer si algún día se necesita. |
| Orquestación | Saga orquestada por motor BPMN | El proceso *es* un BPMN: timers SLA, tareas humanas, compensaciones. |
| Hub de integración con pagadores | Servicio independiente + Pipes & Filters | Perfil de falla distinto (portales caídos, bots RPA lentos); se aísla para que no tumbe el núcleo (*bulkhead*). Escala y se despliega aparte cuando un pagador cambia. |
| Pipeline documental IA | Pipes & Filters asíncrono | OCR → extracción → mapeo → validación son filtros independientes. |
| Comunicación | Event-Driven (pub/sub) + Outbox | Desacopla núcleo, hub, analítica y notificaciones. |
| Lectura / tableros | CQRS ligero (vistas materializadas) | Los KPIs no deben competir con la escritura transaccional. |

Ver [ADR-001](adr/ADR-001-estilo-arquitectonico.md).

---

## 4. C4 — Nivel 1: Contexto

```mermaid
flowchart TB
    MED([Médico / Consulta<br/>620 médicos])
    COORD([Gestor clínico PA<br/>equipo PA])
    PAC([Paciente])
    DIR([Dirección / Finanzas])

    SYS[[Niágara Autoriza<br/>Plataforma de autorización previa<br/>automatizada con IA]]

    HCE[(HCE / Historia Clínica<br/>Electrónica)]
    CITAS[(Sistema de Citas<br/>médicas)]
    PAG4[4 pagadores con API]
    PAG10[10 pagadores con portal web /<br/>teléfono / WhatsApp]
    FAX[Consultas no integradas<br/>fax]
    MSG[WhatsApp Business /<br/>SMS / correo]
    LLM[Servicio LLM + OCR<br/>nube privada]
    IDP[Directorio corporativo<br/>SSO]

    MED -->|ordena, completa faltantes| SYS
    COORD -->|gestiona excepciones y apelaciones| SYS
    DIR -->|consulta KPIs| SYS
    SYS -->|notifica cita| PAC
    SYS <-->|FHIR R4| HCE
    SYS -->|agenda| CITAS
    SYS <-->|API REST| PAG4
    SYS <-->|RPA / mensajería| PAG10
    FAX -->|órdenes escaneadas| SYS
    SYS --> MSG
    SYS -->|extracción / redacción| LLM
    SYS -->|autenticación| IDP
```

## 5. C4 — Nivel 2: Contenedores

```mermaid
flowchart TB
    subgraph USERS[Usuarios]
        U1([Gestor PA])
        U2([Médico])
        U3([Dirección])
    end

    subgraph PLAT[Niágara Autoriza]
        WEB[Web App SPA<br/>React + TypeScript<br/>bandejas, expediente, tablero]
        SMART[App embebida en HCE<br/>SMART on FHIR<br/>checklist del médico]
        GW[API Gateway / BFF<br/>auth OIDC, rate limit, auditoría]
        CORE[Núcleo PA<br/>monolito modular · Java/Kotlin Spring o TS NestJS<br/>casos, reglas, expediente, negaciones]
        WF[Motor de workflow<br/>Camunda 8 / Temporal<br/>BPMN + DMN + timers SLA]
        DOC[Pipeline documental IA<br/>workers Python<br/>OCR, extracción, mapeo]
        HUB[Hub de integración pagadores<br/>adaptadores API + orquestador RPA]
        BOTS[Granja de bots RPA<br/>Playwright / UiPath<br/>VMs aisladas]
        NOTIF[Servicio de notificaciones<br/>WhatsApp, SMS, correo]
        BUS[[Bus de eventos<br/>RabbitMQ / Amazon SQS+SNS]]
        DB[(PostgreSQL<br/>casos, reglas, outbox, bitácora)]
        OBJ[(Almacén de objetos cifrado<br/>documentos clínicos)]
        DW[(Data warehouse<br/>KPIs y modelos)]
        VAULT[(Secretos<br/>credenciales de portales)]
    end

    U1 & U3 --> WEB --> GW
    U2 --> SMART --> GW
    GW --> CORE
    CORE <--> WF
    CORE --> DB
    CORE --> OBJ
    CORE -- outbox --> BUS
    BUS --> DOC & HUB & NOTIF & DW
    DOC --> OBJ
    DOC -- resultados --> BUS
    HUB --> BOTS
    HUB --> VAULT
    HUB -- decisiones --> BUS
    BUS --> CORE

    HCE[(HCE)] <-->|FHIR| CORE
    DOC -->|FHIR read| HCE
    HUB <-->|REST| PAGA[Pagadores API]
    BOTS <-->|navegador| PAGP[Portales pagadores]
    NOTIF --> WA[WhatsApp Business API]
    DOC --> LLM[LLM + OCR]
```

| Contenedor | Responsabilidad | Tecnología propuesta |
|---|---|---|
| Web App | Bandejas por rol, detalle del caso, tablero, simulador | React + TypeScript (el MVP de este repo) |
| App SMART on FHIR | Checklist dentro de la HCE al momento de ordenar | React embebido, OAuth2 SMART |
| API Gateway / BFF | Entrada única, OIDC, auditoría de acceso, límites | Kong / AWS API Gateway |
| Núcleo PA | Dominio: casos, reglas, expediente, negaciones, apelaciones | Spring Boot (Kotlin) o NestJS, arquitectura hexagonal |
| Motor de workflow | Ejecuta BPMN TO-BE, DMN de reglas, timers SLA, tareas humanas | Camunda 8 (o Temporal) |
| Pipeline documental IA | OCR de fax, extracción de evidencia con citas, borradores de apelación | Python workers, Amazon Textract, Claude vía Amazon Bedrock |
| Hub de integración | Un adaptador por pagador, circuit breaker, idempotencia, orquesta bots | Servicio aparte (TS/Python) |
| Granja RPA | Navega portales sin API, radica, consulta estado | Playwright en contenedores / UiPath |
| Notificaciones | Paciente y médico | WhatsApp Business API, SMS |
| Bus de eventos | Pub/sub entre contenedores | RabbitMQ o SQS/SNS (volumen bajo: Kafka es excesivo) |
| PostgreSQL | Fuente única de verdad, outbox, bitácora | RDS PostgreSQL con RLS por sede |
| Objetos | Documentos clínicos y acuses | S3 con SSE-KMS, *object lock* para auditoría |
| Data warehouse | KPIs, entrenamiento de modelos | Redshift / BigQuery / Postgres analítico |
| Bóveda de secretos | Credenciales de 10 portales | AWS Secrets Manager / HashiCorp Vault, rotación |

## 6. C4 — Nivel 3: Componentes del Núcleo PA

```mermaid
flowchart TB
    subgraph IN[Adaptadores de entrada]
        REST[Controladores REST<br/>CaseController, InboxController]
        FHIRIN[Receptor FHIR<br/>ServiceRequest]
        EVIN[Consumidores de eventos<br/>idempotentes]
        WFW[Job workers del workflow]
    end
    subgraph APP[Capa de aplicación · casos de uso]
        UC1[CrearSolicitud]
        UC2[EvaluarElegibilidad]
        UC3[ConstruirExpediente]
        UC4[RadicarSolicitud]
        UC5[RegistrarDecision]
        UC6[GestionarNegacion]
        UC7[ConsultarKPIs - query]
    end
    subgraph DOM[Dominio]
        AGG[Agregado AuthorizationRequest<br/>máquina de estados]
        DOSSIER[ClinicalDossier<br/>completitud]
        RULES[PayerPolicy / RuleEngine<br/>DMN]
        SCORE[RiskScorer<br/>Strategy]
        DENIAL[Denial + AppealPolicy<br/>valor esperado]
        EVENTS[Eventos de dominio]
    end
    subgraph OUT[Puertos de salida / adaptadores]
        REPO[Repositorios JPA/SQL]
        OUTBOX[Outbox publisher]
        HCEC[Cliente FHIR HCE]
        PAYERP[Puerto PayerGateway<br/>→ Hub de integración]
        AIP[Puerto DocumentAI<br/>→ pipeline IA]
        SCHED[Puerto Scheduling<br/>→ Sistema de Citas]
    end
    REST & FHIRIN & EVIN & WFW --> APP
    APP --> DOM
    APP --> OUT
    DOM --> EVENTS --> OUTBOX
```

Regla de dependencia (hexagonal): **el dominio no depende de nada externo**; la aplicación depende del dominio y de *puertos* (interfaces); los adaptadores implementan los puertos (Inversión de Dependencias).

## 7. C4 — Nivel 4: Modelo de dominio (diagrama de clases)

```mermaid
classDiagram
    direction LR
    class AuthorizationRequest {
        +UUID id
        +RequestStatus status
        +Priority priority
        +DateTime orderedAt
        +DateTime slaDueAt
        +submit(PayerGateway)
        +recordDecision(Decision)
        +canTransitionTo(RequestStatus) bool
    }
    class Patient {
        +String documentId
        +String name
        +PayerId payerId
        +String planCode
    }
    class ServiceOrder {
        +String cupsCode
        +String cie10Code
        +String orderingPhysician
        +Urgency urgency
    }
    class Payer {
        +PayerId id
        +PayerType type
        +IntegrationChannel channel
        +int slaHours
    }
    class PayerPolicy {
        +String cupsCode
        +bool requiresPA
        +List~EvidenceRequirement~ evidence
        +int version
        +requirementsFor(ServiceOrder)
    }
    class ClinicalDossier {
        +List~EvidenceItem~ items
        +completeness() float
        +missingItems() List
    }
    class EvidenceItem {
        +String requirementCode
        +String sourceRef
        +String excerpt
        +float confidence
    }
    class Decision {
        +DecisionType type
        +String payerReference
        +String denialReasonCode
        +DateTime decidedAt
    }
    class Denial {
        +DenialCategory category
        +Money amount
        +float reversalProbability
        +expectedValue() Money
        +shouldAppeal(threshold) bool
    }
    class Appeal {
        +AppealStatus status
        +String draftText
        +String signedBy
    }
    class CaseEvent {
        +UUID eventId
        +String type
        +String actor
        +DateTime at
        +json payload
    }
    class RequestStatus {
        <<enumeration>>
        RECEIVED
        ELIGIBILITY_CHECK
        DOCS_PENDING
        READY
        CLINICAL_REVIEW
        SUBMITTED
        APPROVED
        DENIED
        APPEALED
        SCHEDULED
        CLOSED
    }
    class PayerAdapter {
        <<interface>>
        +checkEligibility(Patient)
        +submit(AuthorizationRequest, ClinicalDossier) SubmissionReceipt
        +fetchStatus(String ref) Decision
    }
    class ApiPayerAdapter
    class RpaPayerAdapter
    class WhatsAppPayerAdapter
    class PayerAdapterFactory {
        +forPayer(PayerId) PayerAdapter
    }
    class RiskScorer {
        <<interface>>
        +score(AuthorizationRequest, ClinicalDossier) float
    }

    AuthorizationRequest "1" --> "1" Patient
    AuthorizationRequest "1" --> "1" ServiceOrder
    AuthorizationRequest "1" --> "1" Payer
    AuthorizationRequest "1" *-- "1" ClinicalDossier
    AuthorizationRequest "1" *-- "0..*" Decision
    AuthorizationRequest "1" *-- "0..*" CaseEvent
    AuthorizationRequest --> RequestStatus
    ClinicalDossier "1" *-- "0..*" EvidenceItem
    Payer "1" o-- "0..*" PayerPolicy
    Decision <|-- Denial
    Denial "1" --> "0..1" Appeal
    PayerAdapter <|.. ApiPayerAdapter
    PayerAdapter <|.. RpaPayerAdapter
    PayerAdapter <|.. WhatsAppPayerAdapter
    PayerAdapterFactory ..> PayerAdapter : crea
```

### 7.1 Máquina de estados del caso (patrón State)

```mermaid
stateDiagram-v2
    [*] --> RECEIVED
    RECEIVED --> ELIGIBILITY_CHECK
    ELIGIBILITY_CHECK --> SCHEDULED: no requiere PA
    ELIGIBILITY_CHECK --> DOCS_PENDING: requiere PA
    DOCS_PENDING --> DOCS_PENDING: médico completa / IA reextrae
    DOCS_PENDING --> READY: completitud 100%
    READY --> CLINICAL_REVIEW: riesgo alto
    CLINICAL_REVIEW --> READY: aprobado por gestor
    READY --> SUBMITTED: radicado (API/RPA)
    SUBMITTED --> DOCS_PENDING: pagador pide info
    SUBMITTED --> APPROVED
    SUBMITTED --> DENIED
    DENIED --> APPEALED: VE > umbral
    DENIED --> CLOSED: no apelable
    APPEALED --> APPROVED: revocada
    APPEALED --> CLOSED: tutela / cierre
    APPROVED --> SCHEDULED
    SCHEDULED --> CLOSED: servicio prestado
```

### 7.2 Modelo de datos (ER)

```mermaid
erDiagram
    PAYER ||--o{ PAYER_POLICY : define
    PAYER ||--o{ AUTH_REQUEST : recibe
    PATIENT ||--o{ AUTH_REQUEST : tiene
    AUTH_REQUEST ||--|{ EVIDENCE_ITEM : contiene
    AUTH_REQUEST ||--o{ DECISION : obtiene
    DECISION ||--o| APPEAL : genera
    AUTH_REQUEST ||--o{ CASE_EVENT : registra
    AUTH_REQUEST ||--o{ TASK : genera
    OUTBOX }o--|| AUTH_REQUEST : publica
    PAYER { uuid id PK
        text name
        text type
        text channel
        int sla_hours }
    PAYER_POLICY { uuid id PK
        uuid payer_id FK
        text cups_code
        bool requires_pa
        jsonb evidence_required
        int version
        date valid_from }
    PATIENT { uuid id PK
        text document_id
        text name_enc
        uuid payer_id FK
        text plan_code }
    AUTH_REQUEST { uuid id PK
        uuid patient_id FK
        uuid payer_id FK
        text cups_code
        text cie10_code
        text status
        text priority
        numeric amount
        float completeness
        float risk_score
        timestamptz ordered_at
        timestamptz sla_due_at }
    EVIDENCE_ITEM { uuid id PK
        uuid request_id FK
        text requirement_code
        text source_ref
        text excerpt_enc
        float confidence }
    DECISION { uuid id PK
        uuid request_id FK
        text type
        text payer_reference
        text denial_reason
        timestamptz decided_at }
    APPEAL { uuid id PK
        uuid decision_id FK
        text status
        text draft
        text signed_by }
    CASE_EVENT { uuid event_id PK
        uuid request_id FK
        text type
        text actor
        jsonb payload
        timestamptz at }
    TASK { uuid id PK
        uuid request_id FK
        text role
        text kind
        timestamptz due_at }
    OUTBOX { uuid id PK
        uuid aggregate_id
        text event_type
        jsonb payload
        timestamptz published_at }
```

## 8. Secuencia — Radicación con un pagador sin API (RPA)

```mermaid
sequenceDiagram
    autonumber
    participant WF as Workflow (BPMN)
    participant CORE as Núcleo PA
    participant DB as PostgreSQL
    participant BUS as Bus de eventos
    participant HUB as Hub integración
    participant CB as Circuit breaker (pagador X)
    participant BOT as Bot RPA
    participant PORTAL as Portal pagador X

    WF->>CORE: job "radicar" (case_id)
    CORE->>DB: BEGIN · estado=SUBMITTING · INSERT outbox(submit.requested) · COMMIT
    DB-->>BUS: relay outbox → submit.requested
    BUS->>HUB: submit.requested (event_id)
    HUB->>HUB: ¿event_id ya procesado? (idempotencia)
    HUB->>CB: ¿circuito cerrado?
    alt circuito abierto (portal caído)
        CB-->>HUB: falla rápido
        HUB->>BUS: submit.deferred (reintento en 30 min)
    else circuito cerrado
        HUB->>BOT: radicar(expediente, credenciales de bóveda)
        BOT->>PORTAL: login · formulario · anexos
        PORTAL-->>BOT: número de radicado
        BOT-->>HUB: acuse + captura
        HUB->>BUS: request.submitted(radicado)
    end
    BUS->>CORE: request.submitted
    CORE->>DB: estado=SUBMITTED · bitácora
    CORE->>WF: completar job → inicia timer SLA
```

## 9. Despliegue

```mermaid
flowchart TB
    subgraph CLOUD[Nube - región con acuerdo de tratamiento de datos · VPC privada]
        subgraph PUB[Subred pública]
            WAF[WAF + CDN]
            ALB[Balanceador]
        end
        subgraph APPNET[Subred privada · aplicaciones]
            K8S[Clúster de contenedores<br/>EKS / ECS Fargate<br/>gateway, núcleo, hub, notif, workers IA]
            CAM[Camunda 8 SaaS / self-managed]
        end
        subgraph RPANET[Subred aislada · RPA]
            VMS[Bots RPA<br/>contenedores Playwright / VMs Windows<br/>salida solo a dominios de pagadores]
        end
        subgraph DATA[Subred de datos]
            RDS[(RDS PostgreSQL<br/>Multi-AZ · cifrado KMS)]
            MQ[[SQS/SNS o Amazon MQ]]
            S3[(S3 SSE-KMS<br/>object lock)]
            SM[(Secrets Manager)]
        end
        BED[Amazon Bedrock - Claude<br/>+ Textract · endpoints privados]
        OBS[Observabilidad<br/>OpenTelemetry · Grafana · alertas]
    end
    subgraph ONP[Niágara on-premise]
        HCE[(HCE)]
        CIT[(Sistema de Citas)]
        FAXS[Servidor de fax digital]
    end
    USER([Usuarios Niágara]) --> WAF --> ALB --> K8S
    K8S --> CAM
    K8S --> RDS & MQ & S3 & SM
    K8S --> BED
    VMS --> SM
    K8S <-->|VPN site-to-site / FHIR| HCE
    K8S <-->|VPN| CIT
    FAXS -->|SFTP / API| K8S
    VMS -->|HTTPS| PORTALES[Portales de pagadores]
    K8S --> OBS
```

**Seguridad:** SSO corporativo (OIDC) + MFA; RBAC por rol (médico, gestor, líder, auditor); cifrado KMS; datos clínicos nunca usados para entrenar modelos del proveedor de IA (endpoints privados, sin retención); bitácora inmutable de acceso; bots RPA con credenciales rotadas en bóveda y egress restringido.

---

## 10. Patrones aplicados (4 elementos)

### 10.1 Patrones GoF / GRASP

| Patrón | Problema | Solución en Niágara Autoriza | Consecuencias |
|---|---|---|---|
| **Adapter** (GoF estructural) | 14 pagadores con interfaces incompatibles (API, portal, WhatsApp, fax) | Interfaz `PayerAdapter` con `ApiPayerAdapter`, `RpaPayerAdapter`, `WhatsAppPayerAdapter` | ✅ El núcleo habla un solo idioma; nuevo pagador = nuevo adaptador. ⚠️ Un adaptador por pagador que mantener. |
| **Factory Method** | Elegir el adaptador correcto según el pagador y su canal | `PayerAdapterFactory.forPayer(id)` lee la configuración del pagador | ✅ Creación centralizada, sin `if` dispersos. |
| **Strategy** | Distintos algoritmos de riesgo/necesidad por tipo de servicio o pagador | `RiskScorer` intercambiable (`RuleBasedScorer`, `MLScorer`) | ✅ A/B de modelos; fallback a reglas si el modelo falla. |
| **State** | El caso cambia de comportamiento según su estado (11 estados) | `AuthorizationRequest` con transiciones válidas explícitas (§7.1) | ✅ Imposible radicar sin expediente completo. ⚠️ Más clases/transiciones que mantener. |
| **Chain of Responsibility** / Pipes & Filters | Pipeline documental con pasos opcionales | Filtros OCR → extracción → mapeo → validación encadenados | ✅ Agregar un filtro no rompe los demás. |
| **Template Method** | Todos los bots RPA siguen login → navegar → llenar → adjuntar → acuse | Clase base `PortalBot` con pasos abstractos por portal | ✅ Reutiliza manejo de errores, capturas y reintentos. |
| **Observer** (pub/sub) | Varios interesados en cada cambio (notificaciones, KPIs, auditoría) | Eventos de dominio publicados al bus | ✅ Bajo acoplamiento. ⚠️ Consistencia eventual. |
| **Facade** | La UI no debe conocer 6 casos de uso para mostrar un caso | BFF expone `GET /cases/{id}` compuesto | ✅ UI simple. |
| **GRASP Experto** | ¿Quién calcula la completitud? ¿y el valor esperado de apelar? | `ClinicalDossier.completeness()`, `Denial.expectedValue()` — tienen la información | ✅ Evita *Anemic Domain Model*. |
| **GRASP Controlador** | ¿Quién recibe los eventos del sistema? | Casos de uso (`RadicarSolicitud`…) coordinan, no los controladores REST | ✅ Lógica de aplicación testeable sin HTTP. |
| **GRASP Indirección** + Inversión de dependencias | El dominio no debe depender de la HCE ni de los pagadores | Puertos `PayerGateway`, `DocumentAI`, `ClinicalRecord` | ✅ Pruebas con *mocks*; cambiar de proveedor de IA sin tocar el dominio. |

### 10.2 Patrones distribuidos

| Patrón | Problema | Aplicación | Consecuencias |
|---|---|---|---|
| **Saga orquestada** | El proceso cruza núcleo, IA, hub, pagador y agenda sin transacción ACID | El motor BPMN orquesta; compensaciones: si la agenda falla tras aprobación → reintento + tarea humana; si se cancela la orden → anular radicado | ✅ Visible y auditable en el modelador. ⚠️ Dependencia del motor. |
| **Outbox** | Guardar estado y publicar evento sin *dual write* | Tabla `outbox` en la misma transacción; *relay* publica al bus | ✅ Nunca hay un caso "radicado" sin evento. |
| **Idempotent Consumer** | Reentregas del bus podrían radicar dos veces ante el pagador | Registro de `event_id` procesados + `idempotency_key` hacia el pagador | ✅ Crítico: una doble radicación genera rechazos. |
| **Circuit Breaker + Retry con backoff + Bulkhead** | Portales caídos o lentos (comunes) | Un circuito y un pool de bots **por pagador** | ✅ La caída de un pagador no afecta a los demás. |
| **Timeout + Fallback** | LLM u OCR lentos | Timeout 30 s; fallback a tarea humana de validación | ✅ El proceso nunca se bloquea por la IA. |
| **CQRS ligero** | Tablero de KPIs pesado | Vistas materializadas/DW alimentados por eventos | ✅ Lecturas rápidas. ⚠️ Retardo de segundos. |
| **Event log (auditoría)** | Trazabilidad legal (tutelas, auditorías del pagador) | `CASE_EVENT` inmutable por caso (sin *event sourcing* completo: no se justifica) | ✅ Historia completa a bajo costo. |
| **Strangler Fig** | Migrar desde el Excel y el trabajo manual sin "big bang" | Pagador por pagador: primero los 4 integrados, luego los de mayor volumen vía RPA | ✅ Riesgo controlado, valor temprano. |
| **API Gateway / BFF** | Dos clientes distintos (web de gestores y app SMART en HCE) | Un BFF por cliente detrás del gateway | ✅ Cada UI recibe lo que necesita. |

### 10.3 Uso de IA: dónde y con qué controles

| Uso | Modelo | Control de calidad |
|---|---|---|
| Fax → solicitud estructurada | OCR + LLM con *structured output* | Validación de esquema y catálogos; confianza < 0,9 → humano |
| Evidencia HCE → checklist | LLM con recuperación (RAG) sobre documentos del paciente | Cada ítem cita documento y fragmento; el gestor ve la fuente |
| Riesgo de negación / revocación | Modelo tabular explicable (regresión logística / árboles) | Métricas mensuales, revisión de sesgo por pagador/sede |
| Borrador de apelación | LLM | Solo cita evidencia del expediente; firma humana obligatoria |
| Clasificación de motivo de negación | LLM + catálogo cerrado | Muestreo de calidad 5 % |

---

## 11. Mapeo con el MVP de este repositorio

El MVP (`/app`) implementa el núcleo de dominio en el navegador para validar la experiencia y las reglas:

| Concepto | Archivo del MVP |
|---|---|
| Agregado + máquina de estados | `app/src/domain/stateMachine.ts` |
| Reglas por pagador (DMN simplificado) + checklist | `app/src/domain/payers.ts` |
| Completitud del expediente / riesgo (Strategy) | `app/src/domain/scoring.ts` |
| Adaptadores por pagador (Adapter + Factory) simulados | `app/src/domain/payerAdapters.ts` |
| Valor esperado de apelación (Experto) | `app/src/domain/appeals.ts` |
| Modelo de valor (simulador) | `app/src/domain/value.ts` |
| Vistas BPMN | `app/src/pages/Process.tsx` (bpmn-js) |
