# 📍 Guía: Dónde Configurar el Interactions Endpoint URL

## Paso a Paso Visual

### 1. Accede a tu Aplicación
Ve a: https://discord.com/developers/applications/1440419369082556630

### 2. Navega a "General Information"
En el menú lateral izquierdo, haz clic en:
```
📋 General Information
```

### 3. Encuentra "Interactions Endpoint URL"
Desplázate hacia abajo en la página hasta encontrar esta sección:

```
┌─────────────────────────────────────────┐
│ Interactions Endpoint URL               │
│                                         │
│ [https://tu-app.railway.app/interactions] │
│                                         │
│ [Save Changes]                          │
└─────────────────────────────────────────┘
```

### 4. Ingresa tu URL
**Formato de la URL:**
```
https://TU-DOMINIO-RAILWAY.app/interactions
```

**Ejemplos:**
- `https://elevate-ai-bot-production.up.railway.app/interactions`
- `https://mi-bot.railway.app/interactions`

**⚠️ IMPORTANTE:**
- ✅ Debe empezar con `https://`
- ✅ Debe terminar con `/interactions`
- ✅ No debe tener espacios
- ✅ El servidor debe estar corriendo y accesible

### 5. Guarda los Cambios
Haz clic en el botón **"Save Changes"** (Guardar Cambios)

### 6. Verificación Automática
Discord verificará automáticamente tu endpoint:
- ✅ **Verde/Check**: La URL es válida y responde correctamente
- ❌ **Rojo/Error**: Hay un problema (revisa los logs del servidor)

## ¿Cuándo Configurarlo?

### Opción 1: Después de Desplegar en Railway (Recomendado)
1. Despliega el bot en Railway
2. Obtén la URL pública de Railway
3. Configura el Interactions Endpoint URL con esa URL

### Opción 2: Para Pruebas Locales
Si quieres probar localmente antes de desplegar:

1. **Usa ngrok** (túnel local):
   ```bash
   # Instala ngrok
   npm install -g ngrok
   
   # Inicia tu servidor local
   npm start
   
   # En otra terminal, crea el túnel
   ngrok http 3000
   ```
   
2. Copia la URL HTTPS que ngrok te da (ej: `https://abc123.ngrok.io`)
3. Configura el Interactions Endpoint URL como:
   ```
   https://abc123.ngrok.io/interactions
   ```

## Verificar que Funciona

Después de configurar el endpoint:

1. Ve a tu servidor de Discord
2. Escribe el comando: `/ai rol_create`
3. Si el bot responde, ¡está funcionando! ✅
4. Si no responde, revisa:
   - Los logs de Railway (o tu servidor local)
   - Que el endpoint esté configurado correctamente
   - Que el servidor esté corriendo

## Troubleshooting

### Error: "Invalid URL"
- Verifica que la URL empiece con `https://`
- Verifica que termine con `/interactions`
- No debe tener espacios

### Error: "Failed to verify"
- El servidor no está corriendo
- La URL no es accesible públicamente
- Hay un error en el código de verificación de firmas

### El bot no responde a comandos
- Verifica que el endpoint esté configurado
- Revisa los logs del servidor
- Asegúrate de que el bot esté en el servidor

