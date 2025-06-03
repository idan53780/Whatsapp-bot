const fs = require('fs');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');

// Load config
const config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
const WHITELIST = config.whitelist;
const BLOCKED_KEYWORDS = config.blockedKeywords.map(k => k.toLowerCase());
const ALLOWED_GROUPS = config.allowedGroups;

// Israeli phone number checker
function isIsraeliPhoneNumber(phoneNumber) {
    const israelRegex = /^(?:\+972|972|05\d{1})\d{7}$/;
    return israelRegex.test(phoneNumber);
}

// Init client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox']
    }
});

// QR code login
client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

// Ready handler
client.on('ready', async () => {
    console.log('✅ Bot is ready!');

    const chats = await client.getChats();
    const groups = chats.filter(chat => chat.isGroup);
    console.log('\n=== Available Groups ===');
    groups.forEach(group => {
        console.log(`${group.name}: ${group.id._serialized}`);
    });
});

// Message handler
client.on('message', async msg => {
    const chat = await msg.getChat();
    if (!chat.isGroup || !ALLOWED_GROUPS.includes(chat.id._serialized)) {
        console.log(`Ignoring message from non-allowed group: ${chat.id._serialized}`);
        return;
    }

    const contact = await msg.getContact();
    const contactNumber = contact.id.user;
    const messageText = msg.body.toLowerCase();
    const hasBlockedKeyword = BLOCKED_KEYWORDS.some(keyword => messageText.includes(keyword));

    // Check for non-Israeli number or non-whitelisted
    if (!isIsraeliPhoneNumber(contactNumber) && !WHITELIST.includes(contactNumber)) {
        console.log(`🚨 Non-Israeli number detected: ${contactNumber}`);
        let messageIds = [];

        // Pre-fetch messages for deletion if keyword is blocked
        if (hasBlockedKeyword) {
            console.log(`⚠️ Blocked keyword detected in: "${msg.body}"`);
            try {
                const recentMessages = await chat.fetchMessages({ limit: 20 });
                messageIds = recentMessages
                    .filter(m => {
                        const senderId = m.author || m.id.participant || m.from;
                        return senderId === contact.id._serialized;
                    })
                    .map(m => m.id._serialized);
                console.log(`🗃️ Stored ${messageIds.length} message IDs for deletion`);
            } catch (error) {
                console.error(`❌ Failed to fetch messages: ${error.message}`);
            }
        }

        // Delete messages first
        if (hasBlockedKeyword && messageIds.length > 0) {
            for (const msgId of messageIds) {
                try {
                    await client.deleteMessage(chat.id._serialized, msgId, true);
                    console.log(`🗑️ Deleted message from ${contactNumber}: ID ${msgId}`);
                } catch (deleteError) {
                    console.error(`❌ Failed to delete message ${msgId}: ${deleteError.message}`);
                }
            }
        }

        // Then remove user
        try {
            await chat.removeParticipants([contact.id._serialized]);
            console.log(`🚫 Removed non-Israeli number: ${contactNumber}`);
        } catch (error) {
            console.error(`❌ Failed to remove user: ${error.message}`);
        }
        return;
    }

    // For Israeli or whitelisted numbers, check for blocked keywords
    if (hasBlockedKeyword) {
        console.log(`⚠️ Blocked keyword detected in: "${msg.body}"`);
        try {
            const recentMessages = await chat.fetchMessages({ limit: 20 });
            const userMessages = recentMessages.filter(m => {
                const senderId = m.author || m.id.participant || m.from;
                return senderId === contact.id._serialized;
            });

            for (const userMsg of userMessages) {
                try {
                    await userMsg.delete(true);
                    console.log(`🗑️ Deleted message from ${contactNumber}: "${userMsg.body}"`);
                } catch (deleteError) {
                    console.error(`❌ Failed to delete a message: ${deleteError.message}`);
                }
            }

            await chat.removeParticipants([contact.id._serialized]);
            console.log(`🚫 Removed user after spam: ${contactNumber}`);
        } catch (error) {
            console.error(`❌ Error during message cleanup and removal: ${error.message}`);
        }
    } else {
        console.log(`✅ Message is clean: "${msg.body}"`);
    }
});

client.initialize();
