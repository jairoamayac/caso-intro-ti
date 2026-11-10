// Datos sintéticos (ningún dato real de pacientes).
import type { Patient } from './types';

export const PHYSICIANS = [
  'Dra. Laura Méndez · Ortopedia',
  'Dr. Andrés Rivas · Gastroenterología',
  'Dra. Camila Ortiz · Cardiología',
  'Dr. Felipe Guzmán · Oftalmología',
  'Dra. Natalia Rojas · Neumología',
  'Dr. Julián Castro · Medicina general',
];

const ALL = ['nota_consulta', 'diagnostico', 'imagen_previa', 'tratamiento_conservador', 'laboratorios', 'escala_funcional', 'historia_previa', 'concepto_especialista'] as const;

const mk = (id: string, name: string, doc: string, payerId: string, plan: string, age: number, missing: string[]): Patient => ({
  id,
  name,
  documentId: doc,
  payerId,
  plan,
  age,
  available: ALL.filter((c) => !missing.includes(c)) as Patient['available'],
});

export const PATIENTS: Patient[] = [
  mk('p1', 'María Fernanda López', 'CC 52.431.877', 'pre-horizonte', 'Plan Oro', 46, ['tratamiento_conservador']),
  mk('p2', 'Jorge Enrique Salas', 'CC 79.120.554', 'eps-andina', 'Contributivo', 58, []),
  mk('p3', 'Luz Marina Cárdenas', 'CC 41.775.902', 'sis-norte', 'Subsidiado', 67, ['escala_funcional']),
  mk('p4', 'Santiago Herrera', 'CC 1.020.774.310', 'pre-cumbre', 'Plan Platino', 34, []),
  mk('p5', 'Ana Sofía Beltrán', 'CC 1.032.455.981', 'eps-cordillera', 'Contributivo', 29, ['imagen_previa', 'laboratorios']),
  mk('p6', 'Carlos Arturo Peña', 'CC 19.442.180', 'pre-aurora', 'Plan Clásico', 71, ['historia_previa']),
  mk('p7', 'Diana Patricia Mora', 'CC 39.661.027', 'eps-altiplano', 'Contributivo', 52, []),
  mk('p8', 'Ricardo Vélez', 'CC 80.244.913', 'eps-meridiano', 'Contributivo', 63, ['concepto_especialista']),
  mk('p9', 'Valentina Ríos', 'CC 1.015.338.472', 'pre-faro', 'Plan Joven', 25, []),
  mk('p10', 'Hernando Quintero', 'CC 17.903.665', 'sis-sur', 'Subsidiado', 74, ['laboratorios']),
  mk('p11', 'Paola Andrea Gil', 'CC 53.128.440', 'eps-sabana', 'Contributivo', 41, []),
  mk('p12', 'Tomás Aguirre', 'CC 1.001.229.873', 'particular', 'Pago directo', 38, []),
];

export const patientById = (id: string) => PATIENTS.find((p) => p.id === id)!;
