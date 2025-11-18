# Guía de Configuración Rápida

## Información de tu Aplicación

- **Application ID**: `1440419369082556630`
- **Public Key**: `24e35a1273b2f0b53b246a64d9729ae2bfe5009b5aa32bb78670afdf288e02f0`
- **Permissions**: `268502080`

## Pasos Rápidos

### 1. Obtener el Token del Bot

1. Ve a [Discord Developer Portal](https://discord.com/developers/applications/1440419369082556630)
2. Ve a la sección **"Bot"**
3. Haz clic en **"Reset Token"** o copia el token existente
4. **⚠️ IMPORTANTE**: Guarda este token de forma segura, no lo compartas

### 2. Configurar Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
DISCORD_TOKEN=TU_TOKEN_AQUI
DISCORD_CLIENT_ID=1440419369082556630
DISCORD_PUBLIC_KEY=24e35a1273b2f0b53b246a64d9729ae2bfe5009b5aa32bb78670afdf288e02f0
PORT=3000
```

### 3. Habilitar Intents en Discord

En Discord Developer Portal → Bot → Privileged Gateway Intents:
- ✅ **MESSAGE CONTENT INTENT**
- ✅ **SERVER MEMBERS INTENT**

### 4. Invitar el Bot al Servidor

Usa este enlace directo:
```
https://discord.com/api/oauth2/authorize?client_id=1440419369082556630&permissions=268502080&scope=bot%20applications.commands
```

### 5. Crear los Roles en Discord

En tu servidor de Discord, crea estos roles (Configuración del Servidor → Roles):
- **JEFE DE REUNION**
- **PARTICIPANTE DE REUNION**

**⚠️ IMPORTANTE**: 
- El rol del bot debe estar **ARRIBA** de estos roles en la jerarquía
- El bot necesita el permiso "Gestionar Roles"

### 6. Configurar Interactions Endpoint URL

**📍 Ubicación en Discord Developer Portal:**

1. Ve a [Discord Developer Portal](https://discord.com/developers/applications/1440419369082556630)
2. En el menú lateral izquierdo, haz clic en **"General Information"** (o "Información General")
3. Desplázate hacia abajo hasta encontrar la sección **"Interactions Endpoint URL"**
4. Ingresa la URL de tu aplicación (después de desplegar en Railway):
   ```
   https://tu-app.railway.app/interactions
   ```
   **Nota**: Si aún no has desplegado, puedes usar una URL temporal de prueba local con ngrok o similar, pero lo recomendado es desplegar primero en Railway.
5. Haz clic en **"Save Changes"** (Guardar Cambios)
6. Discord verificará automáticamente la URL:
   - ✅ Si la URL es válida y responde correctamente, verás un check verde
   - ❌ Si hay error, verás un mensaje de error (revisa que el servidor esté corriendo)

**⚠️ IMPORTANTE**: 
- La URL debe terminar en `/interactions` (esa es la ruta que configuramos en el código)
- El servidor debe estar corriendo y accesible públicamente
- Discord enviará un PING para verificar que el endpoint funciona

### 7. Probar el Bot

1. En tu servidor de Discord, escribe:
   ```
   /ai rol_create
   ```
2. El bot debería crear un mensaje con las reacciones
3. Prueba reaccionar con 👔 o 🙋‍♂️ para verificar que los roles se asignen correctamente

## Deployment en Railway

Para desplegar el bot en Railway, consulta la guía completa:
👉 **[RAILWAY_DEPLOY.md](./RAILWAY_DEPLOY.md)**

**Resumen rápido:**
1. Sube el código a GitHub
2. Conecta Railway con tu repositorio
3. Configura las variables de entorno en Railway
4. Obtén la URL pública de Railway
5. Configura el Interactions Endpoint URL en Discord

## Troubleshooting

### El bot no responde a comandos
- Verifica que el Interactions Endpoint URL esté configurado correctamente
- Asegúrate de que el servidor esté corriendo y accesible
- Revisa los logs en Railway

### Los roles no se asignan
- Verifica que los roles existan con los nombres exactos
- Asegúrate de que el rol del bot esté por encima de los roles a asignar
- Verifica que el bot tenga permisos de "Gestionar Roles"

### Error de verificación de firma
- Verifica que la Public Key esté correcta en las variables de entorno
- Asegúrate de que no haya espacios extra en la Public Key

