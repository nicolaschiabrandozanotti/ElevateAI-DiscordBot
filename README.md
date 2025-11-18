# ELEVATE AI BOT - Bot de Discord para Gestión de Roles

Bot de Discord que permite asignar roles mediante reacciones usando el sistema de Interactions Endpoint URL de Discord.

## Características

- ✅ Comando `/ai rol_create` que crea un mensaje con sistema de roles
- ✅ Reacciones con emojis para asignar roles:
  - 👔 → Asigna rol "JEFE DE REUNION"
  - 🙋‍♂️ → Asigna rol "PARTICIPANTE DE REUNION"
- ✅ Quitar reacción para remover el rol
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
2. En "Interactions Endpoint URL", ingresa tu URL de Railway:
   ```
   https://tu-app.railway.app/interactions
   ```
3. Guarda los cambios

## Variables de Entorno

Crea un archivo `.env` con:

```env
DISCORD_TOKEN=tu_token_aqui
DISCORD_CLIENT_ID=1440419369082556630
DISCORD_PUBLIC_KEY=24e35a1273b2f0b53b246a64d9729ae2bfe5009b5aa32bb78670afdf288e02f0
PORT=3000
```

**Nota**: Solo falta agregar el `DISCORD_TOKEN` que debes obtener de la sección "Bot" en Discord Developer Portal.

## Instalación Local

```bash
npm install
npm start
```

## Deployment

### Opción 1: Railway (Recomendado para producción)

Consulta la guía completa: **[RAILWAY_DEPLOY.md](./RAILWAY_DEPLOY.md)**

1. Conecta tu repositorio a Railway
2. Railway detectará automáticamente el `package.json`
3. Agrega las variables de entorno en Railway
4. Obtén la URL pública y configura el Interactions Endpoint URL

### Opción 2: Replit + cron-job.org (Gratis)

Consulta la guía completa: **[REPLIT_DEPLOY.md](./REPLIT_DEPLOY.md)**

1. Importa el repositorio en Replit desde GitHub
2. Configura las variables de entorno en Replit (Secrets)
3. Obtén la URL pública de Replit
4. Configura cron-job.org para mantener el bot activo (ping cada 5 minutos)
5. Configura el Interactions Endpoint URL en Discord

## Uso

1. En tu servidor de Discord, usa el comando:
   ```
   /ai rol_create
   ```
2. El bot creará un mensaje con instrucciones
3. Los usuarios pueden reaccionar con 👔 o 🙋‍♂️ para obtener roles
4. Al quitar la reacción, se remueve el rol automáticamente

## Notas

- El bot necesita permisos de "Manage Roles"
- El rol del bot debe estar por encima de los roles que asigna
- Las reacciones se procesan mediante eventos del cliente Discord.js

