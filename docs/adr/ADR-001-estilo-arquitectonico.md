# ADR-001 · Monolito modular + workflow BPMN + hub de integración separado

- **Estado:** Propuesto · **Fecha:** 2026-11-10

## Contexto
~2.400 solicitudes/mes (≈110/día), equipo de TI reducido, 14 pagadores con canales muy heterogéneos y poco fiables (portales caídos, cambios sin aviso). Prioridades: seguridad, modificabilidad por pagador, trazabilidad.

## Decisión
1. **Núcleo PA como monolito modular hexagonal** (un despliegue, transacciones locales).
2. **Motor BPMN/DMN** (Camunda 8 o Temporal) para orquestar la saga, los timers SLA y las tareas humanas.
3. **Hub de integración con pagadores como servicio independiente**, con bulkhead y circuit breaker por pagador.
4. Comunicación asíncrona por **bus de eventos + Outbox**.

## Alternativas descartadas
- **Microservicios por subdominio:** sobrecosto operativo injustificado para el volumen (skill: "Cuándo NO usar microservicios").
- **Solo RPA sobre el proceso actual:** automatiza el desperdicio (seguiría pidiéndose documentación después de radicar).
- **Producto comercial cerrado de PA (mercado EE. UU.):** no soporta pagadores colombianos ni WhatsApp/portales locales.

## Consecuencias
✅ Simple de operar; los fallos de pagadores quedan aislados; el proceso es visible en BPMN.
⚠️ Dependencia del motor de workflow; disciplina para mantener límites entre módulos.
