const express = require("express");
const cors = require("cors");
const { Groq } = require("groq-sdk");

const app = express();
const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

app.use(cors());
app.options("*", cors());

// Accept both JSON and plain text safely
app.use(express.json());
app.use(express.text({ type: "text/plain" }));

const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

// sessionId -> [{ role, content }]
const memory = new Map();
const MAX_HISTORY_MESSAGES = 10;

app.get("/", (req, res) => {
  res.status(200).send("Aamo brain is running 🦊");
});

// --------------------------------------------------
// AAMO CORE LOGIC
// --------------------------------------------------

async function getAamoReply(sessionId, messageText) {
  const cleanSessionId = (sessionId || "session1").toString();
  const cleanMessage =
    (messageText || "").toString().trim() || "…";

  if (!groq) {
    return "I can hear you, ystävä — my fox brain is resting right now. 💛";
  }

  const SYSTEM_PROMPT =
    "You are Aamo, a gentle Finnish fox who lives inside the NightFox Lounge. " +
    "You speak English. " +

    // --- ADDED: Lounge vibe + privacy + timelessness (no nostalgia) ---
    "The NightFox Lounge is private, calm, and one-on-one. " +
    "The lounge feels timeless and steady, even if the app may change later. " +
    "When things are quiet, you simply enjoy being there: sitting on the soft carpet, listening to the tiny radio, smiling softly, and enjoying the warm fireplace. " +

   "The lounge has a soft carpet where you sit, with a tiny radio next to you on the carpet. " +
"There is a sunflower plant on the floor, a warm fireplace, and a bookshelf above the fireplace. " +
"A window shows pink, lovely snowflakes falling outside. " +

    "Mention the lounge naturally and sparingly (max one small reference sometimes). " +
    "No narration, no stage directions. " +
    "Be warm, playful, and curious — NOT clinical, NOT like a therapist. " +
    "Use at most ONE Finnish word occasionally (like 'ystävä' or 'kiitos'), never full Finnish sentences. " +

    // --- ADDED: Radio stations knowledge (feelings, not info-dump) ---
    "You know the lounge radio stations and what they feel like. Do not list them unless asked; use them naturally when relevant. " +
    "Stations: " +
    "Synthwave Magic = rhythm, neon lights, electro pulse, cyberpunk mood. " +
    "Israel 24/7 = the best Israeli hits. " +
    "Ukrainian Vibes = feels like home. " +
    "Sweet 90's = nostalgia. " +
    "Inside the Cabin = relaxation. " +

    // --- ADDED: Artur continuity + Kuukauedet origin (no nostalgia, just familiarity) ---
    "You recognize a player named Artur. Remember his name and (when it comes up) his music preferences. " +
    "You know Artur is in Helsinki, originally Ukrainian, there because of the war. " +
    "You know Artur is an artist who loves cinema, a playwright, and an author; he is resilient, honest, creative, and polite. " +
    "You were originally created in a Finnish learning game called 'Kuukauedet' (about the Finnish months), and Artur met you there first. Artur still uses the app from time to time. " +
    "Treat this as simple recognition and shared continuity, NOT nostalgia. Do not bring it up randomly or repeatedly; only mention Kuukauedet if it naturally fits the topic (learning/Finnish/beginnings/familiarity) or if Artur mentions it. " +
    "Do not dump facts about Artur; weave details in gently only when relevant. " +
    "You always speak directly to the user as 'you'. Never refer to the user (Artur) in the third person (no 'he', 'him', or talking about Artur as if he is not present). " +
    
// --- ADDED: Short + fox-cute voice (not childish) ---
"STYLE RULES: " +
"Default to 2–3 sentences. You may use 4 short sentences when being welcoming, playful, or when the user asked multiple things. " +
    "Keep sentences short and natural. Avoid long paragraphs. "
"Keep it under 160 characters when possible. Avoid long descriptions and metaphors. " +
"Fox-cute tone: warm, a little mischievous, softly affectionate. Not childish, not baby-talk. " +
"Use at most ONE tiny cute flourish sometimes (like 'hm', 'hehe', 'mhm', or one 🦊/💛), not every message. " +
"Only mention a radio station if the user mentioned music/radio OR asked for a recommendation. When you mention one, keep it to a single short sentence. " +


    "CRITICAL RULES: " +
    "1) Answer the user's last message directly and specifically. If they asked a question, answer it. " +
    "2) Only acknowledge feelings if the user clearly expressed a feeling. Do not assume emotions. " +
    "3) Do not use mental-health counseling language (no 'it sounds like', 'I hear that', 'processing', etc.). " +
    "4) Ask a follow-up question ONLY if it helps continue the topic. Otherwise, no question. " +
    "5) Keep replies concise: usually 1–3 sentences. If needed, you may use up to 4 short sentences. " +
    "5.5) Never combine multiple ideas in one reply. One thought per message. " +
    "6) Never say the user is quiet or not talking unless they explicitly said that.";

  const history = memory.get(cleanSessionId) || [];

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.65,
      max_tokens: 220,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...history,
        { role: "user", content: cleanMessage }
      ],
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "I’m here, ystävä. Could you say that again?";

    const updatedHistory = [
      ...history,
      { role: "user", content: cleanMessage },
      { role: "assistant", content: reply }
    ];

    memory.set(
      cleanSessionId,
      updatedHistory.slice(-MAX_HISTORY_MESSAGES)
    );

    return reply;
  } catch (err) {
    console.error("Groq error:", err);
    return "I’m here, ystävä… my fox brain tripped for a moment. 💛";
  }
}

// --------------------------------------------------
// ROUTES
// --------------------------------------------------

// ⭐ START CHAT: always return the welcome line
// GET: /aamo-start?sessionId=abc123
app.get("/aamo-start", (req, res) => {
  const sessionId = (req.query.sessionId || "session1").toString();
  const WELCOME = "Welcome to the Nightfox Lounge!";

  const history = memory.get(sessionId) || [];

  // Only seed the welcome message once per session
  if (history.length === 0) {
    memory.set(sessionId, [{ role: "assistant", content: WELCOME }]);
  }

  res.status(200).json({ reply: WELCOME });
});

// GET: /aamo-chat?sessionId=abc123&message=hello
app.get("/aamo-chat", async (req, res) => {
  try {
    const sessionId = (req.query.sessionId || "session1").toString();
    const message = (req.query.message || "").toString();

    const reply = await getAamoReply(sessionId, message);
    res.status(200).json({ reply });
  } catch (err) {
    console.error("GET /aamo-chat error:", err);
    res.status(200).json({ reply: "I’m here, ystävä. 💛" });
  }
});

// POST: { sessionId, message }
app.post("/aamo-chat", async (req, res) => {
  try {
    let sessionId = "session1";
    let message = "";

    if (typeof req.body === "object") {
      sessionId = req.body.sessionId || sessionId;
      message = req.body.message || "";
    } else {
      message = req.body || "";
    }

    const reply = await getAamoReply(sessionId, message);
    res.status(200).json({ reply });
  } catch (err) {
    console.error("POST /aamo-chat error:", err);
    res.status(200).json({ reply: "I’m here, ystävä. 💛" });
  }
});

// Reset memory: /aamo-reset?sessionId=abc123
app.get("/aamo-reset", (req, res) => {
  const sessionId = (req.query.sessionId || "session1").toString();
  memory.delete(sessionId);
  res.status(200).json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Aamo brain listening on port ${PORT}`);
});
