import { Telegraf } from "telegraf";
import dotenv from "dotenv";
import { initDB } from "./db.js";

dotenv.config();

const bot = new Telegraf(process.env.PREDICTION_BOT_TOKEN);
const MASTER_KEYS = process.env.MASTER_KEYS.split(",").map(k => k.trim());

let db;
(async () => {
  db = await initDB();
})();

// ✅ Middleware: check user verified or not
async function isVerified(ctx) {
  const user = await db.get("SELECT * FROM users WHERE telegram_id = ?", ctx.from.id);
  return user && user.verified === 1;
}

// 🏁 /start command
bot.start(async (ctx) => {
  await db.run(
    "INSERT OR IGNORE INTO users (telegram_id, verified) VALUES (?, 0)",
    [ctx.from.id]
  );

  return ctx.reply(
    `👋 Welcome ${ctx.from.first_name || "User"}!\n\n` +
    `🔑 This is the Prediction Bot.\n\n` +
    `To get access, enter your Key using:\n` +
    `/enterkey YOUR_KEY\n\n` +
    `👉 If you don't have a Key, contact Admin.`
  );
});

// 🔑 /enterkey command
bot.command("enterkey", async (ctx) => {
  const parts = ctx.message.text.split(" ");
  if (parts.length < 2) {
    return ctx.reply("❌ Please provide a key.\nExample: /enterkey VIP12345");
  }
  const enteredKey = parts[1].trim();

  // 1. Check Master Keys
  if (MASTER_KEYS.includes(enteredKey)) {
    await db.run(
      "INSERT OR REPLACE INTO users (telegram_id, verified) VALUES (?, ?)",
      [ctx.from.id, 1]
    );
    return ctx.reply("✅ Access granted via Master Key!\n\nYou can now use /signal to get predictions.");
  }

  // 2. Check Dynamic Keys from DB
  const keyRow = await db.get("SELECT * FROM keys WHERE key = ? AND used = 0", enteredKey);
  if (keyRow) {
    await db.run("UPDATE keys SET used = 1 WHERE key = ?", enteredKey);
    await db.run(
      "INSERT OR REPLACE INTO users (telegram_id, verified) VALUES (?, ?)",
      [ctx.from.id, 1]
    );
    return ctx.reply("✅ Access granted via Dynamic Key!\n\nYou can now use /signal to get predictions.");
  }

  return ctx.reply("❌ Invalid or already used key.\nPlease contact Admin for a valid key.");
});

// 📢 /signal command
bot.command("signal", async (ctx) => {
  if (!(await isVerified(ctx))) {
    return ctx.reply("🔒 You are not verified.\n\nUse /enterkey to unlock access.");
  }

  // Random Big/Small + Color Prediction
  const size = Math.random() > 0.5 ? "BIG" : "SMALL";
  const color = Math.random() > 0.5 ? "🔴 RED" : "🟢 GREEN";

  return ctx.reply(
    `📊 Prediction:\n\n👉 Size: *${size}*\n👉 Color: *${color}*`,
    { parse_mode: "Markdown" }
  );
});

// 📜 /history command (demo)
bot.command("history", async (ctx) => {
  if (!(await isVerified(ctx))) {
    return ctx.reply("🔒 You are not verified.\n\nUse /enterkey to unlock access.");
  }

  return ctx.reply(
    "📜 Last 5 Predictions:\n" +
    "1. BIG 🔴\n2. SMALL 🟢\n3. BIG 🟢\n4. SMALL 🔴\n5. BIG 🔴"
  );
});

// 🛠️ /genkey (Admin Demo - generate random key)
bot.command("genkey", async (ctx) => {
  const newKey = "KEY" + Math.floor(100000 + Math.random() * 900000);
  await db.run("INSERT INTO keys (key, used) VALUES (?, 0)", newKey);
  return ctx.reply(`🆕 New Key generated:\n\`${newKey}\``, { parse_mode: "Markdown" });
});

// 🚀 Launch bot
bot.launch();
console.log("🚀 Prediction Bot is running...");
