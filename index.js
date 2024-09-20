const { Client, GatewayIntentBits, Partials, Collection, Events, EmbedBuilder, ActivityType } = require('discord.js');
require('dotenv').config();
const mongoose = require('mongoose');
const rankCommand = require('./rank');


// MongoDB schema for storing warnings and deleted messages
const xpSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 0 }
});
const XP = mongoose.model('XP', xpSchema);

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

//functions 
// Function to update the member count
function updateMemberCount() {
  const guild = client.guilds.cache.get('1276579258440880254'); // Replace with your server ID
  const memberCountChannel = guild.channels.cache.get('1278056113308434566'); // Replace with the channel ID
  
  if (guild && memberCountChannel) {
      memberCountChannel.setName(`Members: ${guild.memberCount}`)
          .then(updated => console.log(`Updated channel name to: ${updated.name}`))
          .catch(console.error);
  } else {
      console.error('Guild or Member Count Channel not found.');
  }
}
client.commands = new Collection();

// Define commands
client.commands.set('rank', {
  execute: async (message, args) => {
    const user = message.mentions.users.first() || message.author;
    const xpUser = await XP.findOne({ userId: user.id });
    
    if (xpUser) {
      const embed = new EmbedBuilder()
        .setTitle(`${user.tag}'s Rank 🏆`)
        .setThumbnail(user.displayAvatarURL({ format: 'png', dynamic: true, size: 2048 }))
        .addFields(
          { name: 'XP', value: `${xpUser.xp}`, inline: true },
          { name: 'Level', value: `${xpUser.level}`, inline: true }
        )
        .setColor('#0099ff');

      await message.reply({ embeds: [embed] });
    } else {
      message.reply('User has no XP recorded.');
    }
  }
});

client.commands.set('lb', {
  execute: async (message, args) => {
    const xpList = await XP.find().sort({ xp: -1 }).limit(10); // Top 10 users

    const leaderboard = xpList.map((xpUser, index) => 
      `${index + 1}. <@${xpUser.userId}> - Level: ${xpUser.level}, XP: ${xpUser.xp}`
    ).join('\n');

    const embed = new EmbedBuilder()
      .setTitle('Leaderboard')
      .setDescription(leaderboard)
      .setColor('#0099ff');

    await message.reply({ embeds: [embed] });
  }
});

client.commands.set('ping', {
  execute: async (message, args) => {
    const sent = await message.reply('Pinging...');
    const ping = sent.createdTimestamp - message.createdTimestamp;
    sent.edit(`Pong! Latency is ${ping}ms.`);
  }
});

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
    const avatarUrl = user.displayAvatarURL({ format: 'png', dynamic: true, size: 2048 }); // Full resolution

    const embed = new EmbedBuilder()
      .setTitle(`${user.tag}'s Profile Picture`)
      .setImage(avatarUrl)
      .setColor('#0099ff');

    await message.reply({ embeds: [embed] });
  }
});


client.commands.set('serverdp', {
  execute: async (message, args) => {
    const guild = message.guild;
    const serverIconUrl = guild.iconURL({ format: 'png', dynamic: true, size: 2048 }); // Full resolution

    const embed = new EmbedBuilder()
      .setTitle('Server Icon')
      .setImage(serverIconUrl)
      .setColor('#0099ff');

    await message.reply({ embeds: [embed] });
  }
});
client.commands.set('userinfo', {
  execute: async (message, args) => {
    const user = message.mentions.users.first() || message.author;
    const member = message.guild.members.resolve(user.id);
    
    if (member) {
      const embed = new EmbedBuilder()
        .setTitle(`${user.tag}'s Information`)
        .setThumbnail(user.displayAvatarURL({ format: 'png', dynamic: true, size: 2048 }))
        .addFields(
          { name: 'User ID', value: user.id, inline: true },
          { name: 'Joined Server', value: member.joinedAt.toDateString(), inline: true },
          { name: 'Roles', value: member.roles.cache.map(role => role.name).join(', '), inline: false }
        )
        .setColor('#0099ff');

      await message.reply({ embeds: [embed] });
    } else {
      message.reply('User is not a member of this server.');
    }
  }
});
// Event listener for member leaving
client.on(Events.GuildMemberRemove, member => {
  updateMemberCount();
});
client.on(Events.MessageDelete, async message => {
  if (message.partial || !message.content) return;
  
  // Define the channel ID to monitor
  const monitoredChannelId = '1276579259170951356'; // Replace with the channel ID to monitor
  if (message.channel.id !== monitoredChannelId) return;

  // Extract mentions from the deleted message
  const mentions = message.mentions.users.map(user => `<@${user.id}>`).join(', ');

  if (mentions) {
    const embed = new EmbedBuilder()
      .setTitle('👻 Ghost Ping Detected!')
      .setDescription(`${message.author.tag} deleted a message that mentioned ${mentions}.`)
      .addField('Time', new Date().toLocaleTimeString())
      .setColor('#ff0000');

    const modChannelId = '1276579259170951356'; // Replace with the ID of the channel where you want to send the ghost ping alert
    const modChannel = client.channels.cache.get(modChannelId);
    if (modChannel) {
      modChannel.send({ embeds: [embed] });
    }
  }
});
client.commands.set('mods', {
  execute: async (message, args) => {
    // Find the "mod" role
    const roleName = 'Mod'; // Change this to the exact role name
    const role = message.guild.roles.cache.find(r => r.name === roleName);

    if (!role) {
      return message.reply(`Role "${roleName}" not found.`);
    }

    // Get members with the role
    const membersWithRole = role.members.map(member => member.user.tag).join('\n');

    // Check if there are any members with the role
    if (membersWithRole.length === 0) {
      return message.reply(`No members with the role "${roleName}" found.`);
    }

    // Create and send the embed
    const embed = new EmbedBuilder()
      .setTitle(`Members with the "${roleName}" Role`)
      .setDescription(membersWithRole)
      .setColor('#0099ff');

    await message.reply({ embeds: [embed] });
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
    // Check if the member has MANAGE_MESSAGES or ADMINISTRATOR permissions
    if (!message.member.permissions.has('MANAGE_MESSAGES') && !message.member.permissions.has('ADMINISTRATOR')) {
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
});client.commands.set('help', {
  execute: async (message, args) => {
    const embed = new EmbedBuilder()
      .setTitle('📜 Help Command')
      .setDescription('Here is a list of available commands categorized for easy reference:')
      .addFields(
        { 
          name: '🛡️ Moderation Commands', 
          value: '`!ban` - Bans a user\n`!mute` - Mutes a user\n`!unban` - Unbans a user\n`!warn` - Issues a warning to a user\n`!addrole` - Adds a role to a user\n`!purge` - Deletes multiple messages', 
          inline: true 
        },
        { 
          name: 'ℹ️ Information Commands', 
          value: '`!serverinfo` - Displays server information\n`!mods` - Lists all moderators\n`!userinfo` - Displays information about a user\n`!dp` - Shows the user\'s profile picture\n`!serverdp` - Shows the server\'s profile picture\n`!ping` - Checks the bot\'s response time', 
          inline: true 
        },
        { 
          name: '🎮 Miscellaneous Commands', 
          value: '`!stalk` - Shows the last deleted message of a user\n`!rank` - Displays user rank and XP\n`!lb` - Displays the leaderboard', 
          inline: true 
        },
        { 
          name: '📝 Usage', 
          value: 'To use a command, type `!<command>` (e.g., `!ban`, `!serverinfo`). For more details on each command, you can try `!help <command>` if available.',
          inline: false 
        }
      )
      .setFooter({ text: 'Use these commands responsibly.' })
      .setColor('#0099ff')
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  }
});



// Handle message events
client.on(Events.MessageCreate, async message => {
  if (message.partial) return; // Handle partial messages
  
  // Handle DMs
  if (message.channel.type === 'DM' && !message.author.bot) {
    const modChannelId = '1277551401324773429'; // Replace with your channel ID
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

  if (message.author.bot) return;

  // Track XP
  const xpUser = await XP.findOne({ userId: message.author.id });
  let leveledUp = false;

  if (xpUser) {
    const oldLevel = xpUser.level;
    xpUser.xp += 2; // Increment XP by 2 for each message
    xpUser.level = Math.floor(xpUser.xp / 100); // Level up every 100 XP

    if (xpUser.level > oldLevel) {
      leveledUp = true;
    }

    await xpUser.save();
  } else {
    await new XP({ userId: message.author.id, xp: 2, level: 0 }).save();
  }

  // Handle deleted messages
  if (message.author && message.content) {
    await new DeletedMessage({
      messageId: message.id,
      channelId: message.channel.id,
      authorId: message.author.id,
      content: message.content
    }).save();
  }

  // Command handling
  if (message.content.startsWith('!') && !message.author.bot) {
    const args = message.content.slice(1).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const command = client.commands.get(commandName);
    if (command) {
      try {
        await command.execute(message, args);
      } catch (error) {
        console.error('Error executing command:', error);
        await message.reply('There was an error while executing this command.');
      }
    }
  }

  // Congratulatory message for leveling up
  if (leveledUp) {
    message.channel.send(`${message.author.tag} has leveled up to level ${xpUser.level}! 🎉`);
  }
});

client.on(Events.GuildMemberAdd, (member) => {
  updateMemberCount();
  const welcomeChannel = member.guild.channels.cache.get('1276604720659824773'); // Replace with your actual welcome channel ID

  if (welcomeChannel) {
    const embed = new EmbedBuilder()
      .setTitle(`Welcome to Dcode, ${member.user.username}!`)
      .setDescription(
        `Please pick your roles in <#1277290119447052339>, read the rules in <#1276775698220060763>, and drop your intro in <#1276579259170951356>.`
      )
      .setImage('https://media1.tenor.com/m/6wzqcWGfih4AAAAC/discord-welcome.gif') // Replace with your image URL
      .setColor('#0099ff') // You can use any color you like
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Welcome, ${member.user.tag}!`, iconURL: member.user.displayAvatarURL() });

    welcomeChannel.send({ embeds: [embed] });
  }
});

// Bot login
client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
  updateMemberCount();
});

mongoose.connect(process.env.MONGO, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Error connecting to MongoDB', err));

  client.on('ready',(c) =>{
    console.log(`INTENT SUCCESSFULL.`);
    client.user.setActivity({
      name: 'my DMs',
      type: ActivityType.Watching
    });
  });
client.login(process.env.TOKEN);