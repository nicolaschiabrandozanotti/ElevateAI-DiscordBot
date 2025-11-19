import express from 'express';
import { Client, GatewayIntentBits, REST, Routes, EmbedBuilder } from 'discord.js';
import nacl from 'tweetnacl';
import twilio from 'twilio';
import nodemailer from 'nodemailer';

const app = express();
const PORT = Deno.env.get('PORT') || '3000';

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

// Función para enviar mensaje de WhatsApp usando Twilio
async function enviarWhatsApp(numeroPropio: string, numeroContacto: string, mensaje: string) {
  try {
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioWhatsAppNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER'); // Formato: whatsapp:+14155238886

    if (!accountSid || !authToken || !twilioWhatsAppNumber) {
      throw new Error('Configuración de Twilio incompleta. Necesitas TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN y TWILIO_WHATSAPP_NUMBER');
    }

    const client = twilio(accountSid, authToken);
    
    // Formatear número de destino con código de país (whatsapp:+5491111111111)
    const toNumber = numeroContacto.startsWith('whatsapp:') 
      ? numeroContacto 
      : (numeroContacto.startsWith('+') ? `whatsapp:${numeroContacto}` : `whatsapp:+${numeroContacto}`);

    // Incluir información del remitente en el mensaje
    const mensajeCompleto = `De: ${numeroPropio}\n\n${mensaje}`;

    const message = await client.messages.create({
      from: twilioWhatsAppNumber, // Número de Twilio configurado (requerido por Twilio)
      to: toNumber,
      body: mensajeCompleto
    });

    return { success: true, messageId: message.sid, message: 'Mensaje de WhatsApp enviado exitosamente' };
  } catch (error: any) {
    console.error('Error enviando WhatsApp:', error);
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

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // true para 465, false para otros puertos
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    });

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
    return { success: false, error: error.message };
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
      const numeroPropio = options.find((opt: any) => opt.name === 'numero_propio')?.value;
      const numeroContacto = options.find((opt: any) => opt.name === 'numero_contacto')?.value;
      const mensaje = options.find((opt: any) => opt.name === 'mensaje')?.value;

      if (!numeroPropio || !numeroContacto || !mensaje) {
        return res.json({
          type: 4,
          data: {
            content: '❌ Error: Faltan parámetros. Usa: `/wsp numero_propio:... numero_contacto:... mensaje:...`',
            flags: 64, // EPHEMERAL
          },
        });
      }

      // Responder inmediatamente (Discord requiere respuesta en 3 segundos)
      res.json({
        type: 4,
        data: {
          content: '📱 Enviando mensaje de WhatsApp...',
          flags: 64, // EPHEMERAL
        },
      });

      // Enviar el mensaje de forma asíncrona
      const resultado = await enviarWhatsApp(numeroPropio, numeroContacto, mensaje);

      // Editar la respuesta con el resultado
      try {
        const followupUrl = `https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`;
        await fetch(followupUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: resultado.success
              ? `✅ ${resultado.message}\n📱 ID: ${resultado.messageId}`
              : `❌ Error: ${resultado.error}`,
          }),
        });
      } catch (error) {
        console.error('Error actualizando mensaje:', error);
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
        description: 'Envía un mensaje de WhatsApp',
        options: [
          {
            name: 'numero_propio',
            description: 'Tu número de WhatsApp (formato: +5491111111111)',
            type: 3, // STRING
            required: true,
          },
          {
            name: 'numero_contacto',
            description: 'Número del contacto a quien enviar (formato: +5491111111111)',
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

// Endpoint para forzar el registro de comandos
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
        description: 'Envía un mensaje de WhatsApp',
        options: [
          {
            name: 'numero_propio',
            description: 'Tu número de WhatsApp (formato: +5491111111111)',
            type: 3, // STRING
            required: true,
          },
          {
            name: 'numero_contacto',
            description: 'Número del contacto a quien enviar (formato: +5491111111111)',
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

    const data = await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    ) as any[];

    res.json({ 
      success: true, 
      message: `${data.length} comandos registrados exitosamente`,
      commands: data.map((cmd: any) => cmd.name)
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

