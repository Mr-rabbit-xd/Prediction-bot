import { Telegraf } from "telegraf";
import express from "express";
import bodyParser from "body-parser";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import dotenv from "dotenv";

dotenv.config();

const bot = new Telegraf(process.env.PREDICTION_BOT_TOKEN);
const MASTER_KEYS = process.env.MASTER_KEYS.split(",").map(k => k.trim());

// ------------------
// SQLite DB setup
// ------------------
let db;
(async () => {
  db = await open({ filename: "./prediction.db", driver: sqlite3.Database });
  
  // Users table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT UNIQUE,
      verified INTEGER DEFAULT 0
    )
  `);

  // Keys table (dynamic keys)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE,
      used INTEGER DEFAULT 0
    )
  `);
})();

// ------------------
// Express API to receive keys from Key Generator Bot (optional, later)
// ------------------
const app = express();
app.use(bodyParser.json());

app.post("/addkey", async (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).send("No key provided");
  await db.run("INSERT OR IGNORE INTO keys (key, used) VALUES (?, 0)", [key]);
  res.send("✅ Key added to Prediction Bot DB");
});

app.listen(process.env.PREDICTION_BOT_PORT, () => {
  console.log(`🚀 Prediction Bot API running on port ${process.env.PREDICTION_BOT_PORT}`);
});

// ------------------
// Helper Functions
// ------------------
async function isVerified(ctx) {
  const user = await db.get("SELECT * FROM users WHERE telegram_id = ?", [ctx.from.id]);
  return user && user.verified === 1;
}

function generatePrediction() {
  const periodNumber = Math.floor(10000 + Math.random() * 90000);
  const choice = Math.random() > 0.5 ? "Big" : "Small";
  const winRate = Math.floor(50 + Math.random() * 46) + "%"; // 50-95%
  return { periodNumber, choice, winRate };
}

// ------------------
// Bot Commands
// ------------------

// /start
bot.start(async (ctx) => {
  await db.run("INSERT OR IGNORE INTO users (telegram_id, verified) VALUES (?, 0)", [ctx.from.id]);
  return ctx.reply(
    `👋 Welcome ${ctx.from.first_name}!\n` +
    `🔑 Please enter your Key to continue.\n` +
    `If you don't have a Key, contact Admin.`
  );
});

// Handle text messages
bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text.trim();
  
  // Fetch user
  const user = await db.get("SELECT * FROM users WHERE telegram_id = ?", [userId]);

  // Already verified
  if (user && user.verified) {
    if (text.toLowerCase() === "signal" || text.toLowerCase() === "/signal" ||
        text.toLowerCase() === "next" || text.toLowerCase() === "/next") {
      const { periodNumber, choice, winRate } = generatePrediction();
      return ctx.reply(
        `🆔 Period Number: ${periodNumber}\n` +
        `💰 Purchase: ${choice}\n` +
        `📊 Win Rate: ${winRate}\n` +
        `➡️ Next prediction: type /next`
      );
    }
    return ctx.reply("✅ You are verified. Type `signal` to get prediction.");
  }

  // Master key check
  if (MASTER_KEYS.includes(text)) {
    await db.run("UPDATE users SET verified = 1 WHERE telegram_id = ?", [userId]);
    return ctx.reply("✅ Access Granted! Type `signal` to get prediction.");
  }

  // Dynamic key check
  const keyRow = await db.get("SELECT * FROM keys WHERE key = ? AND used = 0", [text]);
  if (keyRow) {
    await db.run("UPDATE keys SET used = 1 WHERE key = ?", [text]);
    await db.run("UPDATE users SET verified = 1 WHERE telegram_id = ?", [userId]);
    return ctx.reply("✅ Access Granted via Dynamic Key! Type `signal` to get prediction.");
  }

  return ctx.reply("❌ Invalid key. Try again or contact Admin.");
});

// ------------------
// Launch Bot
// ------------------
bot.launch();
console.log("🚀 Prediction Bot running...");bot.launch();
console.log("🚀 Prediction Bot is running...");
