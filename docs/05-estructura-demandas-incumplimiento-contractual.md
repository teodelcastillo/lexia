# Estructura de Demandas - Incumplimiento Contractual

**Propósito:** Documento de referencia para la estructura de demandas del estudio. Sirve como base para personalizar plantillas, prompts y formularios en Lexia según el tipo de demanda y fuero.

**Tipo de demanda:** Incumplimiento contractual (locación)  
**Fuero:** Córdoba, Argentina  
**Última actualización:** Febrero 2026

---

## 1. Estructura General Replicable

La estructura que sigue es **replicable** a otras demandas. El contenido y el foco varían según el fuero y el tipo de incumplimiento (locación, compraventa, suministro, etc.).

```
I.   OBJETO
II.  HECHOS (con subsecciones numeradas)
III. [Variable según tipo]
IV.  RUBROS RECLAMADOS (daño emergente, lucro cesante)
V.   PRUEBA
VI.  RESERVA DEL CASO FEDERAL
VII. PETITORIO
```

---

## 2. Desglose por Sección

### I. OBJETO

- **Comparecencia formal:** Actor con datos completos, patrocinio letrado, domicilio constituido
- **Demandados:** Identificación de todos (principal + garantes solidarios si aplica)
- **Pretensiones:** Suma total, intereses, costas
- **Mediación:** Declaración de cumplimiento de instancia prejudicial obligatoria

**Campos sugeridos para formulario:**
- `actor` (party)
- `demandados` (party múltiple o lista: principal + garantes)
- `suma_reclamada` (text)
- `mediacion_cumplida` (boolean/text)

---

### II. HECHOS

Estructura en **subsecciones numeradas** (I, II, III, IV, V...). Cada subsección desarrolla un eje temático.

#### Para incumplimiento contractual (locación):

| Subsección | Contenido |
|------------|-----------|
| **I. Del inmueble y de la relación locativa** | Propietaria, inmueble, contratos sucesivos, adenda de prórroga, garantes, obligaciones de conservación y restitución |
| **II. Del estado de recepción y obligaciones** | Cláusulas contractuales (QUINTA, OCTAVA, VIGÉSIMA PRIMERA), obligaciones asumidas |
| **III. De la intimación a la restitución** | Vencimiento del plazo, carta documento, entrega de llaves (unilateral) |
| **IV. De la restitución y constatación** | Escritura notarial, descripción del deterioro, contraste con cláusulas, jurisprudencia |
| **V. De los trabajos de reparación** | Lista de trabajos realizados, costos documentados |

**Campos sugeridos para formulario:**
- `hechos_relacion_locativa` (textarea) — Inmueble, contratos, garantes
- `hechos_obligaciones_contrato` (textarea) — Cláusulas relevantes
- `hechos_intimacion` (textarea) — Carta documento, entrega de llaves
- `hechos_constatacion` (textarea) — Escritura notarial, estado del inmueble
- `hechos_trabajos_reparacion` (textarea) — Trabajos realizados

**Alternativa:** Un solo campo `hechos` con instrucciones de subsecciones en el prompt.

---

### III. RUBROS RECLAMADOS

#### VI.I. Daño emergente

- Lista detallada con comprobantes (facturas, presupuestos, recibos)
- Cada ítem: proveedor, número de comprobante, fecha, concepto, monto
- Suma total
- Intereses desde cada erogación

**Campos sugeridos:**
- `planilla_gastos` (textarea) — Lista estructurada o JSON
- `suma_dano_emergente` (text)
- `comprobantes_adjuntos` (text) — Referencia a documentos

#### VI.II. Lucro cesante

- Renta dejada de percibir
- Período (meses)
- Canon mensual de referencia
- Cálculo total

**Campos sugeridos:**
- `canon_mensual_referencia` (text)
- `meses_sin_renta` (text/number)
- `suma_lucro_cesante` (text)
- `fundamento_lucro_cesante` (textarea)

---

### IV. PRUEBA

- **Documental:** Lista numerada de documentos (contratos, escrituras, facturas, cartas documento, actas)
- **Informativa:** Oficios a proveedores para reconocimiento de comprobantes
- **Testimonial:** Lista de testigos con domicilio
- **Confesional:** Cita a demandados a absolver posiciones

**Campos sugeridos:**
- `prueba_documental` (textarea) — Lista de documentos
- `prueba_informativa` (textarea) — Lista de oficios
- `prueba_testimonial` (textarea) — Testigos
- `prueba_confesional` (boolean/text)

---

### V. RESERVA DEL CASO FEDERAL

Párrafo estándar para reserva de recurso extraordinario federal.

**Campo:** Puede ser fijo en la plantilla (no requiere formulario).

---

### VI. PETITORIO

Solicitudes numeradas al tribunal:
1. Tener por deducida demanda
2. Correr traslado
3. Tener por ofrecida la prueba
4. Condenar en las sumas reclamadas
5. Reserva del caso federal

**Campo:** Puede derivarse de las pretensiones o ser estándar en la plantilla.

---

## 3. Mapeo para Plantillas Lexia

Lexia usa plantillas de organización sobre el tipo `demanda` con **variantes** (`variant`) para distinguir subtipos. La columna `variant` en `lexia_document_templates` permite múltiples plantillas por `(organization_id, document_type)`.

### Variantes disponibles

| variant | Nombre |
|---------|--------|
| `''` (vacío) | Demanda (estándar) |
| `incumplimiento_locacion` | Incumplimiento - Locación |
| `incumplimiento_compraventa` | Incumplimiento - Compraventa |
| `incumplimiento_suministro` | Incumplimiento - Suministro |
| `incumplimiento_servicios` | Incumplimiento - Servicios |

### Estructura de plantilla (Opción B implementada)

1. **structure_schema** (formato completo con `FormFieldDefinition[]`):
```json
{
  "fields": [
    { "key": "actor", "label": "Actor", "type": "party", "partyPrefix": "actor", "partyLabel": "Actor" },
    { "key": "demandado", "label": "Demandado principal", "type": "party", "partyPrefix": "demandado", "partyLabel": "Demandado" },
    { "key": "garantes", "label": "Garantes (si aplica)", "type": "textarea", "required": false },
    { "key": "suma_reclamada", "label": "Suma total reclamada", "type": "text", "required": true },
    { "key": "hechos_relacion_locativa", "label": "I. Del inmueble y relación locativa", "type": "textarea", "required": true },
    { "key": "hechos_obligaciones", "label": "II. Obligaciones contractuales", "type": "textarea", "required": true },
    { "key": "hechos_intimacion", "label": "III. Intimación y entrega", "type": "textarea", "required": true },
    { "key": "hechos_constatacion", "label": "IV. Restitución y constatación", "type": "textarea", "required": true },
    { "key": "hechos_trabajos", "label": "V. Trabajos de reparación", "type": "textarea", "required": true },
    { "key": "dano_emergente_detalle", "label": "Daño emergente (detalle)", "type": "textarea", "required": true },
    { "key": "suma_dano_emergente", "label": "Suma daño emergente", "type": "text", "required": true },
    { "key": "lucro_cesante_detalle", "label": "Lucro cesante (detalle)", "type": "textarea", "required": false },
    { "key": "suma_lucro_cesante", "label": "Suma lucro cesante", "type": "text", "required": false },
    { "key": "prueba_documental", "label": "Prueba documental", "type": "textarea", "required": true },
    { "key": "prueba_testimonial", "label": "Prueba testimonial", "type": "textarea", "required": false }
  ]
}
```

2. **template_content** (con placeholders `{{actor}}`, `{{hechos_relacion_locativa}}`, etc.)

3. **system_prompt_fragment** (instrucciones específicas por variante):
```
DEMANDA DE INCUMPLIMIENTO CONTRACTUAL (LOCACIÓN) - ESTRUCTURA:
I. OBJETO (comparecencia, demandados, pretensiones, mediación).
II. HECHOS con subsecciones I a V: I) Inmueble y relación locativa; II) Obligaciones contractuales (cláusulas); III) Intimación y entrega de llaves; IV) Restitución y constatación notarial; V) Trabajos de reparación.
VI. RUBROS (daño emergente con comprobantes, lucro cesante).
VII. PRUEBA (documental, informativa, testimonial, confesional).
VIII. RESERVA FEDERAL. IX. PETITORIO.
Tono formal, técnico, fundamentado en cláusulas. Citar jurisprudencia cuando aplique (buena fe, fuerza obligatoria).
```

---

## 4. Variaciones por Tipo de Incumplimiento

| Tipo | Foco en HECHOS | Rubros típicos |
|------|----------------|----------------|
| **Locación** | Estado del inmueble, cláusulas de conservación/restitución, constatación notarial | Daño emergente (reparaciones), lucro cesante (renta) |
| **Compraventa** | Incumplimiento de entrega, vicios, garantías | Daño emergente, resolución, devolución |
| **Suministro** | Falta de entrega, calidad defectuosa | Daño emergente, lucro cesante |
| **Prestación de servicios** | Incumplimiento, mala ejecución | Daño emergente, indemnización |

La **estructura general** (OBJETO → HECHOS → RUBROS → PRUEBA → PETITORIO) se mantiene. Cambian las subsecciones de HECHOS y el detalle de los rubros.

---

## 5. Estilo de Redacción

- **Formal:** "Sr. Juez:", "ante V.S. respetuosamente comparece"
- **Técnico:** Citar cláusulas por número (QUINTA, OCTAVA)
- **Fundamentado:** Vincular hechos con obligaciones contractuales
- **Estructurado:** Subsecciones claras, numeración consistente
- **Prueba:** Cada afirmación debe ser demostrable con la prueba ofrecida

---

## 6. Checklist de Personalización

Para crear una plantilla de demanda en Lexia:

- [ ] Definir tipo de demanda (incumplimiento contractual, otro)
- [ ] Definir subsecciones de HECHOS según el caso
- [ ] Definir campos del formulario (structure_schema)
- [ ] Redactar template_content con placeholders
- [ ] Redactar system_prompt_fragment con instrucciones
- [ ] Probar con datos de un caso real
- [ ] Ajustar según feedback del equipo

---

## 7. Checklist para Crear Plantillas Nuevas

Pasos concretos para agregar o personalizar una plantilla en Lexia:

1. **Definir variante (o usar estándar)**  
   Elegir `variant`: `''` para plantilla estándar, o `incumplimiento_locacion`, `incumplimiento_compraventa`, etc. para variantes de incumplimiento.

2. **Definir subsecciones de HECHOS según el tipo**  
   Según la variante, ajustar las subsecciones (ver sección 4). Locación: I–V del documento de referencia. Compraventa, suministro, servicios: adaptar según la tabla de variaciones.

3. **Definir `structure_schema` (campos del formulario)**  
   Usar formato completo `{ fields: FormFieldDefinition[] }` con `key`, `label`, `type`, `required`. Para party: `partyPrefix`, `partyLabel`.

4. **Redactar `template_content` con placeholders**  
   Usar `{{key}}` para cada campo. Incluir estructura base (OBJETO, HECHOS, RUBROS, PRUEBA, PETITORIO).

5. **Redactar `system_prompt_fragment` con instrucciones**  
   Indicar estructura, subsecciones, tono y criterios de redacción. Incluir referencias a jurisprudencia cuando aplique.

6. **Crear plantilla en Lexia**  
   Ir a Plantillas → elegir tipo y variante → "Personalizar". Se crea la plantilla de organización a partir de la global.

7. **Probar con datos de un caso real**  
   Usar el Redactor con la plantilla seleccionada y datos reales para validar el borrador.

8. **Ajustar según feedback del equipo**  
   Editar instrucciones, contenido base o campos en el editor de plantillas.

---

*Documento de referencia interno. No sustituye la revisión profesional del escrito antes de su presentación.*
