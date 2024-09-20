const { Client, GatewayIntentBits, Collection, Events, EmbedBuilder } = require('discord.js');
require('dotenv').config();
const mongoose = require('mongoose');

// MongoDB schema for storing warnings and deleted messages
const warningSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  warnings: { type: Number, default: 0 }
});
const Warning = mongoose.model('Warning', warningSchema);

const deletedMessageSchema = new mongoose.Schema({
  messageId: String,
  channelId: String,
  authorId: String,
  content: String,
  deletedAt: { type: Date, default: Date.now }
});
const DeletedMessage = mongoose.model('DeletedMessage', deletedMessageSchema);

// Initialize client with intents and partials
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessageTyping,
  ],
  partials: ['CHANNEL']
});

client.commands = new Collection();

// Define commands
client.commands.set('ban', {
  execute: async (message, args) => {
    if (!message.member.permissions.has('ADMINISTRATOR')) return;
    const user = message.mentions.users.first();
    if (user) {
      const member = message.guild.members.resolve(user);
      if (member) {
        await member.ban();
        message.reply(`${user.tag} has been banned.`);
      } else {
        message.reply('That user is not a member of this guild.');
      }
    } else {
      message.reply('Please mention a user to ban.');
    }
  }
});
client.commands.set('mute', {
    execute: async (message, args) => {
      if (!message.member.permissions.has('ADMINISTRATOR')) return;
      const user = message.mentions.users.first();
      const durationArg = args[1] || '0'; // Default to 0 if no duration is provided
  
      if (user) {
        const member = message.guild.members.resolve(user);
        if (member) {
          // Assume a role named "Muted" exists
          const muteRole = message.guild.roles.cache.find(role => role.name === 'Muted');
          if (muteRole) {
            // Parse duration
            let durationMinutes = 0;
            const durationMatch = durationArg.match(/(\d+)([smh])?/i);
            if (durationMatch) {
              const value = parseInt(durationMatch[1]);
              const unit = (durationMatch[2] || 'm').toLowerCase();
  
              switch (unit) {
                case 'h': // hours
                  durationMinutes = value * 60;
                  break;
                case 's': // seconds
                  durationMinutes = Math.ceil(value / 60);
                  break;
                case 'm': // minutes (default)
                default:
                  durationMinutes = value;
                  break;
              }
            }
  
            // Add the mute role
            await member.roles.add(muteRole);
            message.reply(`${user.tag} has been muted for ${durationArg}.`);
  
            // Unmute after duration
            if (durationMinutes > 0) {
              setTimeout(async () => {
                await member.roles.remove(muteRole);
                message.channel.send(`${user.tag} has been unmuted.`);
              }, durationMinutes * 60000); // Convert minutes to milliseconds
            }
          } else {
            message.reply('Mute role not found.');
          }
        } else {
          message.reply('That user is not a member of this guild.');
        }
      } else {
        message.reply('Please mention a user to mute.');
      }
    }
  });
  

client.commands.set('unban', {
  execute: async (message, args) => {
    if (!message.member.permissions.has('ADMINISTRATOR')) return;
    const userId = args[0];
    if (userId) {
      await message.guild.bans.remove(userId);
      message.reply(`User with ID ${userId} has been unbanned.`);
    } else {
      message.reply('Please provide the ID of the user to unban.');
    }
  }
});

client.commands.set('warn', {
  execute: async (message, args) => {
    if (!message.member.permissions.has('ADMINISTRATOR')) return;
    const user = message.mentions.users.first();
    if (user) {
      const warning = await Warning.findOne({ userId: user.id });
      if (warning) {
        warning.warnings += 1;
        if (warning.warnings >= 5) {
          const member = message.guild.members.resolve(user);
          if (member) {
            await member.ban();
            message.reply(`${user.tag} has been banned after 5 warnings.`);
          }
        } else {
          await warning.save();
          message.reply(`${user.tag} has been warned. Total warnings: ${warning.warnings}`);
        }
      } else {
        await new Warning({ userId: user.id, warnings: 1 }).save();
        message.reply(`${user.tag} has been warned. Total warnings: 1`);
      }
    } else {
      message.reply('Please mention a user to warn.');
    }
  }
});

client.commands.set('addrole', {
  execute: async (message, args) => {
    if (!message.member.permissions.has('ADMINISTRATOR')) return;
    const roleName = args[0];
    const user = message.mentions.users.first();
    if (roleName && user) {
      const role = message.guild.roles.cache.find(role => role.name === roleName);
      if (role) {
        const member = message.guild.members.resolve(user);
        if (member) {
          await member.roles.add(role);
          message.reply(`Role ${roleName} added to ${user.tag}.`);
        } else {
          message.reply('That user is not a member of this guild.');
        }
      } else {
        message.reply('Role not found.');
      }
    } else {
      message.reply('Please provide a role name and mention a user.');
    }
  }
});

client.commands.set('dp', {
  execute: async (message, args) => {
    const user = message.mentions.users.first() || message.author;
    message.reply(user.displayAvatarURL({ format: 'png', dynamic: true, size: 2048 }));
  }
});

client.commands.set('serverdp', {
  execute: async (message, args) => {
    const guild = message.guild;
    message.reply(guild.iconURL({ format: 'png', dynamic: true, size: 2048 }));
  }
});

client.commands.set('serverinfo', {
  execute: async (message, args) => {
    try {
      const { guild } = message;
      const { name, memberCount, createdAt, ownerId } = guild;

      // Fetch the guild owner's member object
      const owner = await guild.members.fetch(ownerId);
      if (!owner || !owner.user) throw new Error('Guild owner not found or invalid.');

      const embed = new EmbedBuilder()
        .setTitle(`Server Information for ${name}`)
        .addFields(
          { name: 'Members', value: memberCount.toString(), inline: true },
          { name: 'Created On', value: createdAt.toDateString(), inline: true },
          { name: 'Owner', value: owner.user.tag, inline: true }
        )
        .setColor('#0099ff');

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error executing serverinfo command:', error);
      await message.reply('There was an error while executing this command.');
    }
  }
});

client.commands.set('stalk', {
  execute: async (message, args) => {
    if (!message.member.permissions.has('ADMINISTRATOR')) return;
    const userId = args[0];
    if (userId) {
      const messages = await DeletedMessage.find({ authorId: userId }).sort({ deletedAt: -1 }).limit(1);
      if (messages.length) {
        const embed = new EmbedBuilder()
          .setTitle('Last Deleted Message')
          .setColor('#0099ff')
          .setDescription(`Content: ${messages[0].content}`)
          .addFields(
            { name: 'Channel', value: `<#${messages[0].channelId}>`, inline: true },
            { name: 'Author', value: `<@${messages[0].authorId}>`, inline: true },
            { name: 'Deleted At', value: new Date(messages[0].deletedAt).toLocaleString(), inline: true }
          );
        message.reply({ embeds: [embed] });
      } else {
        message.reply('No messages found for this user.');
      }
    } else {
      message.reply('Please provide the ID of the user.');
    }
  }
});

client.commands.set('purge', {
  execute: async (message, args) => {
    if (!message.member.permissions.has('MANAGE_MESSAGES')) {
      return message.reply('You do not have permission to use this command.');
    }

    const amount = parseInt(args[0]);

    if (isNaN(amount) || amount <= 0 || amount > 100) {
      return message.reply('Please provide a number between 1 and 100.');
    }

    try {
      await message.channel.bulkDelete(amount + 1, true); // +1 to include the command message
      message.reply(`Successfully deleted ${amount} message(s).`).then(msg => {
        setTimeout(() => msg.delete(), 5000); // Deletes the confirmation message after 5 seconds
      });
    } catch (error) {
      console.error('Error deleting messages:', error);
      message.reply('There was an error trying to purge messages.');
    }
  }
});

client.commands.set('help', {
    execute: async (message, args) => {
      const embed = new EmbedBuilder()
        .setTitle('Help Command')
        .setDescription('List of available commands:')
        .addFields(
          { name: 'Moderation', value: '!ban, !mute, !unban, !warn, !addrole', inline: true },
          { name: 'Information', value: '!serverinfo, !dp, !serverdp, !ping', inline: true },
          { name: 'Miscellaneous', value: '!stalk', inline: true },
          { name: 'Usage', value: 'Use `!<command>` to execute a command.', inline: false }
        )
        .setColor('#0099ff');
  
      await message.reply({ embeds: [embed] });
    }
  });
  

// Handle DMs
client.on(Events.MessageCreate, async message => {
    if (message.channel.type === 'DM' && !message.author.bot) {
      const modChannelId = '1277551401324773429'; // Replace with the ID of the channel where you want to forward DMs
      const modChannel = client.channels.cache.get(modChannelId);
      if (modChannel) {
        const embed = new EmbedBuilder()
          .setTitle('New DM Received')
          .addFields(
            { name: 'User', value: message.author.tag, inline: true },
            { name: 'Content', value: message.content || 'No content', inline: true }
          )
          .setColor('#0099ff');
        modChannel.send({ embeds: [embed] });
      }
    }
  });
  
  // Handle deleted messages
  client.on(Events.MessageDelete, async message => {
    if (message.partial) return;
    await new DeletedMessage({
      messageId: message.id,
      channelId: message.channel.id,
      authorId: message.author.id,
      content: message.content
    }).save();
  });
  
  // Command handling
  client.on(Events.MessageCreate, async message => {
    if (!message.content.startsWith('!') || message.author.bot) return;
    const args = message.content.slice(1).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const command = client.commands.get(commandName);
    if (command) command.execute(message, args);
  });
  
// Bot login
client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
});

mongoose.connect(process.env.MONGO, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Error connecting to MongoDB', err));

client.login(process.env.TOKEN);
