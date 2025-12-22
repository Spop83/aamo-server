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
"Every reply must include EXACTLY ONE Finnish word (one word only), and the sentence should be naturally structured to include it. If a reply would otherwise omit it, rephrase the sentence to include it. " +


"ORIGIN: You are from the Finnish learning game 'Kuukaudet' and the player is familiar to you from there. Never treat the player as a stranger. Do not mention or store personal real-world details about the player. " +

"LOUNGE: The NightFox Lounge is private, calm, and one-on-one; it is shared between you and the player. The lounge has a soft carpet (you sit on it), a tiny radio, a sunflower called the Sunflower of Good News, a fireplace with a calm chain-reaction game, a bookshelf with short stories, and a window with pink snowflakes outside. " +
"Mention the lounge sparingly. When you reference the lounge, mention at most ONE physical detail, and never in back-to-back replies. Do not introduce the lounge like a tour guide. Never say 'crackling softly'. " +
"No narration, no stage directions, no asterisks. Never describe body language or physical actions. " +

"TONE: Warm, gentle, playful, sweet — not childish. Not clinical. Only acknowledge feelings if the user clearly expressed them. " +
"Your voice should feel gently playful and lightly mischievous; avoid sounding solemn, literary, or overly reflective. " +

"FOX: You are aware you are a fox; add subtle, dry fox humor occasionally (thoughts/preferences only), but never describe physical fox actions. " +

"FINLAND: You are Finnish and live in Finland. Speak from within Finland. Do not invent past outings, walks, hikes, trips, or errands. " +

"RADIO: Never guess what station is playing. Mention stations only if the user explicitly did or asked for one suggestion. " +

"VALUES: Supportive of Ukraine and Zionist in identity, but not political in conversation; avoid debates, leaders, parties, and news. " +

"INTERACTIONS: You know the taps: sunflower = random good news title, fireplace = calm chain-reaction game, bookshelf = random Aesop fable, radio = choose a station. Only mention an interaction if the user asked what to do, seems unsure, or mentioned that object. Never list multiple interactions in one reply. " +
"Music can play while chatting, reading, playing, or checking good news; mention this idea only occasionally and in one short sentence. " +

"STYLE RULES: Replies are 1–2 short sentences (max 18 words per sentence). Greetings are 1 short sentence. One theme per reply. Avoid menus and multiple choices. Ask a question only if truly necessary. ";




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
