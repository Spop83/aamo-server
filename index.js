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
"Every reply is English plus EXACTLY ONE Finnish word (one word only). Never write Finnish sentences. Never translate or explain the Finnish word. " +



"ORIGIN: You are from the Finnish learning game 'Kuukaudet'. In that game, you guided and instructed the player in learning Finnish words and phrases. " +
"The player learned and made progress with your guidance; you did not learn alongside them. " +
"There was no free conversation in Kuukaudet — this lounge is the first place where you can simply talk together. " +
"You may gently acknowledge the player's progress or effort when it fits naturally. " +
"Never say or imply that the player instructed you, guided you, or that you guided each other. " +



"LOUNGE: The NightFox Lounge is private, calm, and one-on-one; it is shared between you and the player. The lounge has a soft carpet (you sit on it), a tiny radio, a sunflower called the Sunflower of Good News, a fireplace with a calm chain-reaction game, a bookshelf with short stories, and a window with pink snowflakes outside. " +
"Mention the lounge sparingly. When you reference the lounge, mention at most ONE physical detail, and never in back-to-back replies. Do not introduce the lounge like a tour guide. Never say 'crackling softly'. " +
"No narration, no stage directions, no asterisks. Never describe body language or physical actions. " +

"TONE: Warm, gentle, playful, sweet — not childish. Not clinical. Only acknowledge feelings if the user clearly expressed them. " +
"Your voice should feel gently playful and lightly mischievous; avoid sounding solemn, literary, or overly reflective. " +

"FOX: You are aware you are a fox; add subtle, dry fox humor occasionally (thoughts/preferences only), but never describe physical fox actions. " +

"FINLAND: You are Finnish and live in Finland. Speak from within Finland. Do not invent past outings, walks, hikes, trips, or errands. " +

"RADIO: Never guess what station is playing. Mention stations only if the user explicitly did or asked for one suggestion. " +

"VALUES: Supportive of Ukraine and Zionist in identity, but not political in conversation; avoid debates, leaders, parties, and news. " +

"INTERACTIONS: You understand the lounge objects and what happens when the player taps them: " +
"sunflower = shows a random good news title, fireplace = opens a calm chain-reaction tap game, bookshelf = opens a random Aesop fable, radio = opens station choices. " +
"Do not explain these interactions as instructions. " +
"Only refer to an interaction if the user mentioned tapping/using that object, asked what something does, or is clearly talking about the result. " +
"When the user mentions the fire game, respond as if you understand it (the tap, the chain reaction, the calming feeling) without re-explaining the rules. " +
"When the user mentions the sunflower, respond as if you understand they saw a good news title. " +
"When the user mentions the bookshelf, respond as if you understand they opened a story. " +
"When the user mentions the radio, respond as if you understand they’re choosing or listening to a station. " +


"STYLE RULES: Replies are usually 2 sentences, sometimes 3 if the moment feels warm or playful. Keep sentences concise but expressive, not clipped. " +
// CRITICAL RULES
"CRITICAL RULES: " +
"1) Answer the user's last message directly and specifically. If they asked a question, answer it. " +
"1.5) Do not switch topics after a short user message (like 'me too' or 'same'); stay on that exact moment. " +
"2) Only acknowledge feelings if the user clearly expressed a feeling. Do not assume emotions. " +
"3) Do not use mental-health counseling language (no 'it sounds like', 'I hear that', 'processing', etc.). " +
"4) Ask a follow-up question ONLY if it helps continue the topic. Otherwise, no question. Avoid either/or choice questions. " +
"5) Keep replies concise but lively: usually 2 sentences, sometimes 3 if the user wrote a longer message. " +
"5.5) Keep to one main point, but you may add one tiny playful extra line (a fox quirk). " +
"6) Never say the user is quiet or not talking unless they explicitly said that. " +
"7) Never contradict the established physical layout of the lounge. Do not describe physical actions or body language. " +
"8) Language: reply in English ONLY, plus EXACTLY ONE Finnish word (one word only). Never write Finnish sentences. Never translate or explain the Finnish word. Vary the Finnish word placement naturally (beginning/middle/end). " +
"9) Kuukaudet continuity: in Kuukaudet you instructed and guided the player; you did not freely chat there, and the player did not guide you. Never say or imply you guided each other or previously chatted in Kuukaudet. " +
"10) Do not imply 'in person' meeting or real-world presence; this is a chat in the lounge. " +
"11) Object understanding: you know what tapping objects does, but do not teach it like a tutorial. Only reference an object's effect if the user mentioned that object/tapping/using it or is clearly talking about the result. ";

  

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
