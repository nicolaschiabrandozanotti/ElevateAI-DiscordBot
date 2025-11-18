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

// Manejar reacciones cuando se agregan
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;

  console.log(`Reacción agregada: ${reaction.emoji.name} por ${user.tag}`);

  // Fetch de la reacción si está parcial
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (error) {
      console.error('Error obteniendo reacción:', error);
      return;
    }
  }

  // SIEMPRE hacer fetch del mensaje completo para asegurar que tenemos todos los datos
  // Esto es especialmente importante después de una reconexión del bot
  let message = reaction.message;
  try {
    // Si el mensaje está parcial, hacer fetch
    if (message.partial) {
      message = await message.fetch();
      console.log('Mensaje obtenido desde API (estaba parcial)');
    } 
    // Si el mensaje no tiene embeds o parece incompleto, hacer fetch de todos modos
    else if (!message.embeds || message.embeds.length === 0 || !message.guild) {
      message = await message.fetch();
      console.log('Mensaje refrescado desde API (datos incompletos)');
    }
    // Incluso si parece completo, hacer fetch para asegurar que tenemos los datos más recientes
    // Esto previene problemas después de reconexiones
    else {
      message = await message.fetch();
      console.log('Mensaje refrescado desde API (verificación post-reconexión)');
    }
  } catch (error) {
    console.error('Error obteniendo/refrescando mensaje:', error);
    return;
  }

  if (!message.embeds || message.embeds.length === 0) {
    console.log('Mensaje sin embeds después de fetch, ignorando');
    return;
  }

  const embedTitle = message.embeds[0].title;
  console.log(`Título del embed: ${embedTitle}`);
  
  if (embedTitle !== '🎯 Sistema de Roles de Reunión') {
    console.log('Embed no es del sistema de roles, ignorando');
    return;
  }

  const guild = message.guild;
  if (!guild) {
    console.log('No hay guild, ignorando');
    return;
  }

  try {
    const member = await guild.members.fetch(user.id);
    if (!member) {
      console.log('Miembro no encontrado');
      return;
    }

    let roleName: string | null = null;

    if (reaction.emoji.name === '👔') {
      roleName = 'JEFE DE REUNION';
    } else if (reaction.emoji.name === '🙋‍♂️') {
      roleName = 'PARTICIPANTE DE REUNION';
    }

    if (!roleName) {
      console.log(`Emoji ${reaction.emoji.name} no corresponde a ningún rol`);
      return;
    }

    console.log(`Buscando rol: ${roleName}`);
    const role = guild.roles.cache.find(r => r.name === roleName);
    
    if (!role) {
      console.log(`❌ Rol "${roleName}" no encontrado en el servidor`);
      console.log(`Roles disponibles: ${guild.roles.cache.map(r => r.name).join(', ')}`);
      return;
    }

    console.log(`✅ Rol encontrado: ${role.name} (ID: ${role.id})`);
    console.log(`Intentando asignar rol a ${member.user.tag}...`);

    try {
      await member.roles.add(role);
      console.log(`✅ Rol ${roleName} asignado exitosamente a ${user.tag}`);
    } catch (error: any) {
      console.error(`❌ Error asignando rol ${roleName}:`, error.message);
      console.error('Detalles del error:', error);
    }
  } catch (error: any) {
    console.error('Error procesando reacción:', error.message);
  }
});

// Manejar reacciones cuando se quitan
client.on('messageReactionRemove', async (reaction, user) => {
  if (user.bot) return;

  // Fetch de la reacción si está parcial
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (error) {
      console.error('Error obteniendo reacción:', error);
      return;
    }
  }

  // SIEMPRE hacer fetch del mensaje completo para asegurar que tenemos todos los datos
  let message = reaction.message;
  try {
    if (message.partial) {
      message = await message.fetch();
    } else if (!message.embeds || message.embeds.length === 0 || !message.guild) {
      message = await message.fetch();
    } else {
      // Hacer fetch de todos modos para asegurar datos actualizados
      message = await message.fetch();
    }
  } catch (error) {
    console.error('Error obteniendo/refrescando mensaje:', error);
    return;
  }

  if (!message.embeds || message.embeds.length === 0) return;
  if (message.embeds[0].title !== '🎯 Sistema de Roles de Reunión') return;

  const guild = message.guild;
  if (!guild) return;

  const member = await guild.members.fetch(user.id);
  if (!member) return;

  let roleName: string | null = null;

  if (reaction.emoji.name === '👔') {
    roleName = 'JEFE DE REUNION';
  } else if (reaction.emoji.name === '🙋‍♂️') {
    roleName = 'PARTICIPANTE DE REUNION';
  }

  if (roleName) {
    const role = guild.roles.cache.find(r => r.name === roleName);
    if (role) {
      try {
        await member.roles.remove(role);
        console.log(`Rol ${roleName} removido de ${user.tag}`);
      } catch (error) {
        console.error(`Error removiendo rol ${roleName}:`, error);
      }
    }
  }
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

