require('dotenv').config();

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const API_URL = 'https://api.roulobets.com/v1/external/affiliates';

let leaderboardMessage = null;

// Get today's date
function getToday() {
  return new Date().toISOString().split('T')[0];
}

// Fetch API
async function fetchLeaderboard() {
  const today = getToday();

  const res = await axios.get(API_URL, {
    params: {
      start_at: today,
      end_at: today,
      key: process.env.ROULOBETS_API_KEY,
    },
  });

  return res.data?.data || res.data || [];
}

// Build embed
function buildEmbed(list) {
  const embed = new EmbedBuilder()
    .setTitle('🏆 Wager Leaderboard')
    .setColor(0x00ff99)
    .setTimestamp();

  if (!list.length) {
    embed.setDescription("No data available.");
    return embed;
  }

  const sorted = list.sort((a, b) => (b.wagered || 0) - (a.wagered || 0));

  let desc = '';

  sorted.slice(0, 10).forEach((u, i) => {
    const medal =
      i === 0 ? "🥇" :
      i === 1 ? "🥈" :
      i === 2 ? "🥉" : `**${i + 1}.**`;

    desc += `${medal} **${u.username || 'Unknown'}** — $${Number(u.wagered || 0).toLocaleString()}\n`;
  });

  embed.setDescription(desc);

  return embed;
}

// Update leaderboard
async function updateLeaderboard() {
  try {
    const data = await fetchLeaderboard();

    const embed = buildEmbed(data);

    if (leaderboardMessage) {
      await leaderboardMessage.edit({ embeds: [embed] });
    }

    console.log("Leaderboard updated");

  } catch (err) {
    console.error("Update error:", err.message);
  }
}

// Ready event
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const channel = await client.channels.fetch(process.env.LEADERBOARD_CHANNEL_ID);

  leaderboardMessage = await channel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("🏆 Wager Leaderboard")
        .setDescription("Loading data...")
        .setColor(0x00ff99)
    ]
  });

  await updateLeaderboard();

  setInterval(updateLeaderboard, 15 * 60 * 1000);
});

// Login
client.login(process.env.DISCORD_TOKEN);
