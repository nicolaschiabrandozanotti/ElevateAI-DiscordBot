import express from 'express';
import { Client, GatewayIntentBits, REST, Routes, EmbedBuilder } from 'discord.js';
import nacl from 'tweetnacl';

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
    ];

    await rest.put(
      Routes.applicationCommands(Deno.env.get('DISCORD_CLIENT_ID') || ''),
      { body: commands }
    );

    console.log('Comandos registrados exitosamente');
  } catch (error) {
    console.error('Error registrando comandos:', error);
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

// Iniciar servidor
app.listen(parseInt(PORT), () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});

// Conectar bot
client.login(Deno.env.get('DISCORD_TOKEN'));

