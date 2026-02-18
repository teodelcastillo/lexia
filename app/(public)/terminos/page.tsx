/**
 * Términos de Servicio - Página pública
 *
 * Define las condiciones de uso de la aplicación Lexia.
 */
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Términos de Servicio',
  description: 'Términos y condiciones de uso de Lexia. Lea las condiciones que rigen el uso de la plataforma.',
}

export default function TerminosPage() {
  return (
    <article className="container max-w-3xl px-4 py-12 md:py-16">
      <div className="space-y-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Términos de Servicio
          </h1>
          <p className="mt-2 text-muted-foreground">
            Última actualización: {new Date().toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">1. Aceptación de los términos</h2>
          <p className="text-muted-foreground leading-relaxed">
            Al acceder o utilizar Lexia (&quot;la aplicación&quot;, &quot;el servicio&quot;), usted acepta estar sujeto a estos Términos de Servicio. Si no está de acuerdo con alguna parte de estos términos, no debe utilizar el servicio.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">2. Descripción del servicio</h2>
          <p className="text-muted-foreground leading-relaxed">
            Lexia es una plataforma de gestión legal diseñada para estudios jurídicos, abogados y sus clientes. Ofrece herramientas para la administración de casos, clientes, documentos, tareas, vencimientos, calendario y asistencia con inteligencia artificial. El servicio incluye un portal de clientes para que estos consulten el estado de sus asuntos.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">3. Uso aceptable</h2>
          <p className="text-muted-foreground leading-relaxed">
            Usted se compromete a utilizar Lexia únicamente para fines legítimos y de conformidad con la ley. Queda prohibido:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Utilizar el servicio para actividades ilegales o que violen normas éticas profesionales.</li>
            <li>Compartir credenciales de acceso o permitir que terceros no autorizados utilicen su cuenta.</li>
            <li>Intentar acceder a datos, sistemas o cuentas de otros usuarios sin autorización.</li>
            <li>Introducir malware, realizar ataques o explotar vulnerabilidades del sistema.</li>
            <li>Utilizar el servicio de forma que degrade su rendimiento o afecte a otros usuarios.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">4. Cuentas y roles</h2>
          <p className="text-muted-foreground leading-relaxed">
            El servicio distingue entre usuarios internos (administradores, abogados, asistentes) y usuarios externos (clientes). Cada rol tiene permisos y accesos diferenciados. Es responsabilidad del administrador de la organización gestionar correctamente los usuarios y sus permisos. Usted es responsable de mantener la confidencialidad de sus credenciales.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">5. Contenido y responsabilidad</h2>
          <p className="text-muted-foreground leading-relaxed">
            Usted es responsable del contenido que ingresa en la aplicación (casos, documentos, comunicaciones). Lexia actúa como plataforma de almacenamiento y procesamiento; no asume responsabilidad por el contenido legal o la calidad de los servicios profesionales que usted preste a sus clientes. Debe cumplir con las obligaciones de secreto profesional y normativa aplicable a la abogacía.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">6. Herramientas de inteligencia artificial</h2>
          <p className="text-muted-foreground leading-relaxed">
            Lexia puede incluir funcionalidades asistidas por IA (por ejemplo, redacción, análisis, procesamiento de documentos). Los resultados generados por IA son orientativos y no constituyen asesoramiento legal. El profesional es responsable de revisar, validar y adaptar cualquier contenido antes de utilizarlo en su práctica.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">7. Disponibilidad y modificaciones</h2>
          <p className="text-muted-foreground leading-relaxed">
            Nos esforzamos por mantener el servicio disponible, pero no garantizamos disponibilidad ininterrumpida. Podemos realizar mantenimientos, actualizaciones o cambios en las funcionalidades. Le notificaremos sobre cambios significativos cuando sea posible.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">8. Propiedad intelectual</h2>
          <p className="text-muted-foreground leading-relaxed">
            Lexia y sus elementos (interfaz, código, marcas) son propiedad de sus titulares. Usted conserva la propiedad del contenido que sube. Al utilizar el servicio, nos otorga una licencia limitada para almacenar, procesar y mostrar su contenido con el fin de prestar el servicio.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">9. Limitación de responsabilidad</h2>
          <p className="text-muted-foreground leading-relaxed">
            En la medida permitida por la ley, Lexia no será responsable por daños indirectos, incidentales, especiales o consecuentes derivados del uso o la imposibilidad de uso del servicio. La responsabilidad total se limita al monto pagado por el servicio en el período en que ocurrió el hecho, cuando aplique.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">10. Terminación</h2>
          <p className="text-muted-foreground leading-relaxed">
            Podemos suspender o dar por terminado el acceso al servicio en caso de incumplimiento de estos términos o por razones operativas. Usted puede cerrar su cuenta en cualquier momento. Al terminar, conservaremos los datos según lo establecido en la Política de Privacidad y las obligaciones legales aplicables.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">11. Modificaciones</h2>
          <p className="text-muted-foreground leading-relaxed">
            Nos reservamos el derecho de modificar estos Términos de Servicio. Los cambios entrarán en vigor al publicarse en la aplicación. El uso continuado del servicio después de los cambios constituye la aceptación de los nuevos términos. Le recomendamos revisar esta página periódicamente.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">12. Ley aplicable y jurisdicción</h2>
          <p className="text-muted-foreground leading-relaxed">
            Estos términos se rigen por las leyes de la República Argentina. Cualquier controversia será sometida a los tribunales competentes del país, salvo disposición legal en contrario.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">13. Contacto</h2>
          <p className="text-muted-foreground leading-relaxed">
            Para consultas sobre estos Términos de Servicio, contacte al administrador de su organización o al responsable del servicio Lexia.
          </p>
        </section>

        <div className="pt-8 border-t border-border">
          <Link
            href="/auth/login"
            className="text-primary hover:underline font-medium"
          >
            ← Volver al inicio de sesión
          </Link>
        </div>
      </div>
    </article>
  )
}
