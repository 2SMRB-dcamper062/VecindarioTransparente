# VecindarioTransparente 🏡

<p align="center">
  <img src="/assets/logo.png" alt="VecindarioTransparente Logo" width="200" height="200">
</p>

## 📄 Descripción

**VecindarioTransparente** es una plataforma web moderna e interactiva diseñada para la autogestión, digitalización y transparencia total de comunidades de propietarios (propiedad horizontal). Estructurada como una SPA (Single Page Application) reactiva, esta aplicación centraliza la administración de finanzas, la toma de decisiones democráticas, el reporte de incidencias y la reserva de áreas comunes en un único panel visual e intuitivo, eliminando las fricciones y la opacidad tradicionales en la gestión vecinal.

---

## ✨ Características Principales

* **Transparencia Financiera:** Acceso completo al libro de caja, ingresos, gastos y conciliación de facturas de la comunidad en tiempo real.
* **Democracia Directa y Votaciones:** Sistema integrado de plebiscitos ("un propietario, un voto") con escrutinio automatizado y gráficos estadísticos interactivos en directo.
* **Reservas Inteligentes:** Calendario en tiempo real para reservar zonas comunes (pistas de pádel, piscina, salón social) con validación horaria anti-duplicados.
* **Gestión de Incidencias:** Reporte dinámico de averías con categorización por estado y carga de fotografías justificantes.
* **Asistente Virtual con IA:** Chat bot inteligente integrado con soporte de lectura por voz (*Speech Synthesis API*) para resolver dudas sobre normativas o estatutos de la finca.
* **Roles de Acceso Seguros:** Interfaz adaptada según el perfil del usuario: *Propietario/Vecino*, *Presidente/Administrador* y *SuperAdmin Global*.
* **Modo Oscuro v2.0 Ultra:** Soporte nativo avanzado y optimizado con gradientes oscuros de tipo Slate para una experiencia visual premium.
* **Internacionalización (i18n):** Traducción bilingüe completa e instantánea (Español / Inglés) con persistencia en el navegador.

---

## 🚀 Tecnologías Utilizadas

El desarrollo del frontend aprovecha un stack moderno, ágil y de alto rendimiento que agiliza la carga y ejecución nativa en el navegador:

* **Vue 3 (Global Build via CDN):** Núcleo del frontend que gestiona de manera reactiva el estado global de la interfaz, el renderizado de vistas por rol y el enlace de datos bidireccional (`v-model`).
* **Tailwind CSS (v3+ via CDN):** Framework utilitario para el diseño visual, maquetación adaptativa (responsiva) y componentes tipo tarjeta premium con efectos de cristal esmerilado (`backdrop-blur`).
* **Lucide Icons:** Biblioteca de iconos vectoriales limpios y dinámicos para guiar la navegación del usuario.
* **Web Push & Service Workers:** Infraestructura preparada para la gestión de suscripciones push con claves VAPID para notificaciones en tiempo real.
* **Web Speech API:** Interfaz nativa utilizada para dotar de voz interactiva al asistente de la comunidad.

---

## 🛠️ Instalación y Ejecución

Sigue estos pasos para clonar el repositorio, configurar el entorno local y arrancar el servidor de desarrollo en tu máquina:

1. **Clonar el repositorio:**
```bash
git clone https://github.com/tu-usuario/vecindariotransparente.git
cd vecindariotransparente
```

2. **Instalar las dependencias:**
```bash
npm install
```

3. **Iniciar el servidor de desarrollo:**
```bash
npm run dev

```

4. **Acceder a la aplicación:**
Abre tu navegador de preferencia e ingresa a la siguiente URL local:
```text
http://localhost:3000
```

<div align="center" style="margin-top: 2rem; border-top: 1px solid #e2e8f0; padding-top: 1.5rem;">
  <p style="font-size: 0.75rem; color: #94a3b8; margin: 0;">
    &copy; 2026 David Camacho. Todos los derechos reservados.
  </p>
</div>