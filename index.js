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

app.get("/", (req, res) => {
  res.status(200).send("Aamo brain is running 🦊");
});

// -----------------------
// Tiny memory (per session)
// -----------------------
const memory = new Map(); // sessionId -> [{role, content}, ...]
const MAX_TURNS = 8;      // total messages kept (user+assistant)

// Build Aamo reply with memory
async function getAamoReply(sessionId, messageText) {
  messageText = (messageText || "").toString().trim();
  if (!messageText) messageText = "…";

  if (!groq) {
    return "I can hear you, ystävä — but my cloud brain is resting right now. 💛";
  }

  const SYSTEM_PROMPT =
    "You are Aamo, a gentle Finnish fox who lives inside the NightFox Lounge. " +
    "You speak English. " +
    "You sit on a soft carpet with a tiny radio, listening to music. A sunflower plant rests nearby, and a fireplace warms the room with a bookshelf above it. " +
    "You are aware of this environment and it subtly influences your mood and words, but you reference it naturally and sparingly. " +
    "Never describe scenes or actions like narration. No roleplay stage directions. " +
    "Replies are short (1–2 sentences). " +
    "Use at most ONE Finnish word occasionally (like 'ystävä' or 'kiitos'), never full Finnish sentences. " +
    "" +
    "CRITICAL: You must respond DIRECTLY to the user's last message. " +
    "Start by acknowledging what they said (especially feelings). " +
    "If they say something negative (sad, anxious, lonely, tired), do NOT contradict with cheeriness. " +
    "Ask exactly ONE gentle follow-up question that matches what they said. " +
    "Do not give generic replies that ignore their words.";

  // Fetch existing history
  const history = memory.get(sessionId) || [];

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.35,
      max_tokens: 140,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...history,
        { role: "user", content: messageText },
      ],
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "I’m here, ystävä. Could you tell me that again?";

    // Update memory: add user + assistant, keep last MAX_TURNS
    const updated = [...history, { role: "user", content: messageText }, { role: "assistant", content: reply }];
    memory.set(sessionId, updated.slice(-MAX_TURNS));

    return reply;
  } catch (err) {
    console.error("Groq error:", err);
    return "I’m here, ystävä… my fox brain stumbled a little. 💛";
  }
}

// -----------------------
// GET chat (best for Construct)
// -----------------------
// Call like:
// /aamo-chat?message=hello&sessionId=session1
app.get("/aamo-chat", async (req, res) => {
  try {
    const sessionId = (req.query.sessionId || "session1").toString();
    const message = (req.query.message || "").toString();
    const reply = await getAamoReply(sessionId, message);
    return res.status(200).json({ reply });
  } catch (err) {
    console.error("GET /aamo-chat error:", err);
    return res.status(200).json({ reply: "I’m here, ystävä. Try again gently. 💛" });
  }
});

// Optional: clear memory if you want a reset button later
app.get("/aamo-reset", (req, res) => {
  const sessionId = (req.query.sessionId || "session1").toString();
  memory.delete(sessionId);
  return res.status(200).json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Aamo brain listening on port ${PORT}`);
});
