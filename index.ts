import express from 'express';
import { Client, GatewayIntentBits, REST, Routes, EmbedBuilder } from 'discord.js';
import nacl from 'tweetnacl';
import twilio from 'twilio';
import nodemailer from 'nodemailer';
import makeWASocket, { DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';

const app = express();
const PORT = Deno.env.get('PORT') || '3000';

// Variable global para el socket de WhatsApp
let whatsappSocket: any = null;
let whatsappReady = false;

// Configuración de Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
  ],
});

const rest = new REST({ version: '10' }).setToken(Deno.env.get('DISCORD_TOKEN') || '');

// Middleware para verificar la firma de Discord
app.use(express.raw({ type: 'application/json' }));

// Verificar firma de Discord
function verifySignature(req: any, res: any, next: any) {
  const signature = req.get('X-Signature-Ed25519');
  const timestamp = req.get('X-Signature-Timestamp');
  const body = req.body;

  if (!signature || !timestamp) {
    return res.status(401).send('Falta la firma');
  }

  const publicKey = Deno.env.get('DISCORD_PUBLIC_KEY');
  if (!publicKey) {
    return res.status(500).send('Public key no configurada');
  }

  try {
    const timestampBody = new TextEncoder().encode(timestamp + body);
    const signatureBytes = hexToUint8Array(signature);
    const publicKeyBytes = hexToUint8Array(publicKey);

    const isVerified = nacl.sign.detached.verify(
      timestampBody,
      signatureBytes,
      publicKeyBytes
    );

    if (!isVerified) {
      return res.status(401).send('Firma inválida');
    }
  } catch (error) {
    console.error('Error verificando firma:', error);
    return res.status(401).send('Error verificando firma');
  }

  req.body = JSON.parse(body.toString());
  next();
}

// Función auxiliar para convertir hex a Uint8Array
function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

// Función para inicializar WhatsApp con Baileys
async function inicializarWhatsApp() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState('whatsapp_auth');
    const { version } = await fetchLatestBaileysVersion();
    
    const socket = makeWASocket({
      version,
      printQRInTerminal: true,
      auth: state,
      generateHighQualityLinkPreview: true,
    });

    socket.ev.on('creds.update', saveCreds);

    socket.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log('\n📱 Escanea este código QR con WhatsApp:');
        qrcode.generate(qr, { small: true });
      }
      
      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('Conexión cerrada debido a ', lastDisconnect?.error, ', reconectando ', shouldReconnect);
        
        if (shouldReconnect) {
          inicializarWhatsApp();
        } else {
          whatsappReady = false;
          whatsappSocket = null;
        }
      } else if (connection === 'open') {
        console.log('✅ WhatsApp conectado exitosamente');
        whatsappReady = true;
      }
    });

    socket.ev.on('messages.upsert', () => {
      // Manejar mensajes entrantes si es necesario
    });

    whatsappSocket = socket;
    return socket;
  } catch (error: any) {
    console.error('Error inicializando WhatsApp:', error);
    whatsappReady = false;
    return null;
  }
}

// Función para enviar mensaje de WhatsApp automáticamente
async function enviarWhatsAppAutomatico(numeroContacto: string, mensaje: string) {
  try {
    if (!whatsappReady || !whatsappSocket) {
      return { 
        success: false, 
        error: 'WhatsApp no está conectado. Inicializa la conexión primero.',
        enlace: generarEnlaceWhatsApp(numeroContacto, mensaje).enlace
      };
    }

    // Limpiar y formatear el número
    let numeroLimpio = numeroContacto.replace(/[\s\-\(\)]/g, '');
    if (!numeroLimpio.startsWith('+')) {
      numeroLimpio = '+' + numeroLimpio;
    }
    
    // Formatear número para WhatsApp (código de país + número sin +)
    const numeroJid = `${numeroLimpio}@s.whatsapp.net`;
    
    // Enviar mensaje
    await whatsappSocket.sendMessage(numeroJid, { text: mensaje });
    
    return { 
      success: true, 
      message: 'Mensaje de WhatsApp enviado exitosamente',
      numero: numeroLimpio
    };
  } catch (error: any) {
    console.error('Error enviando WhatsApp:', error);
    // Si falla, devolver enlace como fallback
    const enlace = generarEnlaceWhatsApp(numeroContacto, mensaje);
    return { 
      success: false, 
      error: error.message,
      enlace: enlace.enlace,
      fallback: true
    };
  }
}

// Función para generar enlace de WhatsApp (wa.me) - fallback
function generarEnlaceWhatsApp(numeroContacto: string, mensaje: string) {
  try {
    // Limpiar y formatear el número (eliminar espacios, guiones, paréntesis, etc.)
    let numeroLimpio = numeroContacto.replace(/[\s\-\(\)]/g, '');
    
    // Si no empieza con +, agregarlo
    if (!numeroLimpio.startsWith('+')) {
      numeroLimpio = '+' + numeroLimpio;
    }
    
    // Codificar el mensaje para URL
    const mensajeCodificado = encodeURIComponent(mensaje);
    
    // Generar enlace wa.me
    const enlace = `https://wa.me/${numeroLimpio.replace('+', '')}?text=${mensajeCodificado}`;
    
    return { 
      success: true, 
      enlace: enlace,
      numero: numeroLimpio,
      mensaje: 'Enlace de WhatsApp generado exitosamente'
    };
  } catch (error: any) {
    console.error('Error generando enlace WhatsApp:', error);
    return { success: false, error: error.message };
  }
}

// Función para enviar email usando nodemailer
async function enviarEmail(mailPropio: string, mailContacto: string, asunto: string, mensaje: string, smtpPasswordParam?: string) {
  try {
    const smtpHost = Deno.env.get('SMTP_HOST') || 'smtp.gmail.com';
    const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '587');
    const smtpUser = Deno.env.get('SMTP_USER') || mailPropio;
    // Usar la contraseña del parámetro si se proporciona, sino usar la de las variables de entorno
    const smtpPassword = smtpPasswordParam || Deno.env.get('SMTP_PASSWORD');

    if (!smtpPassword) {
      throw new Error('SMTP_PASSWORD no configurado. Proporciona la contraseña en el comando o configura SMTP_PASSWORD en las variables de entorno.');
    }

    // Limpiar espacios de la contraseña (Gmail las genera con espacios pero no los acepta)
    const cleanPassword = smtpPassword.replace(/\s/g, '');

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // true para 465, false para otros puertos
      auth: {
        user: smtpUser,
        pass: cleanPassword,
      },
    });

    // Verificar conexión antes de enviar
    await transporter.verify();

    const info = await transporter.sendMail({
      from: `"${mailPropio}" <${mailPropio}>`,
      to: mailContacto,
      subject: asunto,
      text: mensaje,
      html: `<p>${mensaje.replace(/\n/g, '<br>')}</p>`,
    });

    return { success: true, messageId: info.messageId, message: 'Email enviado exitosamente' };
  } catch (error: any) {
    console.error('Error enviando email:', error);
    
    // Mensajes de error más claros
    let errorMessage = error.message;
    
    if (errorMessage.includes('535') || errorMessage.includes('BadCredentials') || errorMessage.includes('Username and Password not accepted')) {
      errorMessage = '❌ Error de autenticación Gmail:\n' +
        '1. Asegúrate de usar una CONTRASEÑA DE APLICACIÓN (no tu contraseña normal)\n' +
        '2. Verifica que la verificación en 2 pasos esté habilitada\n' +
        '3. Genera una nueva contraseña de aplicación en: https://myaccount.google.com/apppasswords\n' +
        '4. La contraseña debe tener 16 caracteres (sin espacios)\n' +
        '5. El email debe ser el mismo que usaste para generar la contraseña';
    } else if (errorMessage.includes('EAUTH')) {
      errorMessage = '❌ Error de autenticación. Verifica tu usuario y contraseña SMTP.';
    }
    
    return { success: false, error: errorMessage };
  }
}

// Endpoint para interactions
app.post('/interactions', verifySignature, async (req: any, res: any) => {
  const interaction = req.body;

  // Responder a PING
  if (interaction.type === 1) {
    return res.json({ type: 1 });
  }

  // Manejar comandos
  if (interaction.type === 2) {
    if (interaction.data.name === 'ai') {
      const subcommand = interaction.data.options?.[0]?.name;

      if (subcommand === 'rol_create') {
        // Crear embed con imagen y botones de reacción
        const embed = new EmbedBuilder()
          .setTitle('🎯 Sistema de Roles de Reunión')
          .setDescription(
            'Reacciona con los emojis para obtener tu rol:\n\n' +
            '👔 - **JEFE DE REUNION**\n' +
            '🙋‍♂️ - **PARTICIPANTE DE REUNION**\n\n' +
            'Toca el emoji para obtener el rol, vuelve a tocarlo para quitártelo.'
          )
          .setColor(0x5865F2)
          .setImage('https://via.placeholder.com/600x200/5865F2/FFFFFF?text=Sistema+de+Roles')
          .setTimestamp();

        const response = {
          type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
          data: {
            embeds: [embed.toJSON()],
          },
        };

        res.json(response);

        // Agregar reacciones después de crear el mensaje
        setTimeout(async () => {
          try {
            const channel = await client.channels.fetch(interaction.channel_id);
            if (!channel) {
              console.error('Canal no encontrado');
              return;
            }

            // Buscar el mensaje más reciente del bot en este canal
            const messages = await channel.messages.fetch({ limit: 10 });
            const botMessage = messages.find(
              (msg: any) => 
                msg.author.id === client.user?.id && 
                msg.embeds.length > 0 &&
                msg.embeds[0].title === '🎯 Sistema de Roles de Reunión' &&
                !msg.reactions.cache.has('👔')
            );

            if (botMessage) {
              await botMessage.react('👔');
              await botMessage.react('🙋‍♂️');
              console.log('Reacciones agregadas al mensaje');
            } else {
              console.log('Mensaje del bot no encontrado o ya tiene reacciones');
            }
          } catch (error) {
            console.error('Error agregando reacciones:', error);
          }
        }, 2000);
      }
    }

    // Comando /wsp para enviar mensajes de WhatsApp
    if (interaction.data.name === 'wsp') {
      const options = interaction.data.options || [];
      const numeroContacto = options.find((opt: any) => opt.name === 'numero_contacto')?.value;
      const mensaje = options.find((opt: any) => opt.name === 'mensaje')?.value;

      if (!numeroContacto || !mensaje) {
        return res.json({
          type: 4,
          data: {
            content: '❌ Error: Faltan parámetros. Usa: `/wsp numero_contacto:... mensaje:...`',
            flags: 64, // EPHEMERAL
          },
        });
      }

      // Responder inmediatamente
      res.json({
        type: 4,
        data: {
          content: '📱 Enviando mensaje de WhatsApp...',
          flags: 64, // EPHEMERAL
        },
      });

      // Intentar enviar automáticamente
      const resultado = await enviarWhatsAppAutomatico(numeroContacto, mensaje);

      // Editar la respuesta con el resultado
      try {
        const followupUrl = `https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`;
        await fetch(followupUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: resultado.success
              ? `✅ ${resultado.message}\n📱 Enviado a: ${resultado.numero}`
              : resultado.fallback
              ? `⚠️ WhatsApp no está conectado. Usa este enlace:\n\n${resultado.enlace}\n\n💡 Para enviar automáticamente, inicializa WhatsApp con: \`/wsp_init\``
              : `❌ Error: ${resultado.error}\n\n📱 Enlace alternativo: ${resultado.enlace || 'No disponible'}`,
          }),
        });
      } catch (error) {
        console.error('Error actualizando mensaje:', error);
      }
      return;
    }

    // Comando /wsp_init para inicializar WhatsApp
    if (interaction.data.name === 'wsp_init') {
      // Responder inmediatamente
      res.json({
        type: 4,
        data: {
          content: '📱 Inicializando WhatsApp... Revisa la consola del servidor para ver el código QR.',
          flags: 64, // EPHEMERAL
        },
      });

      // Inicializar WhatsApp
      try {
        await inicializarWhatsApp();
        // Editar respuesta después de un momento
        setTimeout(async () => {
          try {
            const followupUrl = `https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`;
            await fetch(followupUrl, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: whatsappReady
                  ? '✅ WhatsApp conectado exitosamente. Ya puedes usar `/wsp` para enviar mensajes automáticamente.'
                  : '📱 Revisa la consola del servidor y escanea el código QR con WhatsApp.\n\nUna vez conectado, podrás usar `/wsp` para enviar mensajes automáticamente.',
              }),
            });
          } catch (error) {
            console.error('Error actualizando mensaje:', error);
          }
        }, 2000);
      } catch (error: any) {
        console.error('Error inicializando WhatsApp:', error);
      }
      return;
    }

    // Comando /email para enviar emails
    if (interaction.data.name === 'email') {
      const options = interaction.data.options || [];
      const mailPropio = options.find((opt: any) => opt.name === 'mail_propio')?.value;
      const mailContacto = options.find((opt: any) => opt.name === 'mail_contacto')?.value;
      const asunto = options.find((opt: any) => opt.name === 'asunto')?.value;
      const mensaje = options.find((opt: any) => opt.name === 'mensaje')?.value;
      const smtpPassword = options.find((opt: any) => opt.name === 'smtp_password')?.value;

      if (!mailPropio || !mailContacto || !asunto || !mensaje) {
        return res.json({
          type: 4,
          data: {
            content: '❌ Error: Faltan parámetros. Usa: `/email mail_propio:... mail_contacto:... asunto:... mensaje:... [smtp_password:...]`',
            flags: 64, // EPHEMERAL
          },
        });
      }

      // Responder inmediatamente (Discord requiere respuesta en 3 segundos)
      res.json({
        type: 4,
        data: {
          content: '📧 Enviando email...',
          flags: 64, // EPHEMERAL
        },
      });

      // Enviar el email de forma asíncrona
      const resultado = await enviarEmail(mailPropio, mailContacto, asunto, mensaje, smtpPassword);

      // Editar la respuesta con el resultado
      try {
        const followupUrl = `https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`;
        await fetch(followupUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: resultado.success
              ? `✅ ${resultado.message}\n📧 ID: ${resultado.messageId}`
              : `❌ Error: ${resultado.error}`,
          }),
        });
      } catch (error) {
        console.error('Error actualizando mensaje:', error);
      }
      return;
    }
  }
});

// Función auxiliar para procesar reacciones
async function processReaction(messageId: string, channelId: string, userId: string, emojiName: string | null, isAdd: boolean) {
  try {
    // Obtener el canal
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      console.log('Canal no encontrado o no es de texto');
      return;
    }

    // Obtener el mensaje completo desde la API
    const message = await channel.messages.fetch(messageId);
    
    if (!message.embeds || message.embeds.length === 0) {
      console.log('Mensaje sin embeds, ignorando');
      return;
    }

    const embedTitle = message.embeds[0].title;
    if (embedTitle !== '🎯 Sistema de Roles de Reunión') {
      console.log('Embed no es del sistema de roles, ignorando');
      return;
    }

    const guild = message.guild;
    if (!guild) {
      console.log('No hay guild, ignorando');
      return;
    }

    // Obtener el usuario y miembro
    const user = await client.users.fetch(userId);
    if (user.bot) return;

    const member = await guild.members.fetch(userId);
    if (!member) {
      console.log('Miembro no encontrado');
      return;
    }

    let roleName: string | null = null;

    if (emojiName === '👔') {
      roleName = 'JEFE DE REUNION';
    } else if (emojiName === '🙋‍♂️') {
      roleName = 'PARTICIPANTE DE REUNION';
    }

    if (!roleName) {
      console.log(`Emoji ${emojiName} no corresponde a ningún rol`);
      return;
    }

    console.log(`${isAdd ? 'Agregando' : 'Removiendo'} rol: ${roleName} para ${user.tag}`);

    const role = guild.roles.cache.find(r => r.name === roleName);
    if (!role) {
      console.log(`❌ Rol "${roleName}" no encontrado en el servidor`);
      return;
    }

    try {
      if (isAdd) {
        await member.roles.add(role);
        console.log(`✅ Rol ${roleName} asignado exitosamente a ${user.tag}`);
      } else {
        await member.roles.remove(role);
        console.log(`✅ Rol ${roleName} removido exitosamente de ${user.tag}`);
      }
    } catch (error: any) {
      console.error(`❌ Error ${isAdd ? 'asignando' : 'removiendo'} rol ${roleName}:`, error.message);
    }
  } catch (error: any) {
    console.error('Error procesando reacción:', error.message);
  }
}

// Usar eventos RAW para capturar TODAS las reacciones, incluso en mensajes no cacheados
client.on('raw', async (packet: any) => {
  // Escuchar eventos de reacciones agregadas
  if (packet.t === 'MESSAGE_REACTION_ADD') {
    const { message_id, channel_id, user_id, emoji } = packet.d;
    const emojiName = emoji.name || (emoji.id ? `<:${emoji.name}:${emoji.id}>` : null);
    
    console.log(`[RAW] Reacción agregada: ${emojiName} por usuario ${user_id} en mensaje ${message_id}`);
    await processReaction(message_id, channel_id, user_id, emojiName, true);
  }
  
  // Escuchar eventos de reacciones removidas
  if (packet.t === 'MESSAGE_REACTION_REMOVE') {
    const { message_id, channel_id, user_id, emoji } = packet.d;
    const emojiName = emoji.name || (emoji.id ? `<:${emoji.name}:${emoji.id}>` : null);
    
    console.log(`[RAW] Reacción removida: ${emojiName} por usuario ${user_id} en mensaje ${message_id}`);
    await processReaction(message_id, channel_id, user_id, emojiName, false);
  }
});

// También mantener el listener normal por si acaso
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;
  // El evento raw ya maneja esto, pero lo dejamos como backup
  console.log(`[NORMAL] Reacción agregada: ${reaction.emoji.name} por ${user.tag}`);
});

// También mantener el listener normal por si acaso
client.on('messageReactionRemove', async (reaction, user) => {
  if (user.bot) return;
  // El evento raw ya maneja esto, pero lo dejamos como backup
  console.log(`[NORMAL] Reacción removida: ${reaction.emoji.name} por ${user.tag}`);
});

// Registrar comandos cuando el bot se conecta
client.once('ready', async () => {
  console.log(`Bot conectado como ${client.user?.tag}`);

  try {
    console.log('Registrando comandos...');

    const commands = [
      {
        name: 'ai',
        description: 'Comandos de IA',
        options: [
          {
            name: 'rol_create',
            description: 'Crea un mensaje con sistema de roles por reacciones',
            type: 1, // SUB_COMMAND
          },
        ],
      },
      {
        name: 'wsp',
        description: 'Envía un mensaje de WhatsApp automáticamente (requiere WhatsApp inicializado)',
        options: [
          {
            name: 'numero_contacto',
            description: 'Número del contacto (ej: +5491111111111 o 5491111111111)',
            type: 3, // STRING
            required: true,
          },
          {
            name: 'mensaje',
            description: 'Mensaje a enviar',
            type: 3, // STRING
            required: true,
          },
        ],
      },
      {
        name: 'wsp_init',
        description: 'Inicializa la conexión de WhatsApp (muestra QR para escanear)',
      },
      {
        name: 'email',
        description: 'Envía un email',
        options: [
          {
            name: 'mail_propio',
            description: 'Tu dirección de email',
            type: 3, // STRING
            required: true,
          },
          {
            name: 'mail_contacto',
            description: 'Email del destinatario',
            type: 3, // STRING
            required: true,
          },
          {
            name: 'asunto',
            description: 'Asunto del email',
            type: 3, // STRING
            required: true,
          },
          {
            name: 'mensaje',
            description: 'Mensaje del email',
            type: 3, // STRING
            required: true,
          },
          {
            name: 'smtp_password',
            description: 'Contraseña SMTP (opcional, usa SMTP_PASSWORD de variables de entorno si no se proporciona)',
            type: 3, // STRING
            required: false,
          },
        ],
      },
    ];

    const clientId = Deno.env.get('DISCORD_CLIENT_ID');
    if (!clientId) {
      console.error('❌ DISCORD_CLIENT_ID no configurado');
      return;
    }

    console.log(`Registrando ${commands.length} comandos...`);
    const data = await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    ) as any[];

    console.log(`✅ ${data.length} comandos registrados exitosamente:`);
    data.forEach((cmd: any) => {
      console.log(`   - /${cmd.name}`);
    });
  } catch (error: any) {
    console.error('❌ Error registrando comandos:', error.message);
    if (error.rawError) {
      console.error('Detalles:', JSON.stringify(error.rawError, null, 2));
    }
  }
});

// Endpoint de salud para cron-job.org
app.get('/', (req: any, res: any) => {
  res.json({ 
    status: 'ok', 
    bot: client.user ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Endpoint para verificar comandos registrados
app.get('/commands', async (req: any, res: any) => {
  try {
    const clientId = Deno.env.get('DISCORD_CLIENT_ID');
    if (!clientId) {
      return res.status(500).json({ error: 'DISCORD_CLIENT_ID no configurado' });
    }

    const commands = await rest.get(
      Routes.applicationCommands(clientId)
    ) as any[];

    res.json({ 
      success: true, 
      count: commands.length,
      commands: commands.map((cmd: any) => ({
        name: cmd.name,
        description: cmd.description,
        options: cmd.options?.length || 0
      }))
    });
  } catch (error: any) {
    console.error('Error obteniendo comandos:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
});

// Endpoint para forzar el registro de comandos (GET y POST)
app.get('/register-commands', async (req: any, res: any) => {
  try {
    const clientId = Deno.env.get('DISCORD_CLIENT_ID');
    if (!clientId) {
      return res.status(500).json({ error: 'DISCORD_CLIENT_ID no configurado' });
    }

    const commands = [
      {
        name: 'ai',
        description: 'Comandos de IA',
        options: [
          {
            name: 'rol_create',
            description: 'Crea un mensaje con sistema de roles por reacciones',
            type: 1, // SUB_COMMAND
          },
        ],
      },
      {
        name: 'wsp',
        description: 'Envía un mensaje de WhatsApp automáticamente (requiere WhatsApp inicializado)',
        options: [
          {
            name: 'numero_contacto',
            description: 'Número del contacto (ej: +5491111111111 o 5491111111111)',
            type: 3, // STRING
            required: true,
          },
          {
            name: 'mensaje',
            description: 'Mensaje a enviar',
            type: 3, // STRING
            required: true,
          },
        ],
      },
      {
        name: 'wsp_init',
        description: 'Inicializa la conexión de WhatsApp (muestra QR para escanear)',
      },
      {
        name: 'email',
        description: 'Envía un email',
        options: [
          {
            name: 'mail_propio',
            description: 'Tu dirección de email',
            type: 3, // STRING
            required: true,
          },
          {
            name: 'mail_contacto',
            description: 'Email del destinatario',
            type: 3, // STRING
            required: true,
          },
          {
            name: 'asunto',
            description: 'Asunto del email',
            type: 3, // STRING
            required: true,
          },
          {
            name: 'mensaje',
            description: 'Mensaje del email',
            type: 3, // STRING
            required: true,
          },
          {
            name: 'smtp_password',
            description: 'Contraseña SMTP (opcional, usa SMTP_PASSWORD de variables de entorno si no se proporciona)',
            type: 3, // STRING
            required: false,
          },
        ],
      },
    ];

    console.log('🔄 Forzando registro de comandos...');
    const data = await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    ) as any[];

    console.log(`✅ ${data.length} comandos re-registrados exitosamente`);
    const response = {
      success: true,
      message: `${data.length} comandos re-registrados exitosamente`,
      commands: data.map((cmd: any) => ({
        name: cmd.name,
        description: cmd.description,
        id: cmd.id
      })),
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error: any) {
    console.error('❌ Error registrando comandos:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.rawError || null
    });
  }
});

// Endpoint para forzar el registro de comandos (POST)
app.post('/register-commands', async (req: any, res: any) => {
  try {
    const clientId = Deno.env.get('DISCORD_CLIENT_ID');
    if (!clientId) {
      return res.status(500).json({ error: 'DISCORD_CLIENT_ID no configurado' });
    }

    const commands = [
      {
        name: 'ai',
        description: 'Comandos de IA',
        options: [
          {
            name: 'rol_create',
            description: 'Crea un mensaje con sistema de roles por reacciones',
            type: 1, // SUB_COMMAND
          },
        ],
      },
      {
        name: 'wsp',
        description: 'Envía un mensaje de WhatsApp automáticamente (requiere WhatsApp inicializado)',
        options: [
          {
            name: 'numero_contacto',
            description: 'Número del contacto (ej: +5491111111111 o 5491111111111)',
            type: 3, // STRING
            required: true,
          },
          {
            name: 'mensaje',
            description: 'Mensaje a enviar',
            type: 3, // STRING
            required: true,
          },
        ],
      },
      {
        name: 'wsp_init',
        description: 'Inicializa la conexión de WhatsApp (muestra QR para escanear)',
      },
      {
        name: 'email',
        description: 'Envía un email',
        options: [
          {
            name: 'mail_propio',
            description: 'Tu dirección de email',
            type: 3, // STRING
            required: true,
          },
          {
            name: 'mail_contacto',
            description: 'Email del destinatario',
            type: 3, // STRING
            required: true,
          },
          {
            name: 'asunto',
            description: 'Asunto del email',
            type: 3, // STRING
            required: true,
          },
          {
            name: 'mensaje',
            description: 'Mensaje del email',
            type: 3, // STRING
            required: true,
          },
          {
            name: 'smtp_password',
            description: 'Contraseña SMTP (opcional, usa SMTP_PASSWORD de variables de entorno si no se proporciona)',
            type: 3, // STRING
            required: false,
          },
        ],
      },
    ];

    console.log('🔄 Forzando registro de comandos (POST)...');
    const data = await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    ) as any[];

    console.log(`✅ ${data.length} comandos re-registrados exitosamente`);
    res.json({ 
      success: true, 
      message: `${data.length} comandos re-registrados exitosamente`,
      commands: data.map((cmd: any) => ({
        name: cmd.name,
        description: cmd.description,
        id: cmd.id
      })),
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error registrando comandos:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.rawError || null
    });
  }
});

// Iniciar servidor
app.listen(parseInt(PORT), () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});

// Conectar bot
client.login(Deno.env.get('DISCORD_TOKEN'));

