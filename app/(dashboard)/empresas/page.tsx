/**
 * /empresas -> redirect to /companias (single list page lives there).
 * Kept so deep links to /empresas (used by some parts of the code) work.
 */
import { redirect } from 'next/navigation'

export default function EmpresasIndexPage() {
  redirect('/companias')
}
