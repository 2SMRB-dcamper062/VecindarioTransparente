<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# VecindarioTransparente

Plataforma de autogestión y transparencia vecinal con asistente Gemini.

## Arrancar en local

**Requisitos:** Node.js 18+

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Configurar variables de entorno — copia el ejemplo y añade tu clave de Gemini:
   ```bash
   cp .env.example .env.local
   ```
   Edita `.env.local` y pon tu clave en `GEMINI_API_KEY`.

3. Cargar la base de datos de demostración:
   ```bash
   npm run db:seed
   ```
   Esto genera `db-local.json` con usuarios, finanzas, votaciones, reservas e incidencias de prueba.

4. Iniciar el servidor:
   ```bash
   npm run dev
   ```
   Abre http://localhost:3000

## Usuarios de prueba

| Usuario       | Contraseña     | Rol                    |
|---------------|----------------|------------------------|
| superadmin    | superadmin123  | SuperAdmin global      |
| presidente    | admin123       | Presidente / Admin     |
| vecino_juan   | vecino123      | Propietario            |
| vecina_maria  | vecino123      | Inquilina              |

Código de invitación para registro: **ALAMEDA2026**

## Dónde va la API Key de Gemini

La clave **no** debe ir en el código fuente. Créala o edítala en:

```
.env.local
```

```env
GEMINI_API_KEY=tu_clave_aqui
```

El servidor la lee al arrancar (`server.ts` carga `.env.local` automáticamente).

## Configuración de Correo Electrónico (SMTP)

Para que el sistema envíe notificaciones por email (registros, avisos de recibos, etc.), añade lo siguiente a tu archivo `.env.local`:

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=vecindariotransparente@gmail.com
EMAIL_PASS=m w l y g r j y j f k r m t h f
EMAIL_FROM=VecindarioTransparente <vecindariotransparente@gmail.com>
```

*Si usas Gmail, recuerda generar una **Contraseña de Aplicación** en tu cuenta de Google (Seguridad > Verificación en dos pasos > Contraseñas de aplicaciones).*

## Recargar datos demo

- Desde terminal: `npm run db:seed`
- Desde la web (solo en desarrollo): botón **Recargar datos demo** en el banner verde de la portada, o `POST /api/dev/seed`
