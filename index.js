import express from 'express';
import { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import dotenv from 'dotenv';
import nacl from 'tweetnacl';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
  ],
});

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

// Middleware para verificar la firma de Discord
app.use(express.raw({ type: 'application/json' }));

// Verificar firma de Discord (Ed25519)
function verifySignature(req, res, next) {
  const signature = req.get('X-Signature-Ed25519');
  const timestamp = req.get('X-Signature-Timestamp');
  const body = req.body;

  if (!signature || !timestamp) {
    return res.status(401).send('Falta la firma');
  }

  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey) {
    return res.status(500).send('Public key no configurada');
  }

  try {
    const isVerified = nacl.sign.detached.verify(
      Buffer.from(timestamp + body),
      Buffer.from(signature, 'hex'),
      Buffer.from(publicKey, 'hex')
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

// Endpoint para interactions
app.post('/interactions', verifySignature, async (req, res) => {
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
            embeds: [embed],
          },
        };

        res.json(response);

        // Agregar reacciones después de crear el mensaje
        // Usamos el cliente para obtener el mensaje recién creado
        setTimeout(async () => {
          try {
            const channel = await client.channels.fetch(interaction.channel_id);
            if (!channel) {
              console.error('Canal no encontrado');
              return;
            }

            // Buscar el mensaje más reciente del bot en este canal
            // que tenga el embed de roles
            const messages = await channel.messages.fetch({ limit: 10 });
            const botMessage = messages.find(
              msg => 
                msg.author.id === client.user.id && 
                msg.embeds.length > 0 &&
                msg.embeds[0].title === '🎯 Sistema de Roles de Reunión' &&
                !msg.reactions.cache.has('👔') // Solo si aún no tiene reacciones
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

  // Manejar reacciones (aunque Discord no envía reacciones directamente al endpoint)
  // Las reacciones se manejan mediante eventos del cliente
});

// Manejar reacciones cuando se agregan
client.on('messageReactionAdd', async (reaction, user) => {
  // Evitar procesar reacciones del bot
  if (user.bot) return;

  // Obtener el mensaje completo si está parcial
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (error) {
      console.error('Error obteniendo reacción:', error);
      return;
    }
  }

  // Verificar que el mensaje tenga el embed correcto
  const message = reaction.message;
  if (!message.embeds || message.embeds.length === 0) return;
  if (message.embeds[0].title !== '🎯 Sistema de Roles de Reunión') return;

  const guild = message.guild;
  if (!guild) return;

  const member = await guild.members.fetch(user.id);
  if (!member) return;

  let roleName = null;

  if (reaction.emoji.name === '👔') {
    roleName = 'JEFE DE REUNION';
  } else if (reaction.emoji.name === '🙋‍♂️') {
    roleName = 'PARTICIPANTE DE REUNION';
  }

  if (roleName) {
    const role = guild.roles.cache.find(r => r.name === roleName);
    if (role) {
      try {
        await member.roles.add(role);
        console.log(`Rol ${roleName} asignado a ${user.tag}`);
      } catch (error) {
        console.error(`Error asignando rol ${roleName}:`, error);
      }
    } else {
      console.log(`Rol ${roleName} no encontrado en el servidor`);
    }
  }
});

// Manejar reacciones cuando se quitan
client.on('messageReactionRemove', async (reaction, user) => {
  // Evitar procesar reacciones del bot
  if (user.bot) return;

  // Obtener el mensaje completo si está parcial
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (error) {
      console.error('Error obteniendo reacción:', error);
      return;
    }
  }

  // Verificar que el mensaje tenga el embed correcto
  const message = reaction.message;
  if (!message.embeds || message.embeds.length === 0) return;
  if (message.embeds[0].title !== '🎯 Sistema de Roles de Reunión') return;

  const guild = message.guild;
  if (!guild) return;

  const member = await guild.members.fetch(user.id);
  if (!member) return;

  let roleName = null;

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
  console.log(`Bot conectado como ${client.user.tag}`);

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

    // Registrar comandos globalmente
    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: commands }
    );

    console.log('Comandos registrados exitosamente');
  } catch (error) {
    console.error('Error registrando comandos:', error);
  }
});

// Endpoint de salud para cron-job.org (mantener el bot activo)
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    bot: client.user ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});

// Conectar bot
client.login(process.env.DISCORD_TOKEN);

