import { Link } from 'react-router-dom';

const UPDATED = '18 de junio de 2026';

function Section({ title, children }) {
  return (
    <section className="mt-5">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      <div className="text-sm text-slate-700 space-y-2 mt-1">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link to="/" className="text-sm text-slate-600 hover:text-slate-900">&larr; Inicio</Link>
        <h1 className="text-2xl font-bold mt-2">Política de Privacidad</h1>
        <p className="text-xs text-slate-500 mt-1">Última actualización: {UPDATED}</p>

        <p className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 mt-4">
          Plantilla orientativa. Reemplazá los datos entre corchetes y revisala con un
          profesional legal antes de publicarla.
        </p>

        <Section title="1. Responsable del tratamiento">
          <p>
            [RAZÓN SOCIAL], CUIT [CUIT], domicilio [DOMICILIO], correo [EMAIL DE CONTACTO]
            (el “Responsable”), es quien trata los datos personales recopilados a través de
            Pedidos Rápidos.
          </p>
        </Section>

        <Section title="2. Qué datos recopilamos">
          <p><strong>Del comercio (usuario del panel):</strong> nombre de la tienda, nombre y
            email del administrador, número de WhatsApp y datos de la cuenta.</p>
          <p><strong>De los clientes finales (al hacer un pedido):</strong> nombre, teléfono,
            domicilio de entrega (si lo indican), notas y detalle del pedido. Estos datos los
            ingresa el cliente final y el comercio es responsable de su uso.</p>
          <p><strong>Pagos:</strong> los pagos de la suscripción se procesan en Mercado Pago;
            no almacenamos datos de tarjetas.</p>
        </Section>

        <Section title="3. Para qué los usamos">
          <p>
            Para prestar el Servicio (crear la tienda, registrar y gestionar pedidos),
            cobrar la suscripción, enviar comunicaciones operativas (por ejemplo, aviso de
            fin de prueba o restablecimiento de contraseña) y dar soporte.
          </p>
        </Section>

        <Section title="4. Con quién los compartimos">
          <p>Solo con proveedores necesarios para operar, en calidad de encargados:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Mercado Pago (procesamiento de pagos de la suscripción).</li>
            <li>Proveedor de email saliente (SMTP) para los avisos transaccionales.</li>
            <li>Proveedor de infraestructura/hosting donde corre la aplicación.</li>
          </ul>
          <p>No vendemos datos personales.</p>
        </Section>

        <Section title="5. Conservación">
          <p>
            Conservamos los datos mientras la cuenta esté activa y por el plazo necesario
            para cumplir obligaciones legales. Podés solicitar su eliminación según el punto 7.
          </p>
        </Section>

        <Section title="6. Seguridad">
          <p>
            Aplicamos medidas razonables (contraseñas con hash, conexiones cifradas, acceso
            restringido). Ningún sistema es 100% infalible.
          </p>
        </Section>

        <Section title="7. Tus derechos">
          <p>
            Como titular podés ejercer los derechos de acceso, rectificación, actualización
            y supresión de tus datos escribiendo a [EMAIL DE CONTACTO]. Conforme a la Ley
            25.326 de Protección de Datos Personales, la Agencia de Acceso a la Información
            Pública (AAIP) es la autoridad de control y atiende denuncias.
          </p>
        </Section>

        <Section title="8. Cookies y almacenamiento local">
          <p>
            Usamos almacenamiento local del navegador (localStorage) para la sesión del
            panel y el carrito de compras. No usamos cookies de publicidad de terceros.
          </p>
        </Section>

        <Section title="9. Cambios">
          <p>
            Podemos actualizar esta Política; publicaremos la versión vigente con su fecha.
          </p>
        </Section>

        <Section title="10. Contacto">
          <p>Por cualquier consulta sobre tus datos: [EMAIL DE CONTACTO].</p>
        </Section>
      </div>
    </div>
  );
}
