require('dotenv').config();

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const API_URL = 'https://api.roulobets.com/v1/external/affiliates';

let leaderboardMessage = null;

// Get today's date (YYYY-MM-DD)
function getToday() {
  return new Date().toISOString().split('T')[0];
}

// Fetch API data
async function fetchLeaderboard() {
  const today = getToday();

  const res = await axios.get(API_URL, {
    params: {
      start_at: today,
      end_at: today,
      key: process.env.ROULOBETS_API_KEY,
    },
  });

  return res.data?.data || [];
}

// Build CLEAN leaderboard embed
function buildEmbed(list) {
  const embed = new EmbedBuilder()
    .setTitle('🏆 Wager Leaderboard')
    .setColor(0xFFD700)
    .setThumbnail('https://i.imgur.com/8Km9tLL.png') // optional icon
    .setFooter({ text: 'Updates every 15 minutes' })
    .setTimestamp();

  if (!list.length) {
    embed.setDescription("No leaderboard data available yet.");
    return embed;
  }

  const sorted = list
    .sort((a, b) => (b.wagered || 0) - (a.wagered || 0))
    .slice(0, 10);

  let desc = "";

  sorted.forEach((u, i) => {
    const name = u.username || "Unknown";
    const wager = Number(u.wagered || 0).toLocaleString();

    const medal =
      i === 0 ? "🥇" :
      i === 1 ? "🥈" :
      i === 2 ? "🥉" : `**${i + 1}.**`;

    desc += `${medal} **${name}** → 💰 **$${wager}**\n`;
  });

  embed.setDescription(desc);

  return embed;
}

// Update leaderboard (EDIT SAME MESSAGE)
async function updateLeaderboard() {
  try {
    const data = await fetchLeaderboard();
    const embed = buildEmbed(data);

    if (leaderboardMessage) {
      await leaderboardMessage.edit({ embeds: [embed] });
    }

    console.log("Leaderboard updated ✔");

  } catch (err) {
    console.error("Update error:", err.message);
  }
}

// Bot ready
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const channel = await client.channels.fetch(process.env.LEADERBOARD_CHANNEL_ID);

  // Send ONLY ONCE
  leaderboardMessage = await channel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("🏆 Wager Leaderboard")
        .setDescription("Loading leaderboard...")
        .setColor(0xFFD700)
    ]
  });

  // First update immediately
  await updateLeaderboard();

  // 🔥 15 minute updates (API safe)
  setInterval(updateLeaderboard, 15 * 60 * 1000);
});

// Login
client.login(process.env.DISCORD_TOKEN);
