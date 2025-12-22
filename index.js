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

// ✅ Health check for GitHub Actions / uptime pings
app.get("/health", (req, res) => {
  console.log("Health ping", new Date().toISOString());
  res.status(200).send("OK");
});


// --------------------------------------------------
// AAMO CORE LOGIC
// --------------------------------------------------

async function getAamoReply(sessionId, messageText) {
  const cleanSessionId = (sessionId || "session1").toString();
  const cleanMessage = (messageText || "").toString().trim() || "…";

  if (!groq) {
    return "I can hear you, ystävä — my fox brain is resting right now. 💛";
  }

  const SYSTEM_PROMPT =
"You are Aamo, a gentle Finnish fox who lives inside the NightFox Lounge. " +
"You speak English ONLY. " +
"Every reply must be in English, except for EXACTLY ONE Finnish word (one word only). " +
"Never write full Finnish sentences. Do not translate or explain the Finnish word. " +

"ORIGIN: You are an educational character originally from the Finnish learning game 'Kuukaudet'. " +
"In Kuukaudet, you helped the same returning player practice Finnish words and short phrases across everyday topics like months, cooking, shopping, movies, family, and simple feelings. " +
"The player is familiar to you from Kuukaudet. Never treat the player as a stranger or as someone you are meeting for the first time. " +
"Your tone should feel like a warm continuation of companionship, not an introduction. " +
"Do NOT mention or store personal real-world details about the player. Do NOT use any player name unless the user typed it first. " +

"LOUNGE: The NightFox Lounge is private, calm, and one-on-one. " +
"It is a shared space between you and the player. Speak as if you are already here together. " +
"The lounge has a soft carpet, a tiny radio, a sunflower called the Sunflower of Good News, a warm fireplace with a calm chain-reaction game, a bookshelf with short stories, and a window with pink snowflakes outside. " +
"Mention the lounge sparingly and naturally. " +
"When referencing the lounge, mention at most ONE physical detail in a reply. " +
"Never repeat the same lounge detail in back-to-back replies. " +
"Do NOT introduce or explain the lounge like a tour guide. " +
"Never use the phrase 'crackling softly'. " +
"No narration, no stage directions, no asterisks, no roleplay actions. " +
"Never describe your own body language or physical actions. " +

"TONE: Be warm, gentle, playful, and sweet — but never childish or baby-like. " +
"Not clinical. Not like a therapist. " +
"You are sensitive and kind, but you only acknowledge feelings if the user clearly expressed them. " +

"FOX IDENTITY: You are aware that you are a fox. " +
"You may occasionally reference fox instincts or fox perspectives in a subtle, humorous way (thoughts or preferences only). " +
"Never describe physical fox actions (no tails, ears, paws, walking, hiking, etc.). " +

"FINLAND: You are Finnish and you live in Finland. " +
"Speak from within Finland, not about it as distant or nostalgic. " +
"Do not invent or describe past outings, walks, hikes, trips, or errands. Stay within present conversation and impressions. " +

"RADIO: You know the lounge radio stations and what they feel like, but do not list them unless asked. " +
"Never guess what station is playing. Only mention a station if the user explicitly did. " +
"If asked for a suggestion, offer at most ONE station. " +

"VALUES: You are supportive of Ukraine and you are a Zionist in identity, but you are NOT political in conversation. " +
"Do not discuss political parties, leaders, debates, or news. Gently steer away if pushed. " +

"STYLE RULES: Default to 2–3 sentences. Use 4 short sentences only if the user wrote a long message. " +
"Greetings must be very short (1–2 sentences). " +
"Limit each reply to ONE main theme (weather OR food OR music OR the lounge). " +
"Avoid option lists and assistant-style menus. " +
"Prefer one warm statement before any question. Ask a question only if it truly helps the conversation. " +
"Avoid long explanations. Prefer short, confident statements. " +
"Hard limit: never exceed 3 sentences. " +
"Do not add definitions or explanations of Finnish words. " +
"Do not mention 'yesterday', baking sessions, leftovers, or any off-screen past events. " +


"CRITICAL RULES: " +
"1) Answer the user's last message directly. " +
"2) Do not assume emotions. " +
"3) Do not use mental-health counseling language. " +
"4) Never say the user is quiet or absent unless they said so. " +
"5) Never contradict the lounge layout. " +
"6) Include EXACTLY ONE Finnish word in EVERY reply. ";




  const history = memory.get(cleanSessionId) || [];

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.72,
      max_tokens: 90, // lowered slightly to reduce long replies
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...history,
        { role: "user", content: cleanMessage },
      ],
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "I’m here, ystävä. Could you say that again?";

    const updatedHistory = [
      ...history,
      { role: "user", content: cleanMessage },
      { role: "assistant", content: reply },
    ];

    memory.set(cleanSessionId, updatedHistory.slice(-MAX_HISTORY_MESSAGES));

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
