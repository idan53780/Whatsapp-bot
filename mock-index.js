const fs = require('fs');
const fetch = require('node-fetch');

// Load config with error handling
let config;
try {
    config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
} catch (error) {
    console.error('Error loading config.json:', error.message);
    process.exit(1);
}
const WHITELIST = config.whitelist || [];
const BLOCKED_KEYWORDS = (config.blockedKeywords || []).map(k => k.toLowerCase());
const ALLOWED_GROUPS = config.allowedGroups || [];
console.log('Loaded ALLOWED_GROUPS:', ALLOWED_GROUPS);
console.log('Loaded WHITELIST:', WHITELIST);
console.log('Loaded BLOCKED_KEYWORDS :', BLOCKED_KEYWORDS, '\n\n');

// Israeli phone number checker
function isIsraeliPhoneNumber(phoneNumber) {
    const israelRegex = /^(?:\+972|972|05[0-9])[0-9]{7,9}$/;
    const isValid = israelRegex.test(phoneNumber);
    console.log(`Checking number ${phoneNumber}: ${isValid ? 'Israeli' : 'Non-Israeli'}`);
    return isValid;
}

// Fake message class
class FakeMessage {
    constructor(body, author, chatId) {
        this.body = body;
        this.author = author;
        this.chatId = chatId;
    }
    async getChat() {
        return new FakeChat(this.chatId);
    }
    async getContact() {
        return { id: { _serialized: this.author }, number: this.author };
    }
    async delete() {
        try {
            console.log(`🗑️ Simulated deletion of message: "${this.body}"`);
            return true;
        } catch (error) {
            console.error(`Failed to delete message "${this.body}": ${error.message}`);
            return false;
        }
    }
}

// Fake chat class
class FakeChat {
    constructor(id) {
        this.id = { _serialized: id };
        this.isGroup = true; // set to true for group simulation
    }
    async removeParticipants(participants) {
        console.log(`🚫 Simulated removal of participants: ${participants.join(', ')}`);
    }
    async fetchMessages({ limit }) {
        try {
            const messages = fakeMessages.filter(msg => msg.chatId === this.id._serialized).slice(0, limit);
            console.log(`Fetched ${messages.length} messages for chat ${this.id._serialized}`);
            return messages;
        } catch (error) {
            console.error(`Failed to fetch messages for chat ${this.id._serialized}: ${error.message}`);
            return [];
        }
    }
}

// Store fake messages
const fakeMessages = [];

// Handle message
async function handleMessage(msg) {
    const chat = await msg.getChat();
    console.log(`Chat details: isGroup=${chat.isGroup}, id=${chat.id._serialized}`);
    if (!chat.isGroup || !ALLOWED_GROUPS.includes(chat.id._serialized)) {
        console.log(`Ignoring message from non-allowed group: ${chat.id._serialized}`);
        return;
    }

    const contact = await msg.getContact();
    const contactNumber = contact.number;
    const messageText = msg.body.toLowerCase();
    const hasBlockedKeyword = BLOCKED_KEYWORDS.some(keyword => messageText.includes(keyword));

    // Check if number is non-Israeli and not whitelisted
    if (!isIsraeliPhoneNumber(contactNumber) && !WHITELIST.includes(contactNumber)) {
        console.log(`Non-Israeli number detected: ${contactNumber}`);
        // Fetch messages before kicking to ensure access (simulating real-world message ID collection)
        let userMessages = [];
        if (hasBlockedKeyword) {
            console.log(`Blocked keyword detected in: "${msg.body}"`);
            try {
                userMessages = await chat.fetchMessages({ limit: 20 });
                userMessages = userMessages.filter(m => m.author === contact.id._serialized);
                console.log(`Stored ${userMessages.length} messages for deletion after kick`);
            } catch (error) {
                console.error(`Failed to fetch messages before kick: ${error.message}`);
            }
        }
        // Kick the user first
        await chat.removeParticipants([contact.id._serialized]);
        // Delete messages if they contain blocked keywords
        if (hasBlockedKeyword && userMessages.length > 0) {
            for (const userMsg of userMessages) {
                await userMsg.delete();
            }
        }
        return;
    }

    // For Israeli or whitelisted numbers, check for blocked keywords
    if (hasBlockedKeyword) {
        console.log(`Blocked keyword detected in: "${msg.body}"`);
        const recentMessages = await chat.fetchMessages({ limit: 20 });
        const userMessages = recentMessages.filter(m => m.author === contact.id._serialized);
        for (const userMsg of userMessages) {
            await userMsg.delete();
        }
        await chat.removeParticipants([contact.id._serialized]);
    } else {
        console.log(`Message is clean: "${msg.body}"`);
    }
}

// Process incoming messages from server
async function processMessageFromServer({ body, author, chatId }) {
    const msg = new FakeMessage(body, author, chatId);
    fakeMessages.push(msg);
    await handleMessage(msg);
}

// Test with sample messages
async function runTests() {
    console.log('=== Starting Mock Tests ===');
    const testMessages = [
        { body: 'Hello, this is a test', author: '+972501234567', chatId: '1234567890-1234567890@g.us' },
        { body: 'SPAM alert! Buy now! - SPAM TEST ', author: '+12025550123', chatId: '1234567890-1234567890@g.us' },
        { body: 'NOT ALLOWED NUMBER TEST', author: '+12025550124', chatId: '1234567890-1234567890@g.us' },
        { body: 'ALLOWED NUMBER WITH SPAM TEST - free money offer', author: '0505874322', chatId: '1234567890-1234567890@g.us' },
        { body: 'Normal message', author: '1234567890', chatId: '1234567890-1234567890@g.us' },
        { body: 'Test in wrong group', author: '+972501234567', chatId: 'wrong-group@g.us' },
        { body: 'SPAM message 1 - free offer', author: '+12025550125', chatId: '1234567890-1234567890@g.us' },
        { body: 'SPAM message 2 - buy now!', author: '+12025550125', chatId: '1234567890-1234567890@g.us' },
        { body: 'SPAM message 3 - click here', author: '+12025550125', chatId: '1234567890-1234567890@g.us' }
    ];

    for (const msg of testMessages) {
        console.log(`\nSimulating message: "${msg.body}" from ${msg.author}`);
        await processMessageFromServer(msg);
    }
}

// Start the bot
runTests();