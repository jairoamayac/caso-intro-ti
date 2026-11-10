# Niágara Autoriza — Rediseño de la autorización previa

Propuesta de rediseño del proceso de autorización de servicios médicos de la Organización de Salud *"Niágara en bicicleta"* (caso ficticio) con automatización e IA.

## Resumen ejecutivo

- **Problema:** la autorización previa es manual (14 pagadores, 10 sin integración, Excel compartido). Cuesta **2,6 h por caso** (benchmark 0,8–1,2), tarda **4,2 días**, el **68 %** de los casos persigue documentos por teléfono y el **59 %** de las negaciones nunca se apela. Valor perdido o mal invertido: **≈ $5,7 M/año** y ~1.095 pacientes sin atención.
- **Causa raíz:** la calidad del expediente se revisa al final (inspección) en vez de construirse al inicio; las reglas de 14 pagadores viven en personas (34 % de rotación) y no en un sistema.
- **Propuesta:** expediente completo en el momento de la orden (IA sobre la HCE), radicación y seguimiento automáticos (API/RPA por pagador), personas solo en juicio clínico y excepciones, negaciones gestionadas como inventario con valor esperado.
- **Valor (escenario base):** **$2,85 M/año** (rango $1,73–3,48 M), −24 % del costo del equipo PA sin despidos, +662 pacientes atendidos/año, retorno ≈ 4,5× en 3 años.

## Índice

| Documento | Entregable del caso |
|---|---|
| [01-analisis-caso.md](01-analisis-caso.md) | 1. Objetivo del proceso · 2. Problema y análisis de causas · cuellos de botella y costos |
| [02-bpm.md](02-bpm.md) | 3. Proceso rediseñado (formato de rediseño, SIPOC, AS-IS/TO-BE, KPIs) · 4. Papel de la estandarización/automatización |
| [bpmn/as-is.bpmn](bpmn/as-is.bpmn) · [bpmn/to-be.bpmn](bpmn/to-be.bpmn) | Diagramas BPMN 2.0 editables |
| [03-pipelines.md](03-pipelines.md) | Pipelines de automatización (P1–P8) y CI/CD (P9) |
| [04-arquitectura.md](04-arquitectura.md) | Arquitectura técnica: C4 (contexto, contenedores, componentes, clases), estados, ER, secuencia, despliegue, patrones |
| [adr/](adr/) | Registros de decisiones de arquitectura |
| [05-valor-riesgos-consideraciones.md](05-valor-riesgos-consideraciones.md) | 5. Valor · 6. Riesgos · 7. Consideraciones · hoja de ruta |

## MVP

Prototipo funcional en [`../app`](../app) (React + TypeScript + Vite):

```bash
cd app && npm install && npm run dev
```

Los diagramas Mermaid se ven en GitHub, VS Code (extensión *Markdown Preview Mermaid*) u Obsidian.
