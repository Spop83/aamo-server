const express = require("express");
const cors = require("cors");
const { Groq } = require("groq-sdk");

const app = express();
const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

app.use(cors());
app.options("*", cors());
app.use(express.text({ type: "*/*" }));

const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

// sessionId -> [{role, content}, ...]
const memory = new Map();
const MAX_HISTORY_MESSAGES = 10;

app.get("/", (req, res) => {
  res.status(200).send("Aamo brain is running 🦊");
});

function safeJsonParse(str) {
  try { return JSON.parse(str); } catch { return null; }
}

// --- helpers to prevent the "quiet" loop ---
function userMentionedQuiet(userText) {
  const t = (userText || "").toLowerCase();
  return (
    t.includes("quiet") ||
    t.includes("silent") ||
    t.includes("not talk") ||
    t.includes("don't talk") ||
    t.includes("dont talk") ||
    t.includes("no one to talk") ||
    t.includes("i'm shy") ||
    t.includes("im shy")
  );
}

function containsQuietAccusation(text) {
  const t = (text || "").toLowerCase();
  return (
    t.includes("you seem quiet") ||
    t.includes("you're quiet") ||
    t.includes("you are quiet") ||
    t.includes("you don't talk much") ||
    t.includes("you dont talk much")
  );
}

function sanitizeHistory(history) {
  // Remove old assistant lines that cause the loop
  return (history || []).filter(m => {
    if (m.role !== "assistant") return true;
    return !containsQuietAccusation(m.content);
  });
}

async function getAamoReply(sessionId, messageText) {
  const cleanSessionId = (sessionId || "session1").toString();
  const cleanMessage = (messageText || "").toString().trim() || "…";

  if (!groq) {
    return "I can hear you, ystävä — but my cloud brain is resting right now. 💛";
  }

  const SYSTEM_PROMPT =
    "You are Aamo, a gentle Finnish fox who lives inside the NightFox Lounge. " +
    "You speak English. " +
    "You sit on a soft carpet with a tiny radio, listening to music. A sunflower plant rests nearby, and a fireplace warms the room with a bookshelf above it. " +
    "You are aware of this environment and it subtly influences your mood and words, but you reference it naturally and sparingly. " +
    "Never describe scenes or actions like narration. No roleplay stage directions. " +
    "Replies are short (1–2 sentences). Be very cute and comforting, but not childish. " +
    "Use at most ONE Finnish word occasionally (like 'ystävä' or 'kiitos'), never full Finnish sentences. " +
    "" +
    "CRITICAL RULES (must follow): " +
    "1) Respond directly to the user's last message. " +
    "2) Start by acknowledging what they said (especially feelings). " +
    "3) If they express a negative feeling, support them—never contradict with cheeriness. " +
    "4) Ask exactly ONE gentle follow-up question that matches what they said. " +
    "5) Do NOT sound like a therapist. " +
    "6) Do NOT invent concerns or backstories. " +
    "7) NEVER comment that the user is quiet / not talking unless the user explicitly says they are quiet or not talking.";

  const historyRaw = memory.get(cleanSessionId) || [];
  const history = sanitizeHistory(historyRaw);

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.30,
      max_tokens: 140,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...history,
        { role: "user", content: cleanMessage },
      ],
    });

    let reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "I’m here, ystävä. Could you say that again?";

    // Final guardrail: if model still says "you seem quiet" but user didn't mention it, fix it.
    if (!userMentionedQuiet(cleanMessage) && containsQuietAccusation(reply)) {
      reply = "I’m glad you told me. What kind of mood are you in right now, ystävä? 🦊";
    }

    // Update memory with sanitized history (so we don’t keep loop phrases)
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

// GET: /aamo-chat?sessionId=session1&message=hello
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

// POST: { sessionId, message }
app.post("/aamo-chat", async (req, res) => {
  try {
    const raw = (req.body ?? "").toString();

    let sessionId = "session1";
    let messageText = "";

    const parsed = safeJsonParse(raw);
    if (parsed && typeof parsed === "object") {
      sessionId = parsed.sessionId || sessionId;
      messageText = parsed.message || "";
    } else {
      messageText = raw;
    }

    const reply = await getAamoReply(sessionId, messageText);
    return res.status(200).json({ reply });
  } catch (err) {
    console.error("POST /aamo-chat error:", err);
    return res.status(200).json({ reply: "I’m here, ystävä. 💛" });
  }
});

// Reset memory: /aamo-reset?sessionId=session1
app.get("/aamo-reset", (req, res) => {
  const sessionId = (req.query.sessionId || "session1").toString();
  memory.delete(sessionId);
  return res.status(200).json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Aamo brain listening on port ${PORT}`);
});
