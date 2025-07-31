# 🤖 WhatsApp Group Moderation Bot

A **Node.js-based WhatsApp bot** built using [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js).  
This bot helps automate WhatsApp group moderation by:

✅ Removing non-Israeli numbers unless whitelisted  
✅ Detecting and deleting messages containing blocked keywords  
✅ Logging all moderation actions for transparency  

---

## 📌 Features

- ✅ Detects **non-Israeli phone numbers** and removes them (unless whitelisted)  
- ✅ Monitors **blocked keywords** and deletes messages containing them  
- 🚧 Removes users who send prohibited messages 🚧 - will be added in a future version  
- ✅ Operates only in **allowed groups** (configured in `config.json`)  
- ✅ Verifies that the **bot is an admin** before taking action  
- ✅ Includes safety checks to **avoid removing group admins**  
- ✅ Deletes recent messages from violating users for cleaner chats  
- ✅ Uses **persistent login** with LocalAuth (no QR scan needed every time)  

---

## 📂 Project Structure

```
📦 whatsapp-bot
 ┣ 📜 index.js       # Main bot script
 ┣ 📜 package.json   # Node.js dependencies
 ┣ 📜 config.json    # Configuration file
 ┗ 📜 README.md      # Project documentation
```

---

## ⚙️ Prerequisites

Make sure you have the following installed:

- **Node.js** (v16 or higher) → [Download here](https://nodejs.org/)  
- **npm** (comes with Node.js)  
- A valid **WhatsApp account** logged in on your phone  
- **Admin privileges** in the groups you want the bot to moderate  

---

## 🚀 Installation

1. **Clone this repository**

```bash
git clone https://github.com/YOUR-USERNAME/whatsapp-moderation-bot.git
cd whatsapp-moderation-bot
```

2. **Install dependencies from `package.json`**

```bash
npm install
```

This will install all required packages:
- `whatsapp-web.js`
- `qrcode-terminal`
- `puppeteer`
- (plus built-in Node.js modules like `fs`)

3. **configure `config.json`**

```json
{
  "whitelisted_phones": ["----", "------"],
  "blockedKeywords": ["string", "string", "string"],
  "allowedGroups": ["---------@g.us"]
}
```

- **whitelisted_phones** → Phone numbers that are never removed  
- **blockedKeywords** → Words that trigger message deletion and user removal  
- **allowedGroups** → WhatsApp Group IDs where the bot should be active  - you can get the id when you first init the bot 

---

## ▶️ Running the Bot

Start the bot using:

```bash
node index.js
```

- On first launch, a **QR code** will appear in your terminal.  
- Scan it via **WhatsApp → Menu → Linked Devices → Link a device**.  
- The bot stays logged in (**LocalAuth** saves session).  
- If the bot is not an admin in a group, it will **skip removals** automatically.
- A list of the groups and their details will appear in the terminal. You can use this information for the config file -> see step 3 in the installation section for more info

---

## 🛠️ Bot Behavior

- If a **non-Israeli number** joins and is **not whitelisted**, it will be **removed**.  
- If a **blocked keyword** is detected:
  1. The message will be deleted  
  2. Previous messages from that user may also be deleted  
  3. The user will be removed from the group - future version 🚧 
- **Admins are never removed**, even if they send blocked keywords.  
- Bot only moderates groups listed in `allowedGroups`.  

---

## ⚠️ Notes

- The bot **must have admin rights** to remove participants or delete messages.  
- Keep your **WhatsApp app active** on your phone for the bot to stay connected.  
- If your session expires, restart the bot and **scan the QR code again**.  

[!IMPORTANT] It is not guaranteed you will not be blocked by using this bot. WhatsApp does not allow bots or unofficial clients on their platform, so this shouldn't be considered totally safe.

---

