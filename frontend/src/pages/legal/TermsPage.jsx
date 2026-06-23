import { Link } from 'react-router-dom';

const UPDATED = '18 de junio de 2026';

function Section({ title, children }) {
  return (
    <section className="mt-5">
      <h2 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      <div className="text-sm text-slate-700 space-y-2 mt-1 dark:text-slate-300">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link to="/" className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">&larr; Inicio</Link>
        <h1 className="text-2xl font-bold mt-2">Términos y Condiciones</h1>
        <p className="text-xs text-slate-500 mt-1 dark:text-slate-400">Última actualización: {UPDATED}</p>

        <p className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 mt-4 dark:bg-amber-900/20 dark:border-amber-900 dark:text-amber-300">
          Plantilla orientativa. Reemplazá los datos entre corchetes y revisala con un
          profesional legal antes de publicarla.
        </p>

        <Section title="1. Aceptación">
          <p>
            Al crear una cuenta o utilizar Pedidos Rápidos (el “Servicio”), operado por
            [RAZÓN SOCIAL], CUIT [CUIT], con domicilio en [DOMICILIO] (el “Prestador”),
            aceptás estos Términos. Si no estás de acuerdo, no uses el Servicio.
          </p>
        </Section>

        <Section title="2. Descripción del servicio">
          <p>
            Pedidos Rápidos es una plataforma para que comercios publiquen un catálogo,
            reciban pedidos online y los gestionen desde un panel. El Servicio no procesa
            la entrega ni el cobro al consumidor final: el comercio coordina esos pasos por
            sus propios medios (por ejemplo, WhatsApp).
          </p>
        </Section>

        <Section title="3. Tu cuenta">
          <p>
            Sos responsable de la veracidad de los datos, del resguardo de tu contraseña y
            de toda actividad realizada bajo tu cuenta. Debés ser mayor de edad y tener
            facultades para representar al comercio.
          </p>
        </Section>

        <Section title="4. Planes, prueba y pagos">
          <p>
            El Servicio ofrece un período de prueba gratuito de 15 días. Finalizado el
            período, para mantener la tienda activa debés abonar el plan mensual vigente,
            que se paga a través de Mercado Pago. La falta de pago suspende el acceso
            público de la tienda hasta su regularización. Los precios pueden actualizarse
            con aviso previo.
          </p>
        </Section>

        <Section title="5. Uso aceptable y contenido">
          <p>
            Te comprometés a no usar el Servicio para fines ilícitos ni a publicar
            productos o contenidos prohibidos por la ley. El contenido cargado (productos,
            imágenes, precios) es de tu exclusiva responsabilidad. Podemos suspender cuentas
            ante usos abusivos o que comprometan la plataforma.
          </p>
        </Section>

        <Section title="6. Disponibilidad y soporte">
          <p>
            Hacemos esfuerzos razonables para mantener el Servicio disponible, pero se
            presta “tal cual”, sin garantía de disponibilidad ininterrumpida. Podemos
            realizar mantenimientos o cambios.
          </p>
        </Section>

        <Section title="7. Limitación de responsabilidad">
          <p>
            En la máxima medida permitida por la ley, el Prestador no será responsable por
            daños indirectos, lucro cesante ni pérdida de datos derivados del uso o
            imposibilidad de uso del Servicio.
          </p>
        </Section>

        <Section title="8. Datos personales">
          <p>
            El tratamiento de datos se rige por nuestra{' '}
            <Link to="/privacidad" className="text-brand-600 hover:underline">Política de Privacidad</Link>.
          </p>
        </Section>

        <Section title="9. Baja">
          <p>
            Podés dar de baja tu cuenta cuando quieras escribiendo a [EMAIL DE CONTACTO].
            La baja no genera reintegro de períodos ya abonados.
          </p>
        </Section>

        <Section title="10. Cambios">
          <p>
            Podemos modificar estos Términos. Publicaremos la versión vigente con su fecha
            de actualización; el uso continuado implica su aceptación.
          </p>
        </Section>

        <Section title="11. Ley aplicable">
          <p>
            Estos Términos se rigen por las leyes de la República Argentina. Ante cualquier
            controversia se someten a los tribunales ordinarios de [JURISDICCIÓN].
          </p>
        </Section>

        <Section title="12. Contacto">
          <p>Consultas: [EMAIL DE CONTACTO].</p>
        </Section>
      </div>
    </div>
  );
}
