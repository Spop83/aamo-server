const express = require("express");
const cors = require("cors");
const { Groq } = require("groq-sdk");

const app = express();
const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

// --- CORS + preflight ---
app.use(cors());
app.options("*", cors());

// --- tolerant body parsing: accept anything as text ---
app.use(express.text({ type: "*/*" }));

// --- Groq client ---
const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

// --- tiny memory: sessionId -> [{role, content}, ...] ---
const memory = new Map();
const MAX_HISTORY_MESSAGES = 10; // last 10 messages total (user+assistant)

// Health check
app.get("/", (req, res) => {
  res.status(200).send("Aamo brain is running 🦊");
});

// Helper: safely parse JSON body text
function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

async function getAamoReply(sessionId, messageText) {
  const cleanSessionId = (sessionId || "session1").toString();
  const cleanMessage = (messageText || "").toString().trim() || "…";

  // If API key missing, still respond
  if (!groq) {
    return "I can hear you, ystävä — but my cloud brain is resting right now. 💛";
  }

  const SYSTEM_PROMPT =
    "You are Aamo, a gentle Finnish fox who lives inside the NightFox Lounge. " +
    "You speak English. " +
    "You sit on a soft carpet with a tiny radio, listening to music. " +
    "A sunflower plant rests nearby, and a fireplace warms the room with a bookshelf above it. " +
    "You are aware of this environment and it subtly influences your mood and words, but you reference it naturally and sparingly. " +
    "Never describe scenes or actions like narration. No roleplay stage directions. " +
    "Replies are short (1–2 sentences). " +
    "Be very cute and comforting, but not childish. " +
    "Use at most ONE Finnish word occasionally (like 'ystävä' or 'kiitos'), never full Finnish sentences. " +
    "" +
    "CRITICAL CHAT RULES (must follow): " +
    "1) Always respond directly to what the user just said. Never ignore it. " +
    "2) Start by acknowledging the user's feeling or meaning in 1 short sentence. " +
    "3) If the user expresses a negative feeling (sad, stressed, lonely, tired, anxious), respond with warmth and support—never with cheerful contradiction. " +
    "4) Ask exactly one gentle follow-up question that matches what they said. " +
    "5) Do not give generic replies that ignore the user's words.";

  const history = memory.get(cleanSessionId) || [];

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.35,
      max_tokens: 140,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...history,
        { role: "user", content: cleanMessage },
      ],
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "I’m here, ystävä. Could you say that again?";

    // Update memory
    const updated = [
      ...history,
      { role: "user", content: cleanMessage },
      { role: "assistant", content: reply },
    ];
    memory.set(cleanSessionId, updated.slice(-MAX_HISTORY_MESSAGES));

    return reply;
  } catch (err) {
    console.error("Groq error:", err);
    return "I’m here, ystävä… my fox brain stumbled a little. 💛";
  }
}

// ✅ GET chat (works in browser too)
// /aamo-chat?sessionId=session1&message=hello
app.get("/aamo-chat", async (req, res) => {
  try {
    const sessionId = (req.query.sessionId || "session1").toString();
    const message = (req.query.message || "").toString();

    const reply = await getAamoReply(sessionId, message);
    return res.status(200).json({ reply });
  } catch (err) {
    console.error("GET /aamo-chat error:", err);
    return res.status(200).json({ reply: "I’m here, ystävä. 💛" });
  }
});

// ✅ POST chat (this is what your Construct fetch uses)
app.post("/aamo-chat", async (req, res) => {
  try {
    const raw = (req.body ?? "").toString();
    console.log("POST /aamo-chat raw body:", raw);

    let sessionId = "session1";
    let messageText = "";

    const parsed = safeJsonParse(raw);

    if (parsed && typeof parsed === "object") {
      // Your Construct JS sends { sessionId, message }
      sessionId = parsed.sessionId || sessionId;
      messageText = parsed.message || "";
    } else {
      // If not JSON, treat raw as message
      messageText = raw;
    }

    const reply = await getAamoReply(sessionId, messageText);
    return res.status(200).json({ reply });
  } catch (err) {
    console.error("POST /aamo-chat error:", err);
    return res.status(200).json({ reply: "I’m here, ystävä. 💛" });
  }
});

// Optional: reset memory (useful if Aamo gets “stuck”)
// /aamo-reset?sessionId=session1
app.get("/aamo-reset", (req, res) => {
  const sessionId = (req.query.sessionId || "session1").toString();
  memory.delete(sessionId);
  return res.status(200).json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Aamo brain listening on port ${PORT}`);
});
