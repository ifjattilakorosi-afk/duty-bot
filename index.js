const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder
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
  return guild.channels.cache.find(c => c.name === "『⏰』duty-mérő");
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
// SLASH COMMANDS DEFINITION
// =====================
const commands = [
  new SlashCommandBuilder()
    .setName("ibi")
    .setDescription("Jumpscare küldése"),
  new SlashCommandBuilder()
    .setName("duty")
    .setDescription("Duty rendszer panelt küld"),
  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Chat üzenetek törlése"),
  new SlashCommandBuilder()
    .setName("delete")
    .setDescription("Adott számú üzenet törlése")
    .addIntegerOption(option =>
      option.setName("db")
        .setDescription("Törlendő üzenetek száma")
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName("osszido")
    .setDescription("Megnézi egy user összes duty idejét")
    .addUserOption(option =>
      option.setName("user")
        .setDescription("A felhasználó")
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName("idotorles")
    .setDescription("Törli egy user összes duty idejét")
    .addUserOption(option =>
      option.setName("user")
        .setDescription("A felhasználó")
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName("dutyoff")
    .setDescription("Kényszerítve leállítja egy user duty-ját")
    .addUserOption(option =>
      option.setName("user")
        .setDescription("A felhasználó")
        .setRequired(true))
].map(command => command.toJSON());

// =====================
// READY & REGISTRATION
// =====================
client.once(Events.ClientReady, async () => {
  console.log("BOT ONLINE:", client.user.tag);

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  try {
    console.log("Slash parancsok regisztrálása...");
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log("Sikeresen regisztrálva a Slash parancsok!");
  } catch (error) {
    console.error("Hiba a parancsok regisztrálásakor:", error);
  }
});

// =====================
// INTERACTIONS (SLASH COMMANDS & BUTTONS)
// =====================
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (!hasPerm(interaction.member)) {
      return interaction.reply({ content: "❌ Ehhez nincs jogosultságod!", ephemeral: true });
    }

    const { commandName } = interaction;

    // /ibi
    if (commandName === "ibi") {
      await interaction.reply({ content: "...", ephemeral: true });

      setTimeout(async () => {
        const embed = new EmbedBuilder()
          .setTitle("😱 JUMPSCARE!")
          .setImage(JUMPSCARE_IMAGE)
          .setColor("Red");

        await interaction.channel.send({ embeds: [embed] });
      }, 1500);
      return;
    }

    // /duty
    if (commandName === "duty") {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("duty_on").setLabel("🟢 Duty ON").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("duty_off").setLabel("🔴 Duty OFF").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("duty_all").setLabel("📊 Összes idő").setStyle(ButtonStyle.Primary)
      );

      await interaction.reply({
        content: "🛠 Duty rendszer",
        components: [row]
      });
      return;
    }

    // /clear
    if (commandName === "clear") {
      await interaction.deferReply({ ephemeral: true });
      const messages = await interaction.channel.messages.fetch({ limit: 100 });
      await interaction.channel.bulkDelete(messages, true);

      const dutyChannel = getDutyChannel(interaction.guild);
      if (dutyChannel) dutyChannel.send("🧹 chat törölve");

      await interaction.editReply("✔ Chat sikeresen törölve!");
      return;
    }

    // /delete
    if (commandName === "delete") {
      const amount = interaction.options.getInteger("db");
      await interaction.deferReply({ ephemeral: true });

      const msgs = await interaction.channel.messages.fetch({ limit: 100 });
      let deleted = 0;

      for (const msg of msgs.values()) {
        try {
          await msg.delete();
          deleted++;
          if (deleted >= amount) break;
        } catch {}
      }

      await interaction.editReply(`🧹 törölve: ${deleted} üzenet`);
      return;
    }

    // /osszido
    if (commandName === "osszido") {
      const user = interaction.options.getUser("user");
      const time = totalTime[user.id] || 0;

      const dutyChannel = getDutyChannel(interaction.guild);
      if (dutyChannel) {
        dutyChannel.send(`📊 ${user.username} összes ideje: ${format(time)}`);
      }

      await interaction.reply({ content: `✔ Kiírva a duty-mérő csatornára: ${user.username} ideje.`, ephemeral: true });
      return;
    }

    // /idotorles
    if (commandName === "idotorles") {
      const user = interaction.options.getUser("user");

      delete totalTime[user.id];
      delete dutyStart[user.id];
      save();

      const dutyChannel = getDutyChannel(interaction.guild);
      if (dutyChannel) {
        dutyChannel.send(`🗑 ${user.username} összes ideje törölve`);
      }

      await interaction.reply({ content: `✔ ${user.username} ideje törölve.`, ephemeral: true });
      return;
    }

    // /dutyoff (admin kényszerített)
    if (commandName === "dutyoff") {
      const user = interaction.options.getUser("user");

      if (!dutyStart[user.id]) {
        return interaction.reply({ content: "❌ Az adott user nincs dutyban!", ephemeral: true });
      }

      const diff = Date.now() - dutyStart[user.id];
      delete dutyStart[user.id];

      totalTime[user.id] = (totalTime[user.id] || 0) + diff;
      save();

      const dutyChannel = getDutyChannel(interaction.guild);
      if (dutyChannel) {
        dutyChannel.send(`🔴 ${user.username} duty leállítva | ${format(diff)}`);
      }

      await interaction.reply({ content: `✔ ${user.username} duty-ja leállítva.`, ephemeral: true });
      return;
    }
  }

  // =====================
  // BUTTONS
  // =====================
  if (interaction.isButton()) {
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
      return interaction.reply({ content: "Kiírva 『⏰』duty-mérő-be", ephemeral: true });
    }
  }
});

// =====================
process.on("unhandledRejection", error => {
  console.error("Váratlan hiba a háttérben:", error);
});

if (!process.env.TOKEN) {
  console.error("❌ HIBA: Nincs Discord token megadva!");
} else {
  client.login(process.env.TOKEN).catch(err => {
    console.error("❌ HIBA A DISCORD BEJELENTKEZÉS SORÁN:", err.message);
  });
}
