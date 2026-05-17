require('dotenv').config();

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const API_URL = 'https://api.roulobets.com/v1/external/affiliates';

let leaderboardMessage = null;

// 🔒 Safety controls (prevents 429 + double runs)
let started = false;
let lastUpdate = 0;

// Get today's date
function getToday() {
  return new Date().toISOString().split('T')[0];
}

// Fetch API safely
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

// Build embed UI
function buildEmbed(list) {
  const embed = new EmbedBuilder()
    .setTitle('🏆 Wager Leaderboard')
    .setColor(0xFFD700)
    .setFooter({ text: 'Updates every 15 minutes' })
    .setTimestamp();

  if (!list.length) {
    embed.setDescription("No data available.");
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

    desc += `${medal} **${name}** → 💰 $${wager}\n`;
  });

  embed.setDescription(desc);

  return embed;
}

// 🔥 MAIN UPDATE FUNCTION (SAFE)
async function updateLeaderboard() {
  try {
    const now = Date.now();

    // 🚫 prevent spam calls (fixes 429)
    if (now - lastUpdate < 14 * 60 * 1000) {
      console.log("Skipped update (rate limit safety)");
      return;
    }

    lastUpdate = now;

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

// 🤖 BOT READY
client.once('ready', async () => {
  if (started) return;
  started = true;

  console.log(`Logged in as ${client.user.tag}`);

  const channel = await client.channels.fetch(process.env.LEADERBOARD_CHANNEL_ID);

  // Send ONLY ONE message
  leaderboardMessage = await channel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("🏆 Wager Leaderboard")
        .setDescription("Loading leaderboard...")
        .setColor(0xFFD700)
    ]
  });

  // First update
  await updateLeaderboard();

  // 🔁 15-minute loop (API safe)
  setInterval(updateLeaderboard, 15 * 60 * 1000);
});

// 🚀 LOGIN
client.login(process.env.DISCORD_TOKEN);

// 🛡️ Crash protection
process.on('unhandledRejection', err => {
  console.error('Unhandled Rejection:', err.message);
});
