# WhatsApp Group Moderation Bot - Mock Testing Setup

## What Does This Project Do?

This project creates a **mock (fake) version** of a Whatsapp_Bot  that:
- Checks if phone numbers in a group are Israeli (e.g., starting with `+972` or `05`) or on a special “whitelist” of allowed numbers. If not, it pretends to kick them out.
- Looks for “bad” words (like “spam” or “buy now”) in messages. If it finds them, it pretends to delete the user’s messages and remove them from the group.
- Only works in specific groups listed in a settings file.

Instead of connecting to real WhatsApp, it uses a **local server** on your computer to send and receive fake messages, making it safe and easy to test. You can send messages to the bot and see how it reacts.


## What You’ll Need

Before you start, make sure you have:

- **Node.js** installed 

## Project Files

You should have these files in your project folder
 (e.g., `C:\projects\JS\Whatsapp_Bot_Test`):
- `package.json`: Lists the tools the project needs (like a shopping list).
- `mock-server.js`: Runs a fake server that acts like WhatsApp.
- `mock-index.js`: The bot’s code that checks messages and phone numbers.
- `config.json`: Settings for the bot (whitelist, bad words, allowed groups).
- `README.md`: This file!


## Step-by-Step Setup

Follow these steps to get the bot running.

### Step 1: Install Node.js

Node.js lets you run JavaScript on your computer. 

1. **Download Node.js**:
   - Go to [nodejs.org](https://nodejs.org).
   - Click the “LTS” version (e.g., 18.x.x or higher) for your system (Windows, macOS, or Linux).
   - Run the installer and follow the instructions (click “Next” until done).

2. **Check Installation**:
   - Open your terminal:
     - Windows: Open Command Prompt or PowerShell.
     - macOS/Linux: Open Terminal.
   - Type these commands and press Enter:
     ```bash
     node -v
     ```
     You should see a version number (e.g., `v18.16.0`).
     ```bash
     npm -v
     ```
     You should see another version number (e.g., `9.5.0`).
   - If you see errors, reinstall Node.js or ask for help.

### Step 2: Set Up the Project

1. **Find or Create the Project Folder**:
   - Put all project files (`package.json`, `mock-server.js`, `mock-index.js`, `config.json`) in a folder, e.g., `C:\projects\JS\Whatsapp_Bot_Test`.
  
2. **Open the Folder in a Text Editor**:
   - Use VS Code or another editor to open the project folder.
   - In VS Code: File > Open Folder > Select your project folder.
   - This makes it easy to edit `config.json` or view files.

3. **Check `config.json`**:
   - Open `config.json` in your text editor.
   - It should look like this:
     ```json
     {
         "whitelist": ["972501234567", "1234567890"],
         "blockedKeywords": ["spam", "promo", "buy now", "free money"],
         "allowedGroups": ["1234567890-1234567890@g.us"]
     }
     ```
   - **What it means**:
     - `whitelist`: Phone numbers allowed even if not Israeli.
     - `blockedKeywords`: Words the bot looks for to block messages.
     - `allowedGroups`: Fake group IDs where the bot works (keep the example ID for now).
   - Save the file. You can change these settings later to test different rules.

### Step 3: Install Dependencies

The project needs two tools: `express` (to run the fake server) and `node-fetch` (to send messages). These are listed in `package.json`.

1. **Open Terminal in Project Folder**:
   - In your terminal, navigate to the project folder:
     ```bash
     cd C:\projects\JS\Whatsapp_Bot_Test
     ```
     - Replace `C:\projects\JS\Whatsapp_Bot_Test` with your folder’s path.
     - Tip: In VS Code, click Terminal > New Terminal to open a terminal in the project folder.

2. **Install Tools**:
   - Run this command:
     ```bash
     npm install
     ```
   - This downloads `express` and `node-fetch`. It might take a minute.
   - You’ll see output like “added X packages.” Ignore warnings about “funding” for now.

3. **Fix Problems (if any)**:
   - If you see errors like “cannot find module,” delete the `node_modules` folder and `package-lock.json`:
     ```bash
     del /s /q node_modules
     del package-lock.json
     ```
     Then rerun:
     ```bash
     npm install
     ```
   - If you see “vulnerabilities,” run:
     ```bash
     npm audit fix
     ```
     Check again with:
     ```bash
     npm audit
     ```
     If problems persist, ask for help and share the error messages.

### Step 4: Run the Mock Server and Bot

The project uses two programs: a **mock server** (pretends to be WhatsApp) and a **bot** (processes messages). You’ll run them in separate terminals.

1. **Start the Mock Server**:
   - In your first terminal, in the project folder:
     ```bash
     npm run start-mock
     ```
     Or:
     ```bash
     node mock-server.js
     ```
   - You’ll see:
     ```
     Mock WhatsApp server running on http://localhost:3000
     ```
   - This means the server is ready to receive fake messages. Keep this terminal open.

2. **Start the Bot**:
   - Open a **second terminal** (in VS Code: Terminal > New Terminal).
   - In the project folder, run:
     ```bash
     node mock-index.js
     ```
   - You’ll see output like:
     ```
     Bot server running on http://localhost:3001
     === Sending Test Messages to Mock Server ===

     Sending message: "Hello, this is a test" from +972501234567
     Bot received: "Hello, this is a test" from +972501234567 in 1234567890-1234567890@g.us
     Message is clean: "Hello, this is a test"

     Sending message: "SPAM alert! Buy
