# Niágara · Autorización de servicios médicos

Aplicación web en **HTML + JavaScript** que corre completa en el navegador, sin servidor propio. Se integra con la **API de Google Drive** para guardar la carpeta de historia clínica de cada paciente.

## Ventanas

| # | Ventana | Qué hace |
|---|---|---|
| 1 | **Registro** | Registra la solicitud: nombre e ID del paciente, EPS, tratamiento, requerimientos, ID y nombre del médico, fecha de la cita y si es prioritario. Crea la carpeta del paciente (nombrada por su ID) y envía la solicitud a la cola de coordinadores. |
| 2 | **Carga de archivos** | Verifica que exista la carpeta del ID del paciente. Pide ID y nombre del profesional y la sección, y guarda los archivos en la historia clínica. Muestra los mensajes de los coordinadores que pidieron archivos. |
| 3 | **Dashboard de coordinadores** | **General:** totales de solicitudes, aprobadas, rechazadas, en proceso y en apelación. **Cola:** los prioritarios aparecen primero; al tomar una solicitud queda en proceso. **En proceso:** datos del paciente, archivos y chequeo de requerimientos, botón *Solicitar archivo* (mensaje a la sección) y respuesta de la aseguradora. **Resultados:** hojas de aprobadas, revisión de rechazadas (fecha, razón y plazo para la carta), apelaciones y rechazos. |
| 4 | **Archivos** | Carpetas por ID de paciente con sus documentos y solicitudes. |

### Flujo de estados

```
Registro → Cola → En proceso ─┬─ Aprobada → Hoja de aprobadas (notifica a paciente y coordinador general)
                              └─ Rechazada → Revisión de rechazadas (fecha, razón, plazo; notifica al paciente)
                                     ├─ Llega la carta → Apelaciones ─┬─ Aprobada → Hoja de aprobadas
                                     │                                 └─ Rechazada → Rechazos ("Apelación rechazada")
                                     └─ Vence el plazo → Rechazos ("Descartada (sin apelación)")
```

Las notificaciones quedan registradas en el dashboard general. Si hay correo, se envían con un enlace `mailto:`.

## Cómo usarla

**Modo local:** abra `index.html` con doble clic. Los datos quedan en ese navegador (localStorage e IndexedDB).

**Modo Google Drive:** carpetas y archivos en Drive, con los datos compartidos entre equipos y usuarios.

1. En [Google Cloud Console](https://console.cloud.google.com/), cree un proyecto y habilite **Google Drive API**.
2. En la *pantalla de consentimiento OAuth*, agregue su correo como usuario de prueba.
3. En *Credenciales*, cree un **ID de cliente OAuth → Aplicación web** y agregue `http://localhost:8080` en *Orígenes de JavaScript autorizados*.
4. Sirva la carpeta (Google no permite iniciar sesión desde `file://`):
   ```bash
   python3 -m http.server 8080
   ```
5. Abra http://localhost:8080 → **Configuración**, pegue el Client ID (o póngalo en `js/config.js`), elija *Google Drive* y pulse **Conectar**.

La app usa el permiso `drive.file`: solo ve lo que ella misma crea. Todo queda en la carpeta **"Niágara - Historias clínicas"**, con una subcarpeta por paciente (`ID - Nombre`) y el archivo de estado `solicitudes.json`.

## Datos de prueba

En **Configuración → Crear datos de prueba**, la app crea 9 pacientes con su carpeta por ID, documentos PDF cargados por las secciones y solicitudes en todos los estados del flujo (nuevas, prioritarias, en proceso con un archivo faltante y un mensaje, aprobada, en revisión de rechazo, en apelación y los dos tipos de rechazo). Si está conectada a Google Drive, lo crea todo en Drive.

## Archivos

```
index.html      estructura y navegación
css/styles.css  estilos
js/config.js    Client ID de Google (opcional)
js/demo.js      generador de datos de prueba
js/store.js     almacenamiento: local o Google Drive API v3
js/app.js       lógica de las 4 ventanas
```

## Limitaciones

- Si dos coordinadores guardan casi al mismo tiempo en Drive, gana el último que guarda. Antes de tomar una solicitud se recarga el estado para que dos personas no tomen la misma.
- No hay inicio de sesión por rol: cualquier persona con el enlace ve todas las ventanas.
