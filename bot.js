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

// === 1. Setup WhatsApp Client ===
const client = new Client({ authStrategy: new LocalAuth() });

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('QR Code muncul, silakan scan!');
});

client.on('authenticated', () => {
    console.log('✅ Authenticated!');
});

client.on('ready', () => {
    console.log('🤖 Bot siap dipakai!');
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

// === 2. Setup LLM (Groq) ===
const agentModel = new ChatGroq({
    model: "llama-3.3-70b-versatile",
    temperature: 0,
    apiKey: process.env.GROQ_API_KEY,
});

// === 3. Memory Saver ===
const agentCheckpointer = new MemorySaver();

// === 4. Tool: Tavily Search ===
const tavilyTool = new TavilySearchResults({
    apiKey: process.env.TAVILY_API_KEY,
    maxResults: 3,
});

const tools = [tavilyTool];

// === 5. Buat Agent ===
const agent = await createReactAgent({
    llm: agentModel,
    tools: tools,
    checkpointSaver: agentCheckpointer,
});

let musaActive = false; // default ikut WA online status
let musaLastActive = new Date();
const threadActive = new Map(); // status aktif sementara per thread

// === Presence update untuk nomor Musa ===
client.on('presence_update', (update) => {
    if (update.id.user === '6289523040350') { // nomor kamu
        if (update.isOnline) {
            if (!musaActive) {
                console.log("Musa baru online 🚀");
            }
            musaActive = true;
        } else {
            if (musaActive) {
                musaLastActive = new Date(); // update terakhir kali offline
                console.log("Musa terakhir aktif:", musaLastActive.toLocaleString());
            }
            musaActive = false;
        }
    }
});

// === Handler Pesan WhatsApp ===
client.on("message", async (msg) => {
  const from = msg.from;
  const rawText = (msg.body || "").trim();
  const text = rawText.toLowerCase();

  // deteksi jenis chat
  const isGroup = from.endsWith("@g.us");      // grup
  const isStatus = from === "status@broadcast"; // status WA
  if (isStatus) return; // abaikan status

  // === 1) TRIGGER DULU (berlaku untuk japri & grup) ===
  if (text === "@coba aktif") {
    threadActive.set(from, true);
    await client.sendMessage(
      from,
      isGroup ? "✅ Bot aktif di grup ini!" : "✅ Bot aktif sekarang di sini (chat pribadi)!"
    );
    return; // cukup sampai sini; pesan berikutnya baru dilayani AI
  }

  if (text === "@coba stop") {
    threadActive.set(from, false);
    await client.sendMessage(
      from,
      isGroup ? "❌ Bot nonaktif di grup ini." : "❌ Bot nonaktif di sini (chat pribadi)."
    );
    return;
  }

  // === 2) AUTO-REPLY HANYA DI JAPRI, SAAT BELUM AKTIF & MUSA OFFLINE ===
  if (!isGroup) {
    if (!musaActive && !threadActive.get(from)) {
      const diffMinutes = Math.max(0, Math.floor((Date.now() - musaLastActive.getTime()) / 60000));
      await client.sendMessage(
        from,
        `ℹ️ Musa sudah tidak aktif selama ${diffMinutes} menit.\n` +
        "Mau ngobrol dengan saya saja? Ketik `@coba aktif`!"
      );
      return; // stop; jangan teruskan ke AI
    }
  }

  // === 3) JALANKAN AI HANYA JIKA THREAD SUDAH DI-AKTIFKAN ===
  if (threadActive.get(from)) {
    return handleAI(from, rawText); // pakai rawText biar format asli user tetap utuh
  }

  // selain kondisi di atas: diam (no spam)
});

// === Fungsi AI ===
async function handleAI(from, text) {
    try {
        const resp = await agent.invoke(
            {
                messages: [
                    { role: "user", content: text },
                    { role: "system", content: "kamu adalah bot yang ramah dan asik" }
                ]
            },
            { configurable: { thread_id: from } }
        );

        const messages = resp.messages || [];
        const lastMessage = messages[messages.length - 1];
        const answer = lastMessage?.content || "⚠️ AI tidak mengembalikan jawaban.";
        await client.sendMessage(from, answer);

    } catch (err) {
        console.error("Error agent:", err);
        await client.sendMessage(from, "⚠️ Maaf, ada error pas nyari jawaban. Coba ulangi ya!");
    }
}

client.initialize();
