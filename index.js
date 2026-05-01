const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
  EmbedBuilder
} = require("discord.js");

const fs = require("fs");
const express = require("express");

// =====================
// KEEP ALIVE
// =====================
const app = express();
app.get("/", (req, res) => res.send("Bot is alive"));
app.listen(process.env.PORT || 3000, () => {
  console.log("Web server running");
});

// =====================
// BOT
// =====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// =====================
// DATA
// =====================
let dutyStart = {};
let totalTime = {};

if (fs.existsSync("./data.json")) {
  const data = JSON.parse(fs.readFileSync("./data.json", "utf8"));
  dutyStart = data.dutyStart || {};
  totalTime = data.totalTime || {};
}

function save() {
  fs.writeFileSync("./data.json", JSON.stringify({ dutyStart, totalTime }, null, 2));
}

// =====================
// CONFIG
// =====================
const STAFF_ROLE_NAME = "Tulaj";

const JUMPSCARE_IMAGE =
  "https://cdn.discordapp.com/attachments/1489342270644686911/1499492866756444370/image.gif";

// =====================
// CHANNEL
// =====================
function getDutyChannel(guild) {
  return guild.channels.cache.find(c => c.name === "duty-2");
}

// =====================
// FORMAT
// =====================
function format(ms) {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hour = Math.floor(min / 60);
  return `${hour}h ${min % 60}m ${sec % 60}s`;
}

// =====================
// PERMISSION
// =====================
function hasPerm(member) {
  if (!member) return false;
  if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
  return member.roles.cache.some(r => r.name === STAFF_ROLE_NAME);
}

// =====================
// READY
// =====================
client.once("clientReady", () => {
  console.log("BOT ONLINE:", client.user.tag);
});

// =====================
// COMMANDS
// =====================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // !ibi
  if (message.content === "!ibi") {
    await message.channel.send("...");

    setTimeout(() => {
      const embed = new EmbedBuilder()
        .setTitle("😱 JUMPSCARE!")
        .setImage(JUMPSCARE_IMAGE)
        .setColor("Red");

      message.channel.send({ embeds: [embed] });
    }, 1500);

    return;
  }

  // !duty
  if (message.content === "!duty") {
    if (!hasPerm(message.member)) return;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("duty_on").setLabel("🟢 Duty ON").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("duty_off").setLabel("🔴 Duty OFF").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("duty_all").setLabel("📊 Összes idő").setStyle(ButtonStyle.Primary)
    );

    message.channel.send({
      content: "🛠 Duty rendszer",
      components: [row]
    });

    return;
  }

  // !clear
  if (message.content === "!clear") {
    if (!hasPerm(message.member)) return;

    const messages = await message.channel.messages.fetch({ limit: 100 });
    await message.channel.bulkDelete(messages, true);

    const dutyChannel = getDutyChannel(message.guild);
    if (dutyChannel) dutyChannel.send("🧹 chat törölve");

    return;
  }

  // !delete
  if (message.content.startsWith("!delete")) {
    if (!hasPerm(message.member)) return;

    const amount = parseInt(message.content.replace("!delete", ""));
    if (isNaN(amount)) return;

    const msgs = await message.channel.messages.fetch({ limit: 100 });

    let deleted = 0;

    for (const msg of msgs.values()) {
      if (msg.id === message.id) continue;

      try {
        await msg.delete();
        deleted++;
        if (deleted >= amount) break;
      } catch {}
    }

    message.channel.send(`🧹 törölve: ${deleted}`);
    return;
  }

  // !osszido
  if (message.content.startsWith("!osszido")) {
    if (!hasPerm(message.member)) return;

    const user = message.mentions.users.first();
    if (!user) return;

    const time = totalTime[user.id] || 0;

    const dutyChannel = getDutyChannel(message.guild);
    if (dutyChannel) {
      dutyChannel.send(`📊 ${user.username} összes ideje: ${format(time)}`);
    }

    return;
  }

  // =====================
  // 🟢 NEW: !idotorles @user
  // =====================
  if (message.content.startsWith("!idotorles")) {
    if (!hasPerm(message.member)) return;

    const user = message.mentions.users.first();
    if (!user) return message.channel.send("❌ Jelölj meg egy usert!");

    delete totalTime[user.id];
    delete dutyStart[user.id];

    save();

    const dutyChannel = getDutyChannel(message.guild);
    if (dutyChannel) {
      dutyChannel.send(`🗑 ${user.username} összes ideje törölve`);
    }

    message.channel.send("✔ Idő törölve");
    return;
  }

  // =====================
  // 🔴 NEW: !dutyoff @user
  // =====================
  if (message.content.startsWith("!dutyoff")) {
    if (!hasPerm(message.member)) return;

    const user = message.mentions.users.first();
    if (!user) return message.channel.send("❌ Jelölj meg egy usert!");

    if (!dutyStart[user.id]) {
      return message.channel.send("❌ Az adott user nincs dutyban!");
    }

    const diff = Date.now() - dutyStart[user.id];
    delete dutyStart[user.id];

    totalTime[user.id] = (totalTime[user.id] || 0) + diff;
    save();

    const dutyChannel = getDutyChannel(message.guild);
    if (dutyChannel) {
      dutyChannel.send(`🔴 ${user.username} duty leállítva | ${format(diff)}`);
    }

    message.channel.send("✔ Duty OFF kész");
    return;
  }
});

// =====================
// BUTTONS
// =====================
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  const id = interaction.user.id;
  const name = interaction.user.username;

  const dutyChannel = getDutyChannel(interaction.guild);

  if (interaction.customId === "duty_on") {
    if (dutyStart[id]) {
      return interaction.reply({ content: "❌ már dutyban vagy!", ephemeral: true });
    }

    dutyStart[id] = Date.now();
    save();

    if (dutyChannel) dutyChannel.send(`🟢 ${name} belépett szolgálatba`);

    return interaction.reply({ content: "Duty ON", ephemeral: true });
  }

  if (interaction.customId === "duty_off") {
    if (!dutyStart[id]) {
      return interaction.reply({ content: "❌ nem vagy dutyban!", ephemeral: true });
    }

    const diff = Date.now() - dutyStart[id];
    delete dutyStart[id];

    totalTime[id] = (totalTime[id] || 0) + diff;
    save();

    if (dutyChannel) dutyChannel.send(`🔴 ${name} kilépett | ${format(diff)}`);

    return interaction.reply({ content: "Duty OFF", ephemeral: true });
  }

  if (interaction.customId === "duty_all") {
    const time = totalTime[id] || 0;

    if (dutyChannel) dutyChannel.send(`📊 ${name} összes ideje: ${format(time)}`);

    return interaction.reply({ content: "Kiírva duty-2-be", ephemeral: true });
  }
});

// =====================
client.login(process.env.TOKEN);
