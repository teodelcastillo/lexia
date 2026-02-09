/**
 * Redirect from old AI assistant route to new Lexia module
 */
import { redirect } from 'next/navigation'

export default function AsistenteIAPage() {
  redirect('/lexia')
}
