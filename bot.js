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

// 🔑 /enterkey command
bot.command("enterkey", async (ctx) => {
  const parts = ctx.message.text.split(" ");
  if (parts.length < 2) {
    return ctx.reply("❌ Please provide a key. Example: /enterkey VIP12345");
  }
  const enteredKey = parts[1].trim();

  // 1. Check Master Keys
  if (MASTER_KEYS.includes(enteredKey)) {
    await db.run(
      "INSERT OR REPLACE INTO users (telegram_id, verified) VALUES (?, ?)",
      [ctx.from.id, 1]
    );
    return ctx.reply("✅ Access granted via Master Key!");
  }

  // 2. Check Dynamic Keys from DB
  const keyRow = await db.get("SELECT * FROM keys WHERE key = ? AND used = 0", enteredKey);
  if (keyRow) {
    await db.run("UPDATE keys SET used = 1 WHERE key = ?", enteredKey);
    await db.run(
      "INSERT OR REPLACE INTO users (telegram_id, verified) VALUES (?, ?)",
      [ctx.from.id, 1]
    );
    return ctx.reply("✅ Access granted via Dynamic Key!");
  }

  return ctx.reply("❌ Invalid or already used key.");
});

// 📢 /signal command
bot.command("signal", async (ctx) => {
  if (!(await isVerified(ctx))) {
    return ctx.reply("🔑 You must enter a valid key using /enterkey");
  }

  // Random Big/Small + Color Prediction
  const size = Math.random() > 0.5 ? "BIG" : "SMALL";
  const color = Math.random() > 0.5 ? "🔴 RED" : "🟢 GREEN";

  return ctx.reply(`📊 Prediction:\n👉 Size: ${size}\n👉 Color: ${color}`);
});

// 📜 /history command (dummy for now)
bot.command("history", async (ctx) => {
  if (!(await isVerified(ctx))) {
    return ctx.reply("🔑 You must enter a valid key using /enterkey");
  }
  return ctx.reply("📜 Last 5 Predictions:\n1. BIG 🔴\n2. SMALL 🟢\n3. BIG 🟢\n4. SMALL 🔴\n5. BIG 🔴");
});

// 🛠️ /genkey (admin only for demo)
bot.command("genkey", async (ctx) => {
  const newKey = "KEY" + Math.floor(100000 + Math.random() * 900000);
  await db.run("INSERT INTO keys (key, used) VALUES (?, 0)", newKey);
  return ctx.reply(`🆕 New Key generated: \`${newKey}\``, { parse_mode: "Markdown" });
});

// Start bot
bot.launch();
console.log("🚀 Prediction Bot is running...");
