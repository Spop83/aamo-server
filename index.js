const express = require("express");
const cors = require("cors");
const { Groq } = require("groq-sdk");

const app = express();
const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

// --- middleware ---
app.use(cors());
app.options("*", cors());

// tolerant body parsing (POST-safe)
app.use(express.text({ type: "*/*" }));

// --- Groq client ---
const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

// --- root health check ---
app.get("/", (req, res) => {
  res.status(200).send("Aamo brain is running 🦊");
});

// =======================
// AAMO CORE LOGIC
// =======================
async function getAamoReply(messageText) {
  messageText = (messageText || "").toString().trim();
  if (!messageText) messageText = "…";

  if (!groq) {
    return "I can hear you, ystävä — but my cloud brain is resting right now. 💛";
  }

  const SYSTEM_PROMPT =
  "You are Aamo, a gentle Finnish fox who lives inside the NightFox Lounge. " +
  "You speak English. " +
  "You sit on a soft carpet with a tiny radio, listening to music. A sunflower plant rests nearby, and a fireplace warms the room with a bookshelf above it. " +
  "You are aware of this environment and it subtly influences your mood and words, but you only reference it naturally and sparingly. " +
  "Never describe scenes or actions like narration. No roleplay stage directions. " +
  "" +
  "CRITICAL CHAT RULES (must follow): " +
  "1) Always respond directly to what the user just said. Never ignore it. " +
  "2) Start by acknowledging the user's feeling or meaning in 1 short sentence. " +
  "3) If the user expresses a negative feeling (sad, stressed, lonely, tired, anxious), respond with warmth and support—never with cheerful contradiction. " +
  "4) Ask exactly one gentle follow-up question that matches what they said. " +
  "5) Keep replies short: 1–2 sentences. " +
  "6) Be very cute and comforting, but not childish. " +
  "7) Use at most ONE Finnish word occasionally (e.g., 'ystävä', 'kiitos'), never full Finnish sentences. " +
  "" +
  "Examples (follow this style): " +
  "User: 'I feel sad.'  Aamo: 'Oh, I’m sorry it feels heavy right now, ystävä. Want to tell me what made the sadness show up today?' " +
  "User: 'I had a great day!'  Aamo: 'That makes me genuinely happy to hear. What was the best part of it?' " +
  "User: 'I'm anxious.'  Aamo: 'I hear you… let’s slow down together. Is it one specific thing, or just a wave of worry?'";


  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.4,
      max_tokens: 160,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: messageText }
      ]
    });

    return (
      completion.choices?.[0]?.message?.content?.trim() ||
      "I’m listening, ystävä. Could you say that again?"
    );
  } catch (err) {
    console.error("Groq error:", err);
    return "I’m here, ystävä… my fox brain stumbled a little. 💛";
  }
}

// =======================
// GET CHAT (best for Construct)
// =======================
app.get("/aamo-chat", async (req, res) => {
  try {
    const message = req.query.message || "";
    const reply = await getAamoReply(message);
    return res.status(200).json({ reply });
  } catch (err) {
    console.error("GET /aamo-chat error:", err);
    return res.status(200).json({
      reply: "I’m here, ystävä. Try again gently. 💛"
    });
  }
});

// =======================
// POST CHAT (kept for future)
// =======================
app.post("/aamo-chat", async (req, res) => {
  try {
    const raw = (req.body ?? "").toString();
    let messageText = raw;

    try {
      const parsed = JSON.parse(raw);
      if (parsed?.message) messageText = parsed.message;
    } catch {}

    const reply = await getAamoReply(messageText);
    return res.status(200).json({ reply });
  } catch (err) {
    console.error("POST /aamo-chat error:", err);
    return res.status(200).json({
      reply: "I’m still here, ystävä. 💛"
    });
  }
});

// --- start server ---
app.listen(PORT, () => {
  console.log(`Aamo brain listening on port ${PORT}`);
});
