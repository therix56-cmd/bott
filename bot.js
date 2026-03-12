const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ============================
//         CONFIG
// ============================
const config = {
  token: process.env.DISCORD_TOKEN || 'MTQ4MTQzNjM5ODExNTYyMjk2NA.G6tbgp.joMPN3DMEVPEwt1crSfdyRhiv6MFNOgZrIgmgc',
  verifiedRoleId: '1481433398529491186',  // Role given after verify
  supportRoleId:  'SUPPORT_ROLE_ID_HERE', // Role that can see tickets (e.g. Staff)
  ticketCategoryId: '1481438559142416546',                   // Optional: category ID for ticket channels
  prefix: '!',
};

// Tracks open tickets: userId → channelId
const openTickets = new Map();

// ============================
//         BOT READY
// ============================
client.once('ready', () => {
  console.log(`✅ Bot is online as ${client.user.tag}`);
});

// ============================
//       ADMIN COMMANDS
// ============================
client.on('messageCreate', async (message) => {
  if (!message.content.startsWith(config.prefix) || message.author.bot) return;

  const args = message.content.slice(config.prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // ── TICKET COMMANDS (must be inside a ticket channel) ──────────────────

  // !close → instantly deletes the ticket channel
  if (command === 'close') {
    const isTicketChannel = [...openTickets.values()].includes(message.channel.id);
    if (!isTicketChannel) return message.reply('❌ This command can only be used inside a ticket channel!');
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply('❌ You need **Manage Channels** permission to close tickets.');

    await message.channel.send('🔒 **Ticket closed.** Deleting channel...');
    for (const [userId, channelId] of openTickets.entries()) {
      if (channelId === message.channel.id) { openTickets.delete(userId); break; }
    }
    console.log(`🔒 Ticket force-closed: ${message.channel.name}`);
    await message.channel.delete().catch(console.error);
    return;
  }

  // !rename <new name> → renames the ticket channel
  if (command === 'rename') {
    const isTicketChannel = [...openTickets.values()].includes(message.channel.id);
    if (!isTicketChannel) return message.reply('❌ This command can only be used inside a ticket channel!');
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply('❌ You need **Manage Channels** permission to rename tickets.');

    const newName = args.join('-').toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!newName) return message.reply('❌ Please provide a name! Example: `!rename my-ticket`');

    await message.channel.setName(`ticket-${newName}`);
    await message.reply(`✅ Ticket renamed to **ticket-${newName}**`);
    return;
  }

  // !add <userId> → adds a user to the ticket channel
  if (command === 'add') {
    const isTicketChannel = [...openTickets.values()].includes(message.channel.id);
    if (!isTicketChannel) return message.reply('❌ This command can only be used inside a ticket channel!');
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply('❌ You need **Manage Channels** permission.');

    const userId = args[0]?.replace(/[^0-9]/g, '');
    if (!userId) return message.reply('❌ Please provide a user ID! Example: `!add 123456789012345678`');

    const member = await message.guild.members.fetch(userId).catch(() => null);
    if (!member) return message.reply('❌ User not found! Make sure the ID is correct and the user is in this server.');

    await message.channel.permissionOverwrites.edit(member.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
    });
    await message.reply(`✅ Added ${member} to the ticket!`);
    return;
  }

  // !remove <userId> → removes a user from the ticket channel
  if (command === 'remove') {
    const isTicketChannel = [...openTickets.values()].includes(message.channel.id);
    if (!isTicketChannel) return message.reply('❌ This command can only be used inside a ticket channel!');
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply('❌ You need **Manage Channels** permission.');

    const userId = args[0]?.replace(/[^0-9]/g, '');
    if (!userId) return message.reply('❌ Please provide a user ID! Example: `!remove 123456789012345678`');

    const member = await message.guild.members.fetch(userId).catch(() => null);
    if (!member) return message.reply('❌ User not found!');

    await message.channel.permissionOverwrites.edit(member.id, {
      ViewChannel: false,
      SendMessages: false,
      ReadMessageHistory: false,
    });
    await message.reply(`✅ Removed ${member} from the ticket!`);
    return;
  }

  // ── ADMIN ONLY COMMANDS BELOW ───────────────────────────────────────────
  if (!message.member?.permissions.has(PermissionFlagsBits.ManageRoles)) return;

  // !setup-verify → sends the verify panel
  if (command === 'setup-verify') {
    const embed = new EmbedBuilder()
      .setTitle('✅ Verification')
      .setDescription(
        'Welcome to the server! 👋\n\n' +
        'Click the button below to verify yourself and gain access to all channels.'
      )
      .setColor(0x57F287)
      .setFooter({ text: 'By verifying you agree to the server rules.' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('verify')
        .setLabel('✅  Verify')
        .setStyle(ButtonStyle.Success)
    );

    await message.channel.send({ embeds: [embed], components: [row] });
    await message.delete().catch(() => {});
  }

  // !setup-tickets → sends the ticket panel
  if (command === 'setup-tickets') {
    const embed = new EmbedBuilder()
      .setTitle('🎫 Support Tickets')
      .setDescription(
        'Need help? Open a ticket and our staff will assist you!\n\n' +
        '📩 Click the button below to create a **private support ticket**.'
      )
      .setColor(0x5865F2)
      .setFooter({ text: 'Please only open a ticket if you need help.' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('open_ticket')
        .setLabel('📩  Open Ticket')
        .setStyle(ButtonStyle.Primary)
    );

    await message.channel.send({ embeds: [embed], components: [row] });
    await message.delete().catch(() => {});
  }

  // !help
  if (command === 'help') {
    const embed = new EmbedBuilder()
      .setTitle('📋 Bot Commands')
      .addFields(
        { name: '\u2699\uFE0F Setup (Admin)', value: '\u200b' },
        { name: '`!setup-verify`',  value: 'Sends the verify panel in this channel' },
        { name: '`!setup-tickets`', value: 'Sends the ticket panel in this channel' },
        { name: '\uD83C\uDFAB Ticket Commands (inside ticket only)', value: '\u200b' },
        { name: '`!close`',           value: 'Instantly deletes the ticket channel' },
        { name: '`!rename <name>`',   value: 'Renames the ticket channel' },
        { name: '`!add <userID>`',    value: 'Adds a user to the ticket' },
        { name: '`!remove <userID>`', value: 'Removes a user from the ticket' },
      )
      .setColor(0x5865F2)
      .setFooter({ text: 'Ticket commands require Manage Channels permission' });
    message.reply({ embeds: [embed] });
  }
});

// ============================
//      BUTTON INTERACTIONS
// ============================
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  // ──────────────────────────
  //        VERIFY BUTTON
  // ──────────────────────────
  if (interaction.customId === 'verify') {
    await interaction.deferReply({ ephemeral: true });

    const member = interaction.member;
    const role = interaction.guild.roles.cache.get(config.verifiedRoleId);

    if (!role) {
      return interaction.editReply({
        content: `❌ Verified role not found! Please contact an admin.\n*(Role ID: \`${config.verifiedRoleId}\`)*`,
      });
    }

    if (member.roles.cache.has(role.id)) {
      return interaction.editReply({ content: '✅ You are already verified!' });
    }

    try {
      await member.roles.add(role);
      console.log(`✅ Verified: ${member.user.tag}`);
      await interaction.editReply({
        content: '🎉 **You have been verified!** You now have access to all channels. Welcome!',
      });
    } catch (err) {
      console.error('Error giving verified role:', err);
      await interaction.editReply({
        content: '❌ Failed to give you the role. Make sure the bot role is **above** the verified role in the role hierarchy!',
      });
    }
  }

  // ──────────────────────────
  //       OPEN TICKET BUTTON
  // ──────────────────────────
  if (interaction.customId === 'open_ticket') {
    await interaction.deferReply({ ephemeral: true });

    const member = interaction.member;
    const guild  = interaction.guild;

    // Check if user already has an open ticket
    if (openTickets.has(member.id)) {
      const existingChannel = guild.channels.cache.get(openTickets.get(member.id));
      if (existingChannel) {
        return interaction.editReply({
          content: `❌ You already have an open ticket! ${existingChannel}`,
        });
      } else {
        openTickets.delete(member.id); // channel was deleted manually, clean up
      }
    }

    try {
      // Build permission overwrites
      const overwrites = [
        {
          id: guild.id, // @everyone can't see
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: member.id, // ticket creator can see
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
      ];

      // Add support role if configured
      const supportRole = config.supportRoleId !== 'SUPPORT_ROLE_ID_HERE'
        ? guild.roles.cache.get(config.supportRoleId)
        : null;

      if (supportRole) {
        overwrites.push({
          id: supportRole.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageChannels,
          ],
        });
      }

      // Create ticket channel
      const channelOptions = {
        name: `ticket-${member.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        type: ChannelType.GuildText,
        permissionOverwrites: overwrites,
        topic: `Support ticket for ${member.user.tag} | User ID: ${member.id}`,
      };

      // Put in category if configured
      if (config.ticketCategoryId) {
        channelOptions.parent = config.ticketCategoryId;
      }

      const ticketChannel = await guild.channels.create(channelOptions);
      openTickets.set(member.id, ticketChannel.id);

      console.log(`🎫 Ticket opened: ${ticketChannel.name} for ${member.user.tag}`);

      // Send welcome message inside ticket
      const ticketEmbed = new EmbedBuilder()
        .setTitle('🎫 General Support')
        .setDescription(
          `Hello ${member}! 👋\n\n` +
          'A staff member will assist you shortly.\n\n' +
          '**Please describe your issue below.**\n\n' +
          '*Click 🔒 Close Ticket when your issue is resolved.*'
        )
        .setColor(0x5865F2)
        .setFooter({ text: `Ticket by ${member.user.tag}` })
        .setTimestamp();

      const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('close_ticket')
          .setLabel('🔒  Close Ticket')
          .setStyle(ButtonStyle.Danger)
      );

      await ticketChannel.send({ content: `${member} ${supportRole ? supportRole : ''}`, embeds: [ticketEmbed], components: [closeRow] });

      await interaction.editReply({
        content: `✅ Your ticket has been created! ${ticketChannel}`,
      });

    } catch (err) {
      console.error('Error creating ticket:', err);
      await interaction.editReply({
        content: '❌ Failed to create ticket. Make sure the bot has **Manage Channels** permission!',
      });
    }
  }

  // ──────────────────────────
  //      CLOSE TICKET BUTTON
  // ──────────────────────────
  if (interaction.customId === 'close_ticket') {
    // Only staff or the original ticket owner can close
    const channel = interaction.channel;

    const closingEmbed = new EmbedBuilder()
      .setTitle('🔒 Closing Ticket...')
      .setDescription('This ticket will be deleted in **5 seconds**.')
      .setColor(0xED4245);

    await interaction.reply({ embeds: [closingEmbed] });

    // Remove from open tickets map
    for (const [userId, channelId] of openTickets.entries()) {
      if (channelId === channel.id) {
        openTickets.delete(userId);
        break;
      }
    }

    console.log(`🔒 Ticket closed: ${channel.name}`);

    // Delete after 5 seconds
    setTimeout(async () => {
      await channel.delete().catch((err) => {
        console.error('Error deleting ticket channel:', err);
      });
    }, 5000);
  }
});

// ============================
//           START
// ============================

client.login(config.token);
