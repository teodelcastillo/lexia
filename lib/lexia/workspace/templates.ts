/**
 * Initial Tiptap/ProseMirror templates for workspace documents.
 *
 * Each template is a plain ProseMirror JSON tree. We use headings and
 * paragraphs that lead the lawyer through the structure, with explicit
 * `[...]` placeholders meant to be selected and filled in with ⌘K.
 *
 * Keeping these as JSON (not markdown/HTML) means they load directly into
 * Tiptap without a parsing step.
 */

import type { TiptapDoc, WorkspaceDocumentType } from './types'

type Node = {
  type: string
  attrs?: Record<string, unknown>
  content?: Node[]
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
  text?: string
}

function heading(level: 1 | 2 | 3, text: string): Node {
  return {
    type: 'heading',
    attrs: { level },
    content: [{ type: 'text', text }],
  }
}

function p(text: string): Node {
  return text
    ? { type: 'paragraph', content: [{ type: 'text', text }] }
    : { type: 'paragraph' }
}

function pBold(prefix: string, rest: string): Node {
  return {
    type: 'paragraph',
    content: [
      { type: 'text', marks: [{ type: 'bold' }], text: prefix },
      { type: 'text', text: rest },
    ],
  }
}

/** Inline placeholder rendered in muted color via the `placeholderInline` mark. */
function placeholder(text: string): Node {
  return {
    type: 'paragraph',
    content: [
      {
        type: 'text',
        marks: [{ type: 'placeholderInline' }],
        text: `[${text}]`,
      },
    ],
  }
}

// -----------------------------------------------------------------------------
// Demanda
// -----------------------------------------------------------------------------

const demandaTemplate: TiptapDoc = {
  type: 'doc',
  content: [
    heading(1, 'Demanda'),
    pBold('Señor/a Juez/a: ', ''),
    p(''),

    heading(2, 'I. Objeto'),
    placeholder(
      'Describí brevemente la pretensión principal. Ej: "Vengo a iniciar demanda ordinaria por daños y perjuicios contra …"'
    ),
    p(''),

    heading(2, 'II. Personería / Legitimación'),
    placeholder('Datos del actor, representación invocada y documentación acreditante.'),
    p(''),

    heading(2, 'III. Hechos'),
    placeholder(
      'Relato cronológico de los hechos, numerado. Usá ⌘K sobre esta línea para redactar con IA a partir de los documentos del caso.'
    ),
    p(''),

    heading(2, 'IV. Derecho'),
    placeholder(
      'Fundamento normativo. Cita de artículos del CCyCN, CPCC, leyes especiales aplicables.'
    ),
    p(''),

    heading(2, 'V. Prueba'),
    placeholder(
      'Documental, informativa, pericial, testimonial, confesional. Detallá cada tipo.'
    ),
    p(''),

    heading(2, 'VI. Petitorio'),
    placeholder(
      'Lo que se pide concretamente al tribunal: se haga lugar a la demanda, con costas, etc.'
    ),
    p(''),

    p('Proveer de conformidad,'),
    p('SERÁ JUSTICIA.'),
  ],
}

// -----------------------------------------------------------------------------
// Contestación
// -----------------------------------------------------------------------------

const contestacionTemplate: TiptapDoc = {
  type: 'doc',
  content: [
    heading(1, 'Contestación de demanda'),
    pBold('Señor/a Juez/a: ', ''),
    p(''),

    heading(2, 'I. Objeto'),
    placeholder(
      'Vengo en tiempo y forma legal a contestar la demanda instaurada por … en los presentes autos.'
    ),
    p(''),

    heading(2, 'II. Personería'),
    placeholder('Datos del demandado, representación y acreditación.'),
    p(''),

    heading(2, 'III. Negativa general y específica'),
    placeholder(
      'Niego todos y cada uno de los hechos expuestos por la parte actora, salvo aquellos que expresamente reconozco. En particular: niego …'
    ),
    p(''),

    heading(2, 'IV. Hechos'),
    placeholder(
      'Versión de los hechos de mi parte. Usá ⌘K sobre esta línea para redactar con IA a partir de la demanda y los documentos del caso.'
    ),
    p(''),

    heading(2, 'V. Defensas de fondo'),
    placeholder(
      'Argumentos sustanciales por los cuales la demanda debe rechazarse (prescripción, falta de legitimación, pago, compensación, culpa de la víctima, etc.).'
    ),
    p(''),

    heading(2, 'VI. Excepciones'),
    placeholder(
      'Excepciones previas o dilatorias (incompetencia, defecto legal, litispendencia, etc.). Si no corresponde, indicalo.'
    ),
    p(''),

    heading(2, 'VII. Derecho'),
    placeholder('Normativa aplicable y jurisprudencia.'),
    p(''),

    heading(2, 'VIII. Prueba'),
    placeholder(
      'Documental, informativa, pericial, testimonial, confesional que ofrece la demandada.'
    ),
    p(''),

    heading(2, 'IX. Petitorio'),
    placeholder(
      'Se rechace la demanda en todas sus partes, con costas a la actora.'
    ),
    p(''),

    p('Proveer de conformidad,'),
    p('SERÁ JUSTICIA.'),
  ],
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export function getInitialDocument(type: WorkspaceDocumentType): TiptapDoc {
  switch (type) {
    case 'demanda':
      return demandaTemplate
    case 'contestacion':
      return contestacionTemplate
    default: {
      const never: never = type
      throw new Error(`Unknown workspace document type: ${never as string}`)
    }
  }
}

export function defaultTitleFor(
  type: WorkspaceDocumentType,
  caseNumber?: string | null
): string {
  const base =
    type === 'demanda' ? 'Demanda' : type === 'contestacion' ? 'Contestación de demanda' : 'Documento'
  return caseNumber ? `${base} — ${caseNumber}` : base
}
