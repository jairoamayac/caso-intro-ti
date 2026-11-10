# ADR-003 · IA con evidencia citada y humano en el ciclo

- **Estado:** Propuesto · **Fecha:** 2026-11-10

## Contexto
La IA puede eliminar el mayor cuello de botella (documentación), pero un error clínico o una alucinación en una apelación tiene costo legal y para el paciente.

## Decisión
- La IA **propone**, el humano **dispone**: ninguna decisión de necesidad médica ni apelación sale sin firma humana.
- Toda salida de IA debe **citar la fuente** en la HCE; sin cita = no se acepta.
- Proveedor de LLM en endpoints privados, sin retención ni entrenamiento con datos de Niágara.
- Umbral de confianza: < 0,9 → tarea humana.

## Consecuencias
✅ Seguridad clínica y legal, auditabilidad. ⚠️ El ahorro máximo se limita por la revisión humana (aceptado).
