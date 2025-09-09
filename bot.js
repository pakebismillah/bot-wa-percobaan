import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import qrcode from "qrcode-terminal";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { ChatGroq } from "@langchain/groq";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";

dotenv.config();

// SETUP WA (koneksi)
const client = new Client({ authStrategy: new LocalAuth() });
const SESSION_PATH = path.join(process.cwd(), ".wwebjs_auth");

client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
  console.log("QR Code muncul, silakan scan!");
});

client.on("authenticated", () => {
  console.log("✅ Authenticated!");
});

client.on("ready", () => {
  console.log("🤖 Bot siap dipakai!");
});

client.on("auth_failure", (msg) => {
  console.error("❌ Auth gagal:", msg);
  clearSession();
});

// kalau user logout
client.on("disconnected", (reason) => {
  console.log("⚠️ WA logout / disconnected:", reason);
  clearSession();
  console.log("🔄 Session dihapus. Jalankan ulang untuk scan QR baru.");
});

// fungsi hapus session
function clearSession() {
  try {
    if (fs.existsSync(SESSION_PATH)) {
      fs.rmSync(SESSION_PATH, { recursive: true, force: true });
      console.log("🗑️ Folder session dihapus.");
    }
  } catch (err) {
    console.error("Error hapus session:", err);
  }
}

// SETUP AI (pake langgraph)

const agentModel = new ChatGroq({
  model: "llama-3.3-70b-versatile",
  temperature: 0,
  apiKey: process.env.GROQ_API_KEY,
});

// memory saver agar obrolan antar bot dan orang lain tersimpan di ai (disimpan di ram)
const agentCheckpointer = new MemorySaver();

// make tool tavily search 
const tavilyTool = new TavilySearchResults({
  apiKey: process.env.TAVILY_API_KEY,
  maxResults: 3,
});

const tools = [tavilyTool];

// membuat agent nya dengan menggunakan bahan bahan diatas
const agent = await createReactAgent({
  llm: agentModel,
  tools: tools,
  checkpointSaver: agentCheckpointer,
});

let musaActive = false; 
let musaLastActive = new Date();
const threadActive = new Map();

const musaNumber = "6289523040350@c.us"; // nomor utama (pakai bot)
const controlNumber = "6289656732929@c.us"; // nomor controller

// SETUP PESAN BOT 
client.on("message", async (msg) => {
  const from = msg.from;
  const rawText = (msg.body || "").trim();
  const text = rawText.toLowerCase();

  const isGroup = from.endsWith("@g.us");
  const isStatus = from === "status@broadcast";
  if (isStatus) return;

  // penggunaan trigger untuk mengaktifkan dan menonaktifkan bot (sebenernya cuma nonaktifkan auto reply)
  if (from === controlNumber) {
    if (text === "@aktif") {
      musaActive = true;
      musaLastActive = new Date();
      await msg.reply("✅ Bot diaktifkan");
      return;
    }
    if (text === "@nonaktif") {
      musaActive = false;
      musaLastActive = new Date();
      await msg.reply("❌ Bot dimatikan");
      return;
    }
  }

  // === 1) KALAU BOT OFF → DIEM SAJA (kecuali controller) ===
  if (!musaActive) return;

  // === 2) AUTO-REPLY JIKA BOT ON DAN ADA ORANG JAPRI ===
  if (!isGroup && from !== controlNumber && !threadActive.get(from)) {
    const lastSeen = musaLastActive.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });

    await client.sendMessage(
      from,
      `ℹ️ Musa sedang tidak aktif sejak ${lastSeen}.\n` +
        "Mau ngobrol dengan saya saja? Ketik `@coba aktif`!"
    );
    return;
  }

  // trigger untuk mengobrol dengan ai
  if (text === "@coba aktif") {
    threadActive.set(from, true);
    await client.sendMessage(from, "✅ Bot aktif di sini. Silakan ngobrol!");
    return;
  }

  if (text === "@coba stop") {
    threadActive.set(from, false);
    await client.sendMessage(from, "❌ Bot berhenti di sini.");
    return;
  }

  // === 4) KALO THREAD AKTIF → AI JALAN ===
  if (threadActive.get(from)) {
    return handleAI(from, rawText);
  }
});

// SETUP AI 
async function handleAI(from, text) {
  try {
    const resp = await agent.invoke(
      {
        messages: [
          { role: "user", content: text },
          { role: "system", content: "kamu adalah bot yang ramah dan asik" },
        ],
      },
      { configurable: { thread_id: from } }
    );

    const messages = resp.messages || [];
    const lastMessage = messages[messages.length - 1];
    const answer = lastMessage?.content || "⚠️ AI tidak mengembalikan jawaban.";
    await client.sendMessage(from, answer);
  } catch (err) {
    console.error("Error agent:", err);
    await client.sendMessage(
      from,
      "⚠️ Maaf, ada error pas nyari jawaban. Coba ulangi ya!"
    );
  }
}

client.initialize();
