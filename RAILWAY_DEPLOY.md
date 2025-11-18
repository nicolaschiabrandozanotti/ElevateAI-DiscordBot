# 🚂 Guía de Despliegue en Railway

## Paso a Paso para Desplegar tu Bot en Railway

### Opción 1: Desde GitHub (Recomendado)

#### 1. Subir el Código a GitHub

1. **Crea un repositorio en GitHub:**
   - Ve a https://github.com/new
   - Nombre: `elevate-ai-bot` (o el que prefieras)
   - Marca como **Privado** si no quieres que sea público
   - Haz clic en "Create repository"

2. **Inicializa Git en tu proyecto:**
   ```bash
   cd "C:\Users\nicoc\Desktop\ELEVATE AI BOT"
   git init
   git add .
   git commit -m "Initial commit - Discord bot con sistema de roles"
   ```

3. **Conecta con GitHub y sube el código:**
   ```bash
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/elevate-ai-bot.git
   git push -u origin main
   ```
   (Reemplaza `TU_USUARIO` con tu usuario de GitHub)

#### 2. Conectar Railway con GitHub

1. **Ve a Railway:**
   - https://railway.app
   - Inicia sesión con tu cuenta (puedes usar GitHub para login)

2. **Crea un Nuevo Proyecto:**
   - Haz clic en **"New Project"**
   - Selecciona **"Deploy from GitHub repo"**
   - Autoriza Railway para acceder a tus repositorios de GitHub
   - Selecciona el repositorio `elevate-ai-bot`

3. **Railway detectará automáticamente:**
   - ✅ Detectará el `package.json`
   - ✅ Usará Nixpacks como builder
   - ✅ Ejecutará `npm start` automáticamente

#### 3. Configurar Variables de Entorno en Railway

1. **En el proyecto de Railway, haz clic en tu servicio**

2. **Ve a la pestaña "Variables"**

3. **Agrega estas variables:**
   ```
   DISCORD_TOKEN=tu_token_aqui
   DISCORD_CLIENT_ID=1440419369082556630
   DISCORD_PUBLIC_KEY=24e35a1273b2f0b53b246a64d9729ae2bfe5009b5aa32bb78670afdf288e02f0
   ```
   
   **Nota**: `PORT` se asigna automáticamente por Railway, no necesitas agregarlo.

4. **Haz clic en "Deploy"** o Railway desplegará automáticamente

#### 4. Obtener la URL Pública

1. **En Railway, ve a la pestaña "Settings"**

2. **En "Networking" o "Domains":**
   - Railway generará una URL automáticamente (ej: `elevate-ai-bot-production.up.railway.app`)
   - O puedes crear un dominio personalizado

3. **Copia la URL completa** (ej: `https://elevate-ai-bot-production.up.railway.app`)

#### 5. Configurar el Interactions Endpoint en Discord

1. Ve a [Discord Developer Portal](https://discord.com/developers/applications/1440419369082556630)
2. Ve a **"General Information"**
3. En **"Interactions Endpoint URL"**, ingresa:
   ```
   https://TU-URL-RAILWAY.app/interactions
   ```
   (Reemplaza con tu URL real de Railway)
4. Haz clic en **"Save Changes"**
5. Discord verificará automáticamente ✅

---

### Opción 2: Desde el Desktop de Railway (Sin GitHub)

1. **Instala Railway CLI:**
   ```bash
   npm install -g @railway/cli
   ```

2. **Inicia sesión:**
   ```bash
   railway login
   ```

3. **En tu carpeta del proyecto:**
   ```bash
   cd "C:\Users\nicoc\Desktop\ELEVATE AI BOT"
   railway init
   ```

4. **Despliega:**
   ```bash
   railway up
   ```

5. **Configura variables de entorno:**
   ```bash
   railway variables set DISCORD_TOKEN=tu_token_aqui
   railway variables set DISCORD_CLIENT_ID=1440419369082556630
   railway variables set DISCORD_PUBLIC_KEY=24e35a1273b2f0b53b246a64d9729ae2bfe5009b5aa32bb78670afdf288e02f0
   ```

6. **Obtén la URL:**
   ```bash
   railway domain
   ```

---

## Verificar que Funciona

### 1. Revisar los Logs en Railway

1. En Railway, ve a tu proyecto
2. Haz clic en tu servicio
3. Ve a la pestaña **"Deployments"** o **"Logs"**
4. Deberías ver:
   ```
   Bot conectado como TuBot#1234
   Servidor escuchando en puerto 3000
   Comandos registrados exitosamente
   ```

### 2. Probar el Bot en Discord

1. Ve a tu servidor de Discord
2. Escribe: `/ai rol_create`
3. El bot debería responder con el mensaje de roles ✅

### 3. Verificar el Endpoint

Puedes probar manualmente el endpoint:
```bash
curl https://tu-url-railway.app/interactions
```
Debería responder (aunque sea un error 401, significa que el servidor está funcionando)

---

## Troubleshooting

### El despliegue falla

- **Revisa los logs** en Railway para ver el error específico
- **Verifica las variables de entorno** están correctamente configuradas
- **Asegúrate** de que el `package.json` tenga el script `start`

### El bot no se conecta

- **Verifica el DISCORD_TOKEN** está correcto
- **Revisa los logs** para ver errores de conexión
- **Asegúrate** de que el bot esté invitado al servidor

### El Interactions Endpoint no funciona

- **Verifica la URL** termina en `/interactions`
- **Asegúrate** de que el servidor esté desplegado y corriendo
- **Revisa los logs** para ver si hay errores de verificación de firma
- **Verifica** que la `DISCORD_PUBLIC_KEY` esté correcta

### El bot no responde a comandos

- **Verifica** que el Interactions Endpoint URL esté configurado en Discord
- **Espera unos minutos** después de configurar el endpoint (puede tardar)
- **Revisa los logs** en Railway para ver si llegan las interacciones

---

## Costos

Railway ofrece:
- **$5 de crédito gratis** cada mes
- **Plan Hobby**: $5/mes después del crédito gratis
- Para un bot simple como este, el crédito gratis suele ser suficiente

---

## Actualizaciones Futuras

Cada vez que hagas `git push` a GitHub:
- Railway detectará automáticamente los cambios
- Desplegará una nueva versión automáticamente
- No necesitas hacer nada manual ✅

