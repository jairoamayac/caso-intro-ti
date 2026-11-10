# ADR-004 · RPA como puente temporal hacia APIs (Strangler Fig)

- **Estado:** Propuesto · **Fecha:** 2026-11-10

## Contexto
10 de 14 pagadores no tienen integración. Esperar a que publiquen APIs no es viable.

## Decisión
Bots RPA (Template Method `PortalBot`) detrás del mismo `PayerAdapter`. Cuando un pagador publique API, se reemplaza el adaptador sin tocar el núcleo. En paralelo, negociar APIs/ventanilla digital con los pagadores de mayor volumen.

## Consecuencias
✅ Valor inmediato. ⚠️ Bots frágiles ante cambios de portal → pruebas de contrato diarias, alertas y circuit breaker.
