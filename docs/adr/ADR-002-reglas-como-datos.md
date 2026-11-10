# ADR-002 · Reglas de pagador como datos (DMN versionado), no como código

- **Estado:** Propuesto · **Fecha:** 2026-11-10

## Contexto
Las reglas de PA cambian con frecuencia (Prepagada amplió requisitos desde 2024) y hoy viven en la memoria de coordinadores con 34 % de rotación.

## Decisión
Tabla de decisión DMN `pagador × plan × CUPS → requiere PA, evidencia, SLA, canal`, versionada, editable por el líder PA con aprobación (*four-eyes*) y con pruebas automáticas de regresión sobre casos históricos.

## Consecuencias
✅ Cambiar una regla no requiere despliegue; conocimiento institucional, no personal.
⚠️ Requiere un dueño funcional de reglas (rol nuevo: *analista de políticas de pagadores*).
