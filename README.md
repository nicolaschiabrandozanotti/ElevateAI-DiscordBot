# ELEVATE AI BOT - Bot de Discord para Gestión de Roles

Bot de Discord que permite asignar roles mediante reacciones usando el sistema de Interactions Endpoint URL de Discord.

## Características

- ✅ Comando `/ai rol_create` que crea un mensaje con sistema de roles
- ✅ Reacciones con emojis para asignar roles:
  - 👔 → Asigna rol "JEFE DE REUNION"
  - 🙋‍♂️ → Asigna rol "PARTICIPANTE DE REUNION"
- ✅ Quitar reacción para remover el rol
- ✅ Comando `/wsp` para enviar mensajes de WhatsApp
- ✅ Comando `/email` para enviar emails
- ✅ Usa Interactions Endpoint URL (webhooks HTTP)

## Configuración

### 1. Crear aplicación en Discord

1. Ve a [Discord Developer Portal](https://discord.com/developers/applications)
2. Crea una nueva aplicación
3. Ve a "Bot" y crea un bot
4. Copia el **Token** del bot
5. Ve a "General Information" y copia el **Application ID** (Client ID)
6. Ve a "General Information" y copia la **Public Key**

### 2. Configurar permisos del bot

En la sección "Bot" del Developer Portal, habilita:
- ✅ **MESSAGE CONTENT INTENT** (si usas Discord.js v13+)
- ✅ **SERVER MEMBERS INTENT** (necesario para asignar roles)

### 3. Invitar el bot al servidor

Usa esta URL con tu Application ID:
```
https://discord.com/api/oauth2/authorize?client_id=1440419369082556630&permissions=268502080&scope=bot%20applications.commands
```

O reemplaza `CLIENT_ID` con tu Application ID si prefieres:
```
https://discord.com/api/oauth2/authorize?client_id=CLIENT_ID&permissions=268502080&scope=bot%20applications.commands
```

Los permisos incluyen: Manage Roles, Send Messages, Add Reactions, y más.

### 4. Crear los roles en Discord

Asegúrate de crear estos roles en tu servidor de Discord:
- **JEFE DE REUNION**
- **PARTICIPANTE DE REUNION**

**IMPORTANTE**: El rol del bot debe estar **ARRIBA** de los roles que va a asignar en la jerarquía de roles del servidor.

### 5. Configurar Interactions Endpoint URL

1. En Discord Developer Portal, ve a "General Information"
2. En "Interactions Endpoint URL", ingresa tu URL de Deno Deploy:
   ```
   https://tu-proyecto.deno.dev/interactions
   ```
3. Guarda los cambios

## Variables de Entorno

Crea un archivo `.env` con:

```env
# Discord
DISCORD_TOKEN=tu_token_aqui
DISCORD_CLIENT_ID=1440419369082556630
DISCORD_PUBLIC_KEY=24e35a1273b2f0b53b246a64d9729ae2bfe5009b5aa32bb78670afdf288e02f0
PORT=3000

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu_email@gmail.com
SMTP_PASSWORD=tu_contraseña_de_aplicacion

# WhatsApp (Twilio) - Opcional
TWILIO_ACCOUNT_SID=tu_account_sid
TWILIO_AUTH_TOKEN=tu_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

### Configuración de Email (SMTP)

Para usar el comando `/email`, necesitas configurar las credenciales SMTP. Aquí te explico cómo hacerlo con **Gmail**:

#### 1. Habilitar verificación en 2 pasos
1. Ve a tu cuenta de Google: https://myaccount.google.com/
2. Ve a **Seguridad**
3. Habilita **Verificación en 2 pasos** (si no está habilitada)

#### 2. Crear una contraseña de aplicación
1. Ve a: https://myaccount.google.com/apppasswords
2. Selecciona **Aplicación**: "Correo"
3. Selecciona **Dispositivo**: "Otro (nombre personalizado)" y escribe "Discord Bot"
4. Haz clic en **Generar**
5. **Copia la contraseña de 16 caracteres** (sin espacios)

#### 3. Configurar variables de entorno (Opcional)
Puedes configurar las variables de entorno en tu archivo `.env` O pasar la contraseña directamente en el comando `/email`:

**Opción A: Variables de entorno (recomendado para producción)**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu_email@gmail.com
SMTP_PASSWORD=xxxx xxxx xxxx xxxx  # La contraseña de aplicación de 16 caracteres
```

**Opción B: Pasar contraseña en el comando (más flexible)**
No necesitas configurar `SMTP_PASSWORD` si prefieres pasarla cada vez que uses el comando:
```
/email ... smtp_password:"xxxx xxxx xxxx xxxx"
```

**Nota**: Si usas otro proveedor de email (Outlook, Yahoo, etc.), ajusta `SMTP_HOST` y `SMTP_PORT` según corresponda:
- **Gmail**: `smtp.gmail.com:587`
- **Outlook**: `smtp-mail.outlook.com:587`
- **Yahoo**: `smtp.mail.yahoo.com:587`

## Instalación Local

Este bot está construido con **Deno**. Para ejecutarlo localmente:

```bash
deno task start
```

O con permisos explícitos:

```bash
deno run --allow-net --allow-env --allow-read index.ts
```

## Deployment

### Deno Deploy (Recomendado)

Consulta la guía completa: **[DENO_DEPLOY.md](./DENO_DEPLOY.md)**

1. Ve a https://deno.com/deploy
2. Conecta tu repositorio de GitHub
3. Configura las variables de entorno:
   - `DISCORD_TOKEN`
   - `DISCORD_CLIENT_ID`
   - `DISCORD_PUBLIC_KEY`
   - `SMTP_HOST` (opcional, por defecto: smtp.gmail.com)
   - `SMTP_PORT` (opcional, por defecto: 587)
   - `SMTP_USER` (opcional, usa el mail_propio del comando si no se define)
   - `SMTP_PASSWORD` (requerido para `/email`)
   - `TWILIO_ACCOUNT_SID` (requerido para `/wsp`)
   - `TWILIO_AUTH_TOKEN` (requerido para `/wsp`)
   - `TWILIO_WHATSAPP_NUMBER` (requerido para `/wsp`)
4. Obtén la URL pública (ej: `https://tu-proyecto.deno.dev`)
5. Configura el Interactions Endpoint URL en Discord: `https://tu-proyecto.deno.dev/interactions`
6. (Opcional) Configura cron-job.org para mantener el bot activo: `https://tu-proyecto.deno.dev/`

## Uso

### Comando `/ai rol_create`
1. En tu servidor de Discord, usa el comando:
   ```
   /ai rol_create
   ```
2. El bot creará un mensaje con instrucciones
3. Los usuarios pueden reaccionar con 👔 o 🙋‍♂️ para obtener roles
4. Al quitar la reacción, se remueve el rol automáticamente

### Comando `/email`
Envía un email desde Discord:

```
/email mail_propio:tu@email.com mail_contacto:destinatario@email.com asunto:"Asunto del email" mensaje:"Tu mensaje aquí" [smtp_password:"contraseña"]
```

**Parámetros:**
- `mail_propio`: Tu dirección de email (requerido)
- `mail_contacto`: Email del destinatario (requerido)
- `asunto`: Asunto del email (requerido)
- `mensaje`: Mensaje del email (requerido)
- `smtp_password`: Contraseña SMTP (opcional - si no se proporciona, usa `SMTP_PASSWORD` de las variables de entorno)

**Ejemplo sin contraseña (usa variable de entorno):**
```
/email mail_propio:juan@gmail.com mail_contacto:maria@example.com asunto:"Reunión importante" mensaje:"Hola María, me comunicaba contigo para coordinar la reunión de mañana."
```

**Ejemplo con contraseña en el comando:**
```
/email mail_propio:juan@gmail.com mail_contacto:maria@example.com asunto:"Reunión importante" mensaje:"Hola María, me comunicaba contigo para coordinar la reunión de mañana." smtp_password:"xxxx xxxx xxxx xxxx"
```

### Comando `/wsp` (WhatsApp)
Envía un mensaje de WhatsApp usando Twilio:

```
/wsp numero_propio:+5491111111111 numero_contacto:+5492222222222 mensaje:"Hola, me comunicaba contigo por..."
```

**Nota**: Requiere configuración de Twilio (ver sección de Variables de Entorno)

## Notas

- El bot necesita permisos de "Manage Roles"
- El rol del bot debe estar por encima de los roles que asigna
- Las reacciones se procesan mediante eventos del cliente Discord.js

