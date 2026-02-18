/**
 * Política de Privacidad - Página pública
 *
 * Describe cómo Lexia recopila, usa y protege la información de los usuarios.
 */
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Política de Privacidad',
  description: 'Política de privacidad de Lexia. Conozca cómo recopilamos, usamos y protegemos su información.',
}

export default function PrivacidadPage() {
  return (
    <article className="container max-w-3xl px-4 py-12 md:py-16">
      <div className="space-y-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Política de Privacidad
          </h1>
          <p className="mt-2 text-muted-foreground">
            Última actualización: {new Date().toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">1. Introducción</h2>
          <p className="text-muted-foreground leading-relaxed">
            Lexia (&quot;nosotros&quot;, &quot;nuestro&quot; o &quot;la aplicación&quot;) se compromete a proteger la privacidad de los usuarios. Esta Política de Privacidad describe qué información recopilamos, cómo la utilizamos y qué medidas tomamos para protegerla. Al utilizar Lexia, usted acepta las prácticas descritas en este documento.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">2. Información que recopilamos</h2>
          <p className="text-muted-foreground leading-relaxed">
            Recopilamos información que usted nos proporciona directamente y datos generados por el uso del servicio:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li><strong className="text-foreground">Datos de cuenta:</strong> nombre, correo electrónico, contraseña (encriptada) y rol en el sistema.</li>
            <li><strong className="text-foreground">Datos de clientes y casos:</strong> información de personas, empresas, documentos y expedientes que usted ingresa en la plataforma.</li>
            <li><strong className="text-foreground">Datos de uso:</strong> actividad en la aplicación, historial de sesiones y preferencias de configuración.</li>
            <li><strong className="text-foreground">Datos técnicos:</strong> dirección IP, tipo de navegador y dispositivo para fines de seguridad y soporte.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">3. Uso de la información</h2>
          <p className="text-muted-foreground leading-relaxed">
            Utilizamos la información recopilada para:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Proporcionar, mantener y mejorar el servicio Lexia.</li>
            <li>Autenticar usuarios y gestionar el acceso a la plataforma.</li>
            <li>Procesar y almacenar casos, documentos y comunicaciones relacionadas con su práctica legal.</li>
            <li>Enviar notificaciones relevantes (tareas, vencimientos, actualizaciones del sistema).</li>
            <li>Cumplir con obligaciones legales y responder a solicitudes de autoridades competentes.</li>
            <li>Detectar y prevenir fraudes, abusos o violaciones de seguridad.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">4. Base de datos y almacenamiento</h2>
          <p className="text-muted-foreground leading-relaxed">
            Los datos se almacenan en infraestructura segura (Supabase) con cifrado en tránsito y en reposo. Los archivos subidos se gestionan mediante políticas de almacenamiento que respetan el principio de mínimo acceso necesario.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">5. Compartir información</h2>
          <p className="text-muted-foreground leading-relaxed">
            No vendemos ni alquilamos su información personal. Podemos compartir datos únicamente en los siguientes casos:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Con proveedores de servicios que nos ayudan a operar la plataforma (hosting, autenticación, análisis), bajo acuerdos de confidencialidad.</li>
            <li>Cuando sea requerido por ley o por orden judicial.</li>
            <li>Para proteger los derechos, la seguridad o la propiedad de Lexia, sus usuarios o terceros.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">6. Sus derechos</h2>
          <p className="text-muted-foreground leading-relaxed">
            Según la normativa aplicable (incluyendo la Ley de Protección de Datos Personales de Argentina), usted puede solicitar acceso, rectificación, supresión o portabilidad de sus datos personales. Para ejercer estos derechos, contacte al administrador de su organización o al responsable del tratamiento indicado en los Términos de Servicio.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">7. Retención de datos</h2>
          <p className="text-muted-foreground leading-relaxed">
            Conservamos la información mientras su cuenta esté activa o según lo requiera la ley. Los datos de casos y documentos pueden retenerse por períodos más largos para cumplir con obligaciones legales y profesionales del ejercicio de la abogacía.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">8. Seguridad</h2>
          <p className="text-muted-foreground leading-relaxed">
            Implementamos medidas técnicas y organizativas para proteger sus datos contra acceso no autorizado, alteración, divulgación o destrucción. Esto incluye cifrado, controles de acceso basados en roles y monitoreo de seguridad.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">9. Cambios a esta política</h2>
          <p className="text-muted-foreground leading-relaxed">
            Podemos actualizar esta Política de Privacidad ocasionalmente. Le notificaremos sobre cambios significativos mediante un aviso en la aplicación o por correo electrónico. Le recomendamos revisar esta página periódicamente.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">10. Contacto</h2>
          <p className="text-muted-foreground leading-relaxed">
            Para consultas sobre esta Política de Privacidad o el tratamiento de sus datos personales, contacte al administrador de su estudio jurídico o al responsable del servicio Lexia.
          </p>
        </section>

        <div className="pt-8 border-t border-border">
          <Link
            href="/"
            className="text-primary hover:underline font-medium"
          >
            ← Volver al inicio
          </Link>
        </div>
      </div>
    </article>
  )
}
