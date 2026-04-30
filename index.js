const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events
} = require("discord.js");

const fs = require("fs");

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

// load data
if (fs.existsSync("./data.json")) {
  const data = JSON.parse(fs.readFileSync("./data.json", "utf8"));
  dutyStart = data.dutyStart || {};
  totalTime = data.totalTime || {};
}

// save data
function save() {
  fs.writeFileSync("./data.json", JSON.stringify({ dutyStart, totalTime }, null, 2));
}

// =====================
// CONFIG
// =====================
const STAFF_ROLE_NAME = "Tulaj";

// duty-2 channel
function getDutyChannel(guild) {
  return guild.channels.cache.find(c => c.name === "duty-2");
}

// =====================
// FORMAT TIME
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
client.once("ready", () => {
  console.log("BOT ONLINE:", client.user.tag);
});

// =====================
// COMMANDS
// =====================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // =====================
  // !duty
  // =====================
  if (message.content === "!duty") {

    if (!hasPerm(message.member)) return;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("duty_on")
        .setLabel("🟢 Duty ON")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("duty_off")
        .setLabel("🔴 Duty OFF")
        .setStyle(ButtonStyle.Danger),

      new ButtonBuilder()
        .setCustomId("duty_all")
        .setLabel("📊 Összes idő")
        .setStyle(ButtonStyle.Primary)
    );

    return message.channel.send({
      content: "🛠 Duty rendszer",
      components: [row]
    });
  }

  // =====================
  // !clear
  // =====================
  if (message.content === "!clear") {

    if (!hasPerm(message.member)) return;

    const messages = await message.channel.messages.fetch({ limit: 100 });
    await message.channel.bulkDelete(messages, true);

    const dutyChannel = getDutyChannel(message.guild);
    if (dutyChannel) dutyChannel.send("🧹 chat törölve");

    return;
  }

  // =====================
  // !delete X
  // =====================
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
  }

  // =====================
  // !osszido
  // =====================
  if (message.content.startsWith("!osszido")) {

    if (!hasPerm(message.member)) return;

    const user = message.mentions.users.first();
    if (!user) return;

    const time = totalTime[user.id] || 0;

    const dutyChannel = getDutyChannel(message.guild);
    if (dutyChannel) {
      dutyChannel.send(`📊 ${user.username} összes ideje: ${format(time)}`);
    }
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

  // =====================
  // DUTY ON
  // =====================
  if (interaction.customId === "duty_on") {

    if (dutyStart[id]) {
      return interaction.reply({ content: "❌ már dutyban vagy!", ephemeral: true });
    }

    dutyStart[id] = Date.now();
    save();

    if (dutyChannel) {
      dutyChannel.send(`🟢 ${name} belépett szolgálatba`);
    }

    return interaction.reply({ content: "Duty ON", ephemeral: true });
  }

  // =====================
  // DUTY OFF
  // =====================
  if (interaction.customId === "duty_off") {

    if (!dutyStart[id]) {
      return interaction.reply({ content: "❌ nem vagy dutyban!", ephemeral: true });
    }

    const diff = Date.now() - dutyStart[id];
    delete dutyStart[id];

    totalTime[id] = (totalTime[id] || 0) + diff;
    save();

    if (dutyChannel) {
      dutyChannel.send(`🔴 ${name} kilépett | ${format(diff)}`);
    }

    return interaction.reply({ content: "Duty OFF", ephemeral: true });
  }

  // =====================
  // ÖSSZES IDŐ
  // =====================
  if (interaction.customId === "duty_all") {

    const time = totalTime[id] || 0;

    if (dutyChannel) {
      dutyChannel.send(`📊 ${name} összes ideje: ${format(time)}`);
    }

    return interaction.reply({ content: "Kiírva duty-2-be", ephemeral: true });
  }
});

// =====================
client.login("MTQ5OTA0MTA4NjU3ODg4NDYwOA.GWlEee.n7An4p3kamIzguQvTV8ZzP10YQUCdn1sX-mX3I");
