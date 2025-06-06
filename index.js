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
    console.log('✅ Bot is ready!');
    console.log('Starting to fetch chats...');
    const startTime = Date.now();

    // Progress logging every 30 seconds
    const progressInterval = setInterval(() => {
        console.log(`Still fetching chats... Elapsed time: ${(Date.now() - startTime) / 1000} seconds`);
    }, 30000);

    try {
        // 5-minute timeout for getChats()
        const chats = await Promise.race([
            client.getChats(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('getChats timed out after 5 minutes')), 300000))
        ]);
        clearInterval(progressInterval);
        const endTime = Date.now();
        console.log(`✅ getChats completed in ${(endTime - startTime) / 1000} seconds`);
        console.log(`Total chats found: ${chats.length}`);

        const groups = chats.filter(chat => chat.isGroup);
        console.log(`Total groups found: ${groups.length}`);
        console.log('\n=== Available Groups ===');
        if (groups.length === 0) {
            console.log('No groups found. Ensure your WhatsApp account is in groups and has admin privileges.');
        } else {
            groups.forEach(group => {
                console.log(`Name: ${group.name}, ID: ${group.id._serialized}, Admin: ${group.isAdmin}`);
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

    const contact = await msg.getContact();
    const contactNumber = contact.id.user;
    const messageText = msg.body.toLowerCase();
    const hasBlockedKeyword = BLOCKED_KEYWORDS.some(keyword => messageText.includes(keyword));

    if (!isIsraeliPhoneNumber(contactNumber) && !WHITELIST.includes(contactNumber)) {
        console.log(`🚨 Non-Israeli number detected: ${contactNumber}`);
        let messageIds = [];
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

        try {
            await chat.removeParticipants([contact.id._serialized]);
            console.log(`🚫 Removed non-Israeli number: ${contactNumber}`);
        } catch (error) {
            console.error(`❌ Failed to remove user: ${error.message}`);
        }
        return;
    }

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

// Prevent multiple initializations
let isInitialized = false;
client.on('authenticated', () => {
    console.log('Authenticated successfully');
});
if (!isInitialized) {
    isInitialized = true;
    client.initialize().catch(err => console.error(`❌ Initialization failed: ${err.message}`));
}