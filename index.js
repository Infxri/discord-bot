const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;



const { Client, GatewayIntentBits } = require("discord.js");
const ytdl = require("ytdl-core");
const ytSearch = require("yt-search");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require("@discordjs/voice");
const fs = require("fs");
require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const prefix = "!";
let users = {};
let balances = {};
let queue = [];
let connection, player;

// ---------------------- MUSIC COMMANDS ----------------------

async function playMusic(message, query) {
  const vc = message.member?.voice?.channel;
  if (!vc) return message.reply("🎧 Join a voice channel first!");

  const search = await ytSearch(query);
  const song = search.videos.length ? search.videos[0] : null;
  if (!song) return message.reply("❌ No results found.");

  queue.push(song.url);
  message.channel.send(`🎶 Added **${song.title}** to queue`);

  if (!connection) {
    connection = joinVoiceChannel({
      channelId: vc.id,
      guildId: vc.guild.id,
      adapterCreator: vc.guild.voiceAdapterCreator
    });
    player = createAudioPlayer();
    connection.subscribe(player);
    playNext(message);
  }
}

function playNext(message) {
  if (queue.length === 0) {
    message.channel.send("✅ Queue finished.");
    return;
  }

  const next = queue.shift();
  const stream = ytdl(next, { filter: "audioonly", highWaterMark: 1 << 25 });
  const resource = createAudioResource(stream);
  player.play(resource);
  player.on(AudioPlayerStatus.Idle, () => playNext(message));
}

// ---------------------- RPG SYSTEM ----------------------

function initUser(id) {
  if (!users[id]) users[id] = { level: 1, exp: 0, hp: 100, atk: 10 };
  if (!balances[id]) balances[id] = 100;
}

function battle(message, user, monster) {
  let log = `⚔️ ${message.author.username} vs ${monster.name}\n`;
  while (user.hp > 0 && monster.hp > 0) {
    monster.hp -= user.atk;
    if (monster.hp <= 0) break;
    user.hp -= monster.atk;
  }
  if (user.hp > 0) {
    user.exp += 20;
    balances[message.author.id] += 20;
    log += "🏆 You won and earned 20 gold + 20 XP!";
  } else {
    log += "💀 You lost!";
  }
  message.channel.send(log);
}

function levelUp(user) {
  if (user.exp >= user.level * 50) {
    user.exp = 0;
    user.level++;
    user.hp += 20;
    user.atk += 5;
  }
}

// ---------------------- GAMBLING SYSTEM ----------------------

function gamble(message, amount) {
  initUser(message.author.id);
  const bet = parseInt(amount);
  if (isNaN(bet) || bet <= 0) return message.reply("❌ Invalid bet.");
  if (balances[message.author.id] < bet) return message.reply("💸 Not enough coins!");
  const win = Math.random() < 0.5;
  balances[message.author.id] += win ? bet : -bet;
  message.reply(win ? `🎉 You won ${bet} coins!` : `😢 You lost ${bet} coins.`);
}

// ---------------------- HELP COMMAND ----------------------

function helpList(message) {
  const helpText = `
🤖 **BOT COMMANDS**
🎵 Music:
!play [song] — plays music  
!skip — skips song  
!stop — stops music  

⚔️ RPG:
!fight — battle monsters  
!stats — view your stats  
!lb — leaderboard  

💰 Gambling:
!bet [amount] — gamble coins  

📋 Misc:
!help — show this list
  `;
  message.channel.send(helpText);
}

// ---------------------- MESSAGE HANDLER ----------------------

client.on("messageCreate", async (message) => {
  if (!message.content.startsWith(prefix) || message.author.bot) return;
  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  initUser(message.author.id);

  switch (cmd) {
    case "play":
      playMusic(message, args.join(" "));
      break;
    case "skip":
      if (player) player.stop();
      break;
    case "stop":
      queue = [];
      if (player) player.stop();
      if (connection) connection.destroy();
      connection = null;
      message.channel.send("🛑 Stopped music.");
      break;
    case "fight":
      const monster = { name: "Goblin", hp: 50, atk: 8 };
      battle(message, users[message.author.id], monster);
      levelUp(users[message.author.id]);
      break;
    case "stats":
      const u = users[message.author.id];
      message.channel.send(`📊 **${message.author.username}** — Lvl ${u.level}, HP ${u.hp}, ATK ${u.atk}, EXP ${u.exp}`);
      break;
    case "lb":
      const sorted = Object.entries(users).sort((a, b) => b[1].level - a[1].level);
      message.channel.send("🏆 **Leaderboard**:\n" + sorted.map(([id, u], i) => `${i + 1}. <@${id}> — Lvl ${u.level}`).join("\n"));
      break;
    case "bet":
      gamble(message, args[0]);
      break;
    case "help":
      helpList(message);
      break;
  }
});

client.once("ready", () => console.log(`✅ Logged in as ${client.user.tag}`));
client.login(process.env.DISCORD_TOKEN);
