const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Array of target channel names
const TARGET_CHANNEL_NAMES = ['general', 'general-chat','chat', '💬general','bot-commands']; // Replace with your channel names

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    for (const guild of client.guilds.cache.values()) {
        for (const targetName of TARGET_CHANNEL_NAMES) {
            const channel = guild.channels.cache.find(ch => ch.name === targetName && ch.isTextBased());
            if (channel) {
                try {
                    const message = `
**📢 Announcement 📢**

**use (!help)** to know about commands available for using me
`;

                    await channel.send(message);
                    // Optional delay to handle rate limits
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } catch (error) {
                    console.error(`Failed to send message in ${channel.name} (ID: ${channel.id}):`, error);
                }
            } else {
                console.log(`Channel with name "${targetName}" not found in guild: ${guild.name}`);
            }
        }
    }
});

client.login(process.env.TOKEN);
