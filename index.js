const fs = require('fs');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');

// Load config
const config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
const WHITELIST = config.whitelist;
const BLOCKED_KEYWORDS = config.blockedKeywords.map(k => k.toLowerCase());
const ALLOWED_GROUPS = config.allowedGroups;

// Helper to check if a phone number is Israeli
function isIsraeliPhoneNumber(phoneNumber) {
    phoneNumber = phoneNumber.replace(/[-\s]/g, '');
    const israelRegex = /^(?:\+972|972|0)(5[0-9])\d{7}$/;
    const result = israelRegex.test(phoneNumber);
    return result;
}

// Helper to safely remove a participant if they're in the group
async function safeRemoveParticipant(chat, participantId, label = '') {
    try {
        // Ensure participants is an array
        if (!Array.isArray(chat.participants)) {
            console.error(`❌ Participants array is invalid for chat ${chat.id._serialized}`);
            return;
        }

        // Check if bot is admin
        const botId = client.info.wid._serialized;
        const isBotAdmin = chat.participants.find(p => p.id._serialized === botId)?.isAdmin || false;
        if (!isBotAdmin) {
            console.warn(`⚠️ Cannot remove ${label} ${participantId}: Bot is not an admin`);
            chat.sendMessage('Bot is not an admin in group');
            return;
        }

        // Check if sender is admin
        const isSenderAdmin = chat.participants.find(p => p.id._serialized === participantId)?.isAdmin || false;
        if (isSenderAdmin) {
            console.log(`⚠️ Skipping removal for admin user ${label}`);
            return;
        }

        // Validate participantId format
        if (!participantId.endsWith('@c.us')) {
            console.warn(`⚠️ Invalid participant ID format: ${participantId}. Expected phoneNumber@c.us`);
            return;
        }

        // Check if participant is in the group
        console.log(`Participants in chat ${chat.id._serialized}:`, chat.participants.map(p => p.id._serialized));
        const isParticipant = chat.participants.some(p => p.id._serialized === participantId);
        console.log(`🚫 Attempting to remove user ${label}: ${participantId}`);
        if (isParticipant) {
            let attempts = 0;
            while (attempts < 2) {
                try {
                    await chat.removeParticipants([participantId]);
                    console.log(`🚫 Removed user ${label}: ${participantId}`);
                    await new Promise(resolve => setTimeout(resolve, 3000)); // 3-second delay
                    return;
                } catch (error) {
                    attempts++;
                    console.warn(`⚠️ Retry ${attempts} for removing ${label} ${participantId}`);
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    if (attempts === 2) throw error;
                }
            }
        } else {
            console.warn(`⚠️ Cannot remove ${label} ${participantId}: Not found in participants`);
        }
    } catch (error) {
        console.error(`❌ Failed to remove user ${label} ${participantId}: ${error.message}`);
    }
}

// Helper to delete messages (current and recent)
async function deleteMessages(chat, msg, contactNumber, contactId) {
    try {
        // Delete current message
        await msg.delete(true);
        console.log(`🗑️ Deleted current message from ${contactNumber}: "${msg.body}" (ID: ${msg.id._serialized})`);
        chat.sendMessage('🗑️ Deleted current message');
    } catch (deleteError) {
        console.error(`❌ Failed to delete current message ID ${msg.id._serialized}: ${deleteError.message}`);
    }

    try {
        const recentMessages = await chat.fetchMessages({ limit: 20 });
        const userMessages = recentMessages.filter(m => {
            const senderId = chat.isGroup ? m.author : m.from;
            return senderId === contactId;
        });

        for (const userMsg of userMessages) {
            try {
                await userMsg.delete(true);
                console.log(`🗑️ Deleted message from ${contactNumber}: "${userMsg.body}"`);
            } catch (deleteError) {
                console.error(`❌ Failed to delete a message: ${deleteError.message}`);
            }
        }
    } catch (error) {
        console.error(`❌ Error during message cleanup: ${error.message}`);
    }
}

// Init client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas', '--disable-gpu'],
        executablePath: require('puppeteer').executablePath()
    }
});

// QR code login
client.on('qr', qr => {
    console.log('New QR code generated');
    qrcode.generate(qr, { small: true });
});

// Ready handler with 5-minute timeout and progress logging
client.on('ready', async () => {
    if (client.isReady) {
        console.log('Ready event triggered again, skipping...');
        return;
    }
    client.isReady = true;
    console.log('✅ Bot is ready!');
    console.log(`Bot WhatsApp ID: ${client.info.wid._serialized}`);

    console.log('Starting to fetch chats...');
    const startTime = Date.now();
    const progressInterval = setInterval(() => {
        console.log(`Still fetching chats... Elapsed time: ${(Date.now() - startTime) / 1000} seconds`);
    }, 30000);

    try {
        const chats = await Promise.race([
            client.getChats(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('getChats timed out after 5 minutes')), 300000))
        ]);
        clearInterval(progressInterval);
        const endTime = Date.now();
        console.log(`✅ getChats completed in ${(endTime - startTime) / 1000} seconds`);
        console.log(`Total chats found: ${chats.length}`);

        const groups = chats.filter(chat => chat.isGroup);
        const uniqueGroups = Array.from(new Map(groups.map(g => [g.id._serialized, g])).values());
        console.log(`Total groups found: ${uniqueGroups.length}`);
        console.log('\n=== Available Groups ===');
        if (uniqueGroups.length === 0) {
            console.log('No groups found. Ensure your WhatsApp account is in groups and has admin privileges.');
        } else {
            uniqueGroups.forEach(group => {
                const admins = group.participants?.filter(p => p.isAdmin).map(p => p.id.user) || [];
                console.log(`\nName: ${group.name}, ID: ${group.id._serialized}`);
                console.log(`Admins: ${admins.length > 0 ? admins.join(', ') : 'None'}`);
            });
        }
    } catch (error) {
        clearInterval(progressInterval);
        console.error(`❌ Error fetching chats: ${error.message}`);
        console.error(`Stack trace: ${error.stack}`);
    }
});

// Message handler
client.on('message', async msg => {
    const chat = await msg.getChat();
    if (!chat.isGroup || !ALLOWED_GROUPS.includes(chat.id._serialized)) {
        console.log(`Ignoring message from non-allowed group: ${chat.id._serialized}`);
        return;
    }

    const botId = client.info.wid._serialized;
    const botParticipant = chat.participants.find(p => p.id._serialized === botId);
    if (!botParticipant || !botParticipant.isAdmin) {
        console.log(`Bot is not an admin in group ${chat.id._serialized}. Cannot remove participants.`);
        chat.sendMessage('Bot is not an admin in group');
        return;
    }

    const contact = await msg.getContact();
    const contactNumber = contact.id.user;
    const messageText = msg.body.toLowerCase();
    const hasBlockedKeyword = BLOCKED_KEYWORDS.some(keyword => messageText.includes(keyword));

    // Check if sender is an admin
    const senderId = contact.id._serialized;
    const isSenderAdmin = chat.participants?.find(p => p.id._serialized === senderId)?.isAdmin || false;
    if (isSenderAdmin) {
        console.log(`⚠️ Skipping deletion for admin user ${contactNumber}`);
        return;
    }

    // Case 1: Non-Israeli number & not whitelisted
    if (!isIsraeliPhoneNumber(contactNumber) && !WHITELIST.includes(contactNumber)) {
        console.log(`🚨 Non-Israeli number detected: ${contactNumber}`);
        chat.sendMessage('🚨 Non-Israeli number detected');
        if (hasBlockedKeyword) {
            console.log(`⚠️ Blocked keyword detected in (case 1): "${msg.body}"`);
            chat.sendMessage('⚠️ Blocked keyword detected');
            await deleteMessages(chat, msg, contactNumber, contact.id._serialized);
        }
        await safeRemoveParticipant(chat, contact.id._serialized, contactNumber);
        return;
    }

    // Case 2: Israeli or whitelisted but used blocked keyword
    if (hasBlockedKeyword) {
        console.log(`⚠️ Blocked keyword detected in (case 2): "${msg.body}"`);
        chat.sendMessage('⚠️ Blocked keyword detected');
        await deleteMessages(chat, msg, contactNumber, contact.id._serialized);
        await safeRemoveParticipant(chat, contact.id._serialized, contactNumber);
        return;
    }

    console.log(`✅ Message is clean: "${msg.body}"`);
});

// Prevent multiple initializations
let isInitialized = false;
client.on('authenticated', () => {
    console.log('Authenticated successfully');
});
if (!isInitialized) {
    isInitialized = true;
    client.initialize().catch(err => console.error(`❌ Initialization failed: ${err.message}`));
}