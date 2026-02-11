# LEXIA - Manual de Usuario

**Version:** 1.0.0
**Dirigido a:** Administradores, Lideres de Caso, Abogados Ejecutivos y Clientes
**Ultima actualizacion:** Febrero 2026

---

## Tabla de Contenidos

1. [Introduccion](#1-introduccion)
2. [Primeros Pasos](#2-primeros-pasos)
3. [El Dashboard Principal](#3-el-dashboard-principal)
4. [Gestion de Casos](#4-gestion-de-casos)
5. [Gestion de Personas y Empresas](#5-gestion-de-personas-y-empresas)
6. [Gestion de Documentos](#6-gestion-de-documentos)
7. [Tareas](#7-tareas)
8. [Vencimientos y Audiencias](#8-vencimientos-y-audiencias)
9. [Calendario](#9-calendario)
10. [Notas](#10-notas)
11. [Lexia - Asistente Legal de IA](#11-lexia-asistente-legal-de-ia)
12. [Notificaciones](#12-notificaciones)
13. [Portal de Clientes](#13-portal-de-clientes)
14. [Panel de Administracion](#14-panel-de-administracion)
15. [Perfil y Configuracion](#15-perfil-y-configuracion)
16. [Preguntas Frecuentes](#16-preguntas-frecuentes)

---

## 1. Introduccion

### 1.1 Que es Lexia?

Lexia es una plataforma integral de gestion para estudios juridicos que centraliza la administracion de casos, clientes, documentos, tareas y vencimientos en un solo lugar. Incluye un asistente de inteligencia artificial especializado en derecho argentino que ayuda con la redaccion de escritos, calculo de plazos y consultas procesales.

### 1.2 Para quien es Lexia?

Lexia esta disenada para dos tipos de usuarios:

**Equipo Interno del Estudio:**
- **Administradores Generales**: Gestionan todo el sistema, usuarios, y tienen visibilidad completa.
- **Lideres de Caso**: Dirigen casos especificos, asignan tareas al equipo, y supervisan el progreso.
- **Abogados Ejecutivos**: Trabajan en los casos asignados, completan tareas, y suben documentos.

**Clientes Externos:**
- Acceden a un **Portal de Clientes** simplificado para ver el estado de sus casos y documentos relevantes.

### 1.3 Requisitos del Sistema

- Navegador web moderno (Chrome, Firefox, Safari, Edge) actualizado.
- Conexion a internet estable.
- No se requiere instalacion de software adicional.

---

## 2. Primeros Pasos

### 2.1 Acceder a Lexia

**Equipo Interno:**
1. Abra su navegador y acceda a la URL proporcionada por su administrador.
2. Haga clic en "Iniciar Sesion".
3. Ingrese su correo electronico y contrasena.
4. Sera redirigido automaticamente al Dashboard.

**Clientes:**
1. Acceda a la URL del portal de clientes proporcionada por el estudio.
2. Ingrese las credenciales que le fueron asignadas.
3. Sera redirigido al Portal de Clientes.

### 2.2 Navegacion General

La interfaz de Lexia tiene tres areas principales:

1. **Barra Lateral (Sidebar):** Menu de navegacion principal ubicado a la izquierda. Contiene accesos directos a todos los modulos: Dashboard, Casos, Clientes, Personas, Empresas, Documentos, Tareas, Vencimientos, Calendario, Notas, Lexia IA, y herramientas adicionales.

2. **Header Superior:** Muestra su nombre, rol, y contiene:
   - Buscador global.
   - Campana de notificaciones con indicador de no leidas.
   - Menu de usuario (perfil, configuracion, cerrar sesion).
   - Selector de tema (claro/oscuro).

3. **Area de Contenido:** La zona central donde se muestra el contenido de cada seccion.

### 2.3 Tema Visual

Lexia soporta modo claro y oscuro. Para cambiar:
1. Haga clic en el icono de sol/luna en el header.
2. Seleccione "Claro", "Oscuro", o "Sistema" (sigue la configuracion de su dispositivo).

---

## 3. El Dashboard Principal

### 3.1 Vista General

Al ingresar, vera un dashboard personalizado segun su rol:

**Dashboard del Administrador:**
- Total de casos activos, pendientes, y cerrados.
- Total de usuarios en el sistema.
- Actividad reciente de todo el estudio (quien hizo que y cuando).
- Tareas pendientes del equipo.
- Proximos vencimientos criticos.

**Dashboard del Lider de Caso:**
- Metricas de sus casos: activos, pendientes, en espera.
- Tareas pendientes de su equipo.
- Vencimientos proximos de sus casos.
- Actividad reciente en sus casos.
- Acceso rapido a Lexia IA.

**Dashboard del Abogado Ejecutivo:**
- Tareas asignadas personalmente.
- Proximos vencimientos.
- Casos en los que participa.
- Acceso rapido a Lexia IA.

### 3.2 Widgets del Dashboard

Cada widget se puede explorar haciendo clic en "Ver todo" para acceder a la vista completa del modulo correspondiente.

- **Estadisticas**: Tarjetas con numeros clave y tendencias.
- **Tareas Pendientes**: Lista de tareas con prioridad, fecha limite, y caso asociado.
- **Proximos Vencimientos**: Audiencias y plazos criticos ordenados por fecha.
- **Actividad Reciente**: Feed de acciones realizadas en el sistema.
- **Casos Recientes**: Ultimos casos creados o actualizados.

---

## 4. Gestion de Casos

### 4.1 Listado de Casos

Acceda a **Casos** desde la barra lateral. Vera una tabla con todos los casos a los que tiene acceso.

**Funcionalidades del listado:**
- **Buscar**: Busque por numero de caso, titulo, o nombre de cliente.
- **Filtrar**: Por estado (Activo, Pendiente, En Espera, Cerrado, Archivado), tipo de caso, y empresa asociada.
- **Ordenar**: Por fecha de creacion, titulo, estado, o numero de caso.
- **Paginacion**: Navegue entre paginas si hay muchos casos.

### 4.2 Crear un Caso Nuevo

> **Permisos requeridos:** Administrador General o Lider de Caso.

1. Haga clic en el boton **"Nuevo Caso"** en la esquina superior derecha.
2. Complete los campos obligatorios:
   - **Titulo del caso**: Nombre descriptivo.
   - **Numero de caso**: Identificador unico (ej: "2026-001").
   - **Tipo de caso**: Civil, Laboral, Familia, Penal, Comercial, etc.
   - **Empresa/Cliente**: Seleccione la empresa o cliente asociado.
3. Complete los campos opcionales segun necesidad:
   - Tribunal, juzgado, jurisdiccion.
   - Parte contraria, abogado contraparte.
   - Fecha de presentacion, valor estimado.
   - Descripcion detallada y notas.
4. Haga clic en **"Crear Caso"**.

### 4.3 Vista de Detalle del Caso

Al hacer clic en un caso, accede a su vista completa con las siguientes pestanas:

#### Pestana "General"
Muestra la informacion basica del caso: estado, tipo, tribunal, empresa, partes, y un resumen ejecutivo. Desde aqui puede:
- Cambiar el estado del caso.
- Editar datos del caso.
- Ver informacion de la empresa asociada.

#### Pestana "Timeline"
Linea cronologica visual de los eventos del caso, incluyendo:
- Fechas clave (apertura, audiencias, presentaciones).
- Cambios de estado.
- Acciones importantes.

#### Pestana "Documentos"
Todos los documentos vinculados al caso:
- Subir nuevos documentos.
- Vincular documentos de Google Drive.
- Filtrar por categoria (Contrato, Escrito Judicial, Evidencia, etc.).
- Marcar documentos como visibles para el cliente.

#### Pestana "Notas"
Notas del equipo sobre el caso:
- Crear nuevas notas.
- Anclar notas importantes (se muestran primero).
- Marcar notas como visibles para el cliente.

#### Pestana "Tareas"
Tareas asociadas al caso:
- Crear nuevas tareas.
- Asignar a miembros del equipo.
- Cambiar estado (Pendiente, En Progreso, En Revision, Completada).
- Establecer prioridad y fecha limite.

#### Pestana "Vencimientos"
Plazos y audiencias del caso:
- Crear nuevos vencimientos.
- Tipos: Audiencia, Presentacion, Reunion, Otro.
- Configurar recordatorios anticipados.
- Marcar como completados.

#### Pestana "Equipo"
Abogados asignados al caso:
- Ver miembros actuales con su rol (Lider, Miembro, Asistente).
- Agregar o remover miembros (solo Lideres y Admins).
- Ver fecha de asignacion.

#### Pestana "Actividad"
Registro historico de toda la actividad del caso:
- Quien hizo que y cuando.
- Tipo de accion (creacion, edicion, subida de documento, etc.).
- Filtrar por tipo de actividad.

### 4.4 Consultar a Lexia desde un Caso

Dentro de cualquier caso, puede hacer clic en el boton **"Consultar a Lexia"** para abrir el asistente de IA con el contexto completo del caso cargado. Lexia tendra acceso a los datos, documentos, notas y vencimientos del caso para dar respuestas mas especificas.

---

## 5. Gestion de Personas y Empresas

### 5.1 Personas

Acceda a **Personas** desde la barra lateral para ver todas las personas fisicas registradas en el sistema.

**Tipos de persona:**
- **Cliente**: Cliente del estudio.
- **Juez**: Juez del tribunal interviniente.
- **Abogado Contraparte**: Letrado de la parte contraria.
- **Fiscal**: Fiscal interviniente.
- **Testigo**: Testigo en la causa.
- **Perito**: Perito designado.
- **Otro**: Cualquier otra persona vinculada.

**Crear una persona:**
1. Haga clic en **"Nueva Persona"**.
2. Complete nombre, apellido, tipo de persona, email.
3. Opcionalmente: DNI, CUIT, telefono, direccion, empresa asociada, notas.
4. Haga clic en **"Crear"**.

**Vincular una persona a un caso:**
Dentro del detalle de un caso, en la seccion de participantes, puede agregar personas existentes con un rol procesal (parte contraria, juez, perito, etc.).

### 5.2 Clientes

La seccion **Clientes** es una vista especializada de personas con tipo "Cliente" que agrega:
- Vista de todos los casos del cliente.
- Documentos del cliente.
- Notas relacionadas.
- Informacion de contacto completa.

### 5.3 Empresas

Acceda a **Empresas** desde la barra lateral para gestionar personas juridicas.

**Crear una empresa:**
1. Haga clic en **"Nueva Empresa"**.
2. Complete: Razon social, CUIT, forma juridica, rubro.
3. Opcionalmente: Direccion, contacto, sitio web, notas.
4. Haga clic en **"Crear"**.

Las empresas se asocian a casos y a personas (empleados, representantes, directores).

---

## 6. Gestion de Documentos

### 6.1 Listado de Documentos

Acceda a **Documentos** desde la barra lateral. Dispone de tres vistas:

- **Vista de Tabla**: Listado clasico con columnas (nombre, caso, categoria, fecha, visibilidad).
- **Vista de Grilla**: Tarjetas visuales con previsualizacion del tipo de archivo.
- **Vista de Arbol**: Documentos agrupados por empresa y caso, en estructura jerarquica.

### 6.2 Subir un Documento

1. Haga clic en **"Subir Documento"**.
2. Seleccione un archivo desde su computadora o arrastre y suelte.
3. Complete:
   - **Caso asociado**: Seleccione el caso al que pertenece el documento.
   - **Nombre**: Se completa automaticamente con el nombre del archivo, puede editarlo.
   - **Categoria**: Contrato, Escrito Judicial, Correspondencia, Evidencia, Memo Interno, Documento del Cliente, u Otro.
   - **Visibilidad**: Interno (solo equipo) o Visible al Cliente (accesible desde el portal).
   - **Descripcion** (opcional): Notas sobre el documento.
4. Haga clic en **"Subir"**.

### 6.3 Vincular Documento de Google Drive

1. Haga clic en **"Vincular Documento"**.
2. Ingrese el **ID de Google Drive** del archivo.
3. Complete el caso asociado, nombre, categoria y visibilidad.
4. Haga clic en **"Vincular"**.

El documento quedara referenciado sin necesidad de subirlo, manteniendo el enlace a Google Drive.

### 6.4 Control de Visibilidad

Los documentos tienen dos niveles de visibilidad:
- **Interno**: Solo visible para el equipo del estudio.
- **Visible al Cliente**: Tambien accesible desde el Portal de Clientes.

Para cambiar la visibilidad, edite el documento y modifique el campo correspondiente.

---

## 7. Tareas

### 7.1 Listado de Tareas

Acceda a **Tareas** desde la barra lateral. Vera todas las tareas que le corresponden segun su rol.

**Filtrar tareas por:**
- Estado: Pendiente, En Progreso, En Revision, Completada, Cancelada.
- Prioridad: Urgente, Alta, Media, Baja.
- Caso asociado.
- Persona asignada (solo Admins y Lideres ven tareas de otros).

### 7.2 Crear una Tarea

1. Haga clic en **"Nueva Tarea"**.
2. Complete:
   - **Titulo**: Descripcion breve de la tarea.
   - **Caso**: Caso asociado.
   - **Asignar a**: Miembro del equipo responsable.
   - **Prioridad**: Urgente, Alta, Media, Baja.
   - **Fecha limite** (opcional).
   - **Horas estimadas** (opcional).
   - **Descripcion** (opcional): Instrucciones detalladas.
3. Haga clic en **"Crear Tarea"**.

### 7.3 Flujo de una Tarea

```
Pendiente --> En Progreso --> En Revision --> Completada
                                    |
                                    +--> Cancelada
```

1. **Pendiente**: Tarea creada, esperando que el asignado la tome.
2. **En Progreso**: El asignado esta trabajando en ella.
3. **En Revision**: Completada y esperando revision del lider.
4. **Completada**: Aprobada y finalizada.
5. **Cancelada**: Tarea anulada.

Para cambiar el estado, abra el detalle de la tarea y use los botones de accion.

### 7.4 Registrar Horas

En el detalle de cada tarea, puede registrar las horas reales trabajadas en el campo **"Horas reales"**. Esto permite comparar con las horas estimadas.

---

## 8. Vencimientos y Audiencias

### 8.1 Listado de Vencimientos

Acceda a **Vencimientos** desde la barra lateral. Vera todos los plazos proximos con indicadores visuales de urgencia:
- **Rojo**: Vencido o vence hoy.
- **Naranja**: Vence en los proximos 3 dias.
- **Amarillo**: Vence esta semana.
- **Verde**: Vence en mas de una semana.

### 8.2 Crear un Vencimiento

1. Haga clic en **"Nuevo Vencimiento"**.
2. Complete:
   - **Titulo**: Descripcion del vencimiento (ej: "Audiencia preliminar").
   - **Caso**: Caso asociado (obligatorio).
   - **Tipo**: Audiencia, Presentacion, Reunion, u Otro.
   - **Fecha de vencimiento**: Dia y hora.
   - **Asignar a**: Persona responsable.
   - **Recordatorios**: Dias antes del vencimiento para enviar recordatorio (ej: 7, 3, 1).
   - **Descripcion** (opcional).
3. Haga clic en **"Crear"**.

### 8.3 Completar un Vencimiento

Cuando un plazo se cumple:
1. Abra el vencimiento.
2. Haga clic en **"Marcar como Completado"**.
3. Se registrara automaticamente la fecha y el usuario que lo completo.

---

## 9. Calendario

Acceda a **Calendario** desde la barra lateral para ver una vista unificada de:
- Audiencias programadas.
- Vencimientos de plazos.
- Reuniones agendadas.
- Tareas con fecha limite.

El calendario permite navegar por mes y hacer clic en un evento para ver su detalle completo.

---

## 10. Notas

Acceda a **Notas** desde la barra lateral para ver y gestionar notas rapidas que no estan asociadas a un caso especifico, ademas de un listado general de notas del sistema.

---

## 11. Lexia - Asistente Legal de IA

### 11.1 Que es Lexia?

Lexia es un asistente de inteligencia artificial especializado en derecho argentino, integrado directamente en la plataforma. Utiliza modelos avanzados de lenguaje (GPT-4) para asistir a los abogados en su trabajo diario.

**Importante:** Lexia es un asistente, no un abogado. Todas las respuestas son orientativas y deben verificarse con la normativa vigente.

### 11.2 Como acceder

- **Desde la barra lateral**: Haga clic en "Lexia" para abrir el chat. Se abre una nueva conversacion automaticamente.
- **Desde un caso**: Haga clic en "Consultar a Lexia" para cargar el contexto del caso automaticamente.

### 11.2.1 Historial de conversaciones

Lexia guarda automaticamente todas sus conversaciones. En el panel lateral izquierdo vera:

- **Selector de caso**: Filtre el historial por un caso especifico (opcional).
- **Nueva conversacion**: Cree una conversacion nueva.
- **Lista de conversaciones**: Sus chats anteriores con fechas relativas (hoy, ayer, etc.).

Haga clic en cualquier conversacion para volver a ella y continuar desde donde la dejo.

### 11.3 Herramientas de Lexia

Lexia dispone de herramientas especializadas organizadas en cuatro categorias:

#### Redaccion
- **Redactar Documento**: Genera borradores de escritos judiciales, contratos, poderes y mas. Plantillas disponibles: Demanda, Contestacion, Apelacion, Contrato, Poder, Carta Documento, Escrito Judicial, Recurso, Ofrecimiento de Prueba.
- **Mejorar Texto**: Revisa y mejora la redaccion de un texto legal existente.

#### Investigacion
- **Resumir Documento**: Analiza y resume documentos legales extensos, identificando partes, obligaciones y plazos clave.
- **Investigar Tema**: Investiga sobre jurisprudencia y doctrina argentina sobre un tema especifico.

#### Procedimiento
- **Checklist Procesal**: Genera lista de pasos para un tipo de procedimiento. Tipos soportados: Civil Ordinario, Ejecutivo, Laboral, Divorcio, Alimentos, Sucesion, Penal, Amparo, Desalojo.
- **Calcular Plazos**: Calcula vencimientos en dias habiles segun ley procesal argentina. Plazos precargados: Apelacion (5 y 10 dias), Contestacion (15 dias), Ofrecimiento de prueba, Alegatos, Recurso extraordinario, y plazos personalizados.

#### Consulta
- **Consulta Legal**: Responde preguntas abiertas sobre procedimientos y normativa argentina.
- **Estrategia Legal**: Sugiere estrategias legales para un caso o situacion especifica.

### 11.4 Modo Contextual (desde un Caso)

Cuando accede a Lexia desde un caso especifico:
1. El asistente recibe automaticamente informacion del caso: titulo, numero, tipo, estado, descripcion.
2. Tiene acceso a los vencimientos proximos, tareas pendientes y notas recientes del caso.
3. Puede hacer preguntas como "Que plazos tengo proximos en este caso?" o "Redacta una contestacion para este caso".

### 11.5 Modo General

Sin contexto de caso:
1. Puede hacer consultas generales sobre derecho argentino.
2. Solicitar borradores de documentos proporcionando el contexto usted mismo.
3. Investigar temas legales.
4. Calcular plazos procesales.

### 11.6 Consejos de Uso

- Sea especifico en sus consultas: "Redacta una demanda de danos y perjuicios por accidente de transito en Cordoba" es mejor que "Escribe una demanda".
- Para calcular plazos, indique la jurisdiccion (Cordoba, Federal, Buenos Aires).
- Use el modo contextual cuando trabaje en un caso especifico para respuestas mas relevantes.
- Siempre verifique las citas legales y normativa mencionada por Lexia.

---

## 12. Notificaciones

### 12.1 Tipos de Notificaciones

Lexia le notifica automaticamente sobre eventos importantes:

**Notificaciones de Trabajo:**
- Tarea asignada a usted.
- Vencimiento proximo (con dias de anticipacion configurables).
- Vencimiento vencido.

**Notificaciones de Actividad:**
- Nuevo caso creado.
- Caso actualizado.
- Nuevo documento subido.
- Persona o empresa creada.

### 12.2 Ver Notificaciones

- **Campana en el header**: Muestra un indicador con el numero de notificaciones no leidas. Haga clic para ver las recientes en un popover.
- **Centro de Notificaciones**: Acceda a Notificaciones desde la barra lateral para ver el historial completo con filtros.

### 12.3 Marcar como Leidas

- Haga clic en una notificacion para marcarla como leida.
- Use "Marcar todas como leidas" para limpiar el indicador.

---

## 13. Portal de Clientes

### 13.1 Descripcion

El Portal de Clientes es una interfaz simplificada y segura disenada para que los clientes del estudio puedan consultar el estado de sus casos sin necesidad de contactar al estudio telefonicamente.

### 13.2 Acceso

1. El estudio le proporcionara una URL y credenciales.
2. Ingrese sus credenciales en la pagina de login del portal.

### 13.3 Dashboard del Cliente

Al ingresar vera:
- **Resumen de sus casos**: Estado actual de cada caso en lenguaje amigable ("En Curso", "En Tramite", "Finalizado").
- **Proximas fechas**: Audiencias y plazos importantes.
- **Documentos recientes**: Documentos que el estudio ha marcado como visibles para usted.
- **Actualizaciones**: Actividad reciente en sus casos.

### 13.4 Ver Detalle de un Caso

Haga clic en un caso para ver:
- Estado y descripcion.
- Equipo de abogados asignado.
- Proximas fechas importantes.
- Documentos disponibles para descarga.

### 13.5 Documentos

Acceda a **Documentos** para ver todos los documentos que el estudio ha compartido con usted. Puede:
- Ver el listado de documentos por caso.
- Descargar documentos disponibles.

### 13.6 Centro de Ayuda

Acceda a **Ayuda** para:
- Ver informacion de contacto del estudio.
- Consultar preguntas frecuentes.
- Encontrar instrucciones de uso del portal.

---

## 14. Panel de Administracion

> **Acceso exclusivo:** Solo para usuarios con rol Administrador General.

### 14.1 Gestion de Usuarios

Acceda a **Admin > Usuarios** para:

**Ver usuarios existentes:**
- Tabla con nombre, email, rol, estado (activo/inactivo), fecha de creacion.
- Filtrar por rol o estado.

**Crear un nuevo usuario:**
1. Haga clic en **"Nuevo Usuario"**.
2. Complete nombre, apellido, email, telefono.
3. Asigne un rol: Administrador General, Lider de Caso, Abogado Ejecutivo, o Cliente.
4. Para abogados: opcionalmente complete numero de matricula y titulo.
5. Haga clic en **"Crear Usuario"**.

**Editar un usuario:**
- Cambiar rol.
- Activar/desactivar cuenta.
- Actualizar datos personales.

### 14.2 Gestion de Perfiles de Clientes

Acceda a **Admin > Perfiles** para vincular personas fisicas (de tipo "cliente") con cuentas de usuario del portal. Esto permite que un cliente inicie sesion y vea sus casos.

### 14.3 Configuracion del Sistema

Acceda a **Configuracion** para gestionar parametros generales del sistema.

---

## 15. Perfil y Configuracion

### 15.1 Mi Perfil

Acceda a **Perfil** desde el menu de usuario en el header o desde la barra lateral.

Puede ver y editar:
- Nombre y apellido.
- Email.
- Telefono.
- Titulo profesional.
- Numero de matricula (si aplica).
- Foto de perfil.

### 15.2 Cerrar Sesion

Haga clic en su nombre en el header y seleccione **"Cerrar Sesion"**. Sera redirigido a la pagina de login.

---

## 16. Preguntas Frecuentes

### General

**P: Puedo acceder desde mi celular?**
R: Si. Lexia es una aplicacion web responsive que se adapta automaticamente a pantallas de celulares y tablets.

**P: Puedo usar Lexia sin conexion a internet?**
R: No. Lexia requiere conexion a internet para funcionar ya que todos los datos se almacenan en la nube de forma segura.

**P: Quien puede ver mis datos?**
R: El acceso a los datos esta controlado por permisos. Cada usuario solo ve la informacion que le corresponde segun su rol. Los clientes solo ven sus propios casos y documentos marcados como visibles.

### Casos

**P: Como cambio el estado de un caso?**
R: Abra el detalle del caso y use el selector de estado en la seccion General. Solo Administradores y Lideres del caso pueden cambiar el estado.

**P: Puedo archivar un caso?**
R: Si. Cambie el estado a "Archivado". El caso quedara accesible para referencia pero no aparecera en las vistas principales.

### Documentos

**P: Que formatos de archivo puedo subir?**
R: Puede subir cualquier tipo de archivo (PDF, Word, Excel, imagenes, etc.). No hay restriccion de formato.

**P: Los clientes pueden ver todos mis documentos?**
R: No. Solo los documentos que usted marque como "Visible al Cliente" apareceran en el Portal de Clientes. Por defecto, los documentos son internos.

### Lexia IA

**P: Puedo confiar en las respuestas de Lexia?**
R: Lexia es una herramienta de asistencia que proporciona informacion orientativa. Siempre debe verificar las respuestas con la normativa vigente y su criterio profesional. No reemplaza el juicio de un abogado.

**P: Lexia guarda mis conversaciones?**
R: Las conversaciones con Lexia se mantienen durante la sesion activa. Se registra el uso para fines de auditorias, pero el contenido de las conversaciones no se almacena permanentemente.

**P: Que tipos de documentos puede redactar Lexia?**
R: Demandas, contestaciones, apelaciones, contratos, poderes, cartas documento, escritos judiciales, recursos y ofrecimientos de prueba. Todos basados en la practica juridica argentina.

### Portal de Clientes

**P: Como obtengo acceso al portal?**
R: Su estudio juridico le proporcionara las credenciales de acceso. Si no las tiene, comuniquese con su abogado.

**P: Puedo enviar mensajes a mi abogado desde el portal?**
R: Actualmente el portal es de solo consulta. Para comunicarse con su abogado, use los canales de contacto habituales (telefono, email).

---

*Manual de Usuario Lexia - Version 1.0.0 - Febrero 2026*
