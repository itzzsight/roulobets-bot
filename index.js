require('dotenv').config();

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const API_URL = 'https://api.roulobets.com/v1/external/affiliates';

let leaderboardMessage = null;

// =====================
// SAFETY CONTROLS
// =====================
let started = false;
let lastUpdate = 0;
const COOLDOWN = 15 * 60 * 1000; // 15 minutes

// =====================
// DATE (TODAY)
// =====================
function getToday() {
  return new Date().toISOString().split('T')[0];
}

// =====================
// FETCH API
// =====================
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

// =====================
// BUILD EMBED
// =====================
function buildEmbed(list) {
  const embed = new EmbedBuilder()
    .setTitle('🏆 Wager Leaderboard')
    .setColor(0xFFD700)
    .setFooter({ text: 'Auto-updates every 15 minutes' })
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

// =====================
// UPDATE LEADERBOARD
// =====================
async function updateLeaderboard() {
  try {
    const now = Date.now();

    // 🔒 HARD RATE LIMIT PROTECTION
    if (now - lastUpdate < COOLDOWN) {
      console.log("Skipped update (cooldown active)");
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

// =====================
// BOT READY
// =====================
client.once('ready', async () => {
  if (started) return;
  started = true;

  console.log(`Logged in as ${client.user.tag}`);

  const channel = await client.channels.fetch(process.env.LEADERBOARD_CHANNEL_ID);

  // Send ONE message only
  leaderboardMessage = await channel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("🏆 Wager Leaderboard")
        .setDescription("Loading leaderboard...")
        .setColor(0xFFD700)
    ]
  });

  // Wait before first API call (prevents 429 on startup)
  setTimeout(updateLeaderboard, 5000);

  // Normal interval (15 min)
  setInterval(updateLeaderboard, COOLDOWN);
});

// =====================
// LOGIN
// =====================
client.login(process.env.DISCORD_TOKEN);

// =====================
// CRASH SAFETY
// =====================
process.on('unhandledRejection', err => {
  console.error('Unhandled Rejection:', err.message);
});

process.on('uncaughtException', err => {
  console.error('Uncaught Exception:', err.message);
});
