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
        // Always fetch latest participants
        

        const isParticipant = chat.participants.some(p => p.id._serialized === participantId);
        
        console.log(`🚫  about to Remove  user ${label}: ${participantId}`);
        if (isParticipant) {
            try {
                await chat.removeParticipants([participantId]);
                console.log(`🚫 Removed user ${label}: ${participantId}`);
                
            } catch (error) {
                console.error(`❌ Failed to remove user ${label}: ${error.message}`);
            }
        } else {
            console.warn(`⚠️ Cannot remove ${label} ${participantId}, not found in participants`);
        }
    } catch (fetchError) {
        console.error(`❌ Failed to fetch participants for removal: ${fetchError.message}`);
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

    // Case 1: Non-Israeli number & not whitelisted
    if (!isIsraeliPhoneNumber(contactNumber) && !WHITELIST.includes(contactNumber)) {
        console.log(`🚨 Non-Israeli number detected: ${contactNumber}`);
        chat.sendMessage('`🚨 Non-Israeli number detectet');
        let messageIds = [];
        if (hasBlockedKeyword) {
            console.log(`⚠️ Blocked keyword detected in (case 1): "${msg.body}"`);
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

        await safeRemoveParticipant(chat, contact.id._serialized, contactNumber);
        return;
    }

    // Case 2: Israeli or whitelisted but used blocked keyword
    if (hasBlockedKeyword) {
        console.log(`⚠️ Blocked keyword detected in (case 2): "${msg.body}"`);
        chat.sendMessage('⚠️ Blocked keyword detected ');

        // Check if sender is an admin
        const botId = client.info.wid._serialized;
        const senderId = contact.id._serialized;
        const isSenderAdmin = chat.participants?.find(p => p.id._serialized === senderId)?.isAdmin || false;
            if (isSenderAdmin) {
                console.log(`⚠️ Skipping deletion for admin user ${contactNumber}`);
                return;
            }
.
        // Delete the current message
        try {
            await msg.delete(true);
            console.log(`🗑️ Deleted current message from ${contactNumber}: "${msg.body}" (ID: ${msg.id._serialized})`);
            chat.sendMessage('🗑️ Deleted current message ');
        } catch (deleteError) {
            console.error(`❌ Failed to delete current message ID ${msg.id._serialized}: ${deleteError.message}`);
        }

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

           // await safeRemoveParticipant(chat, contact.id._serialized, contactNumber);
        } 
        catch (error) {
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
