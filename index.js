const express = require("express");
const cors = require("cors");
const { Groq } = require("groq-sdk");

const app = express();
const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

app.use(cors());
app.options("*", cors());

// Keep tolerant parsing for POST (but we’ll use GET from Construct)
app.use(express.text({ type: "*/*" }));

const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

app.get("/", (req, res) => {
  res.status(200).send("Aamo brain is running 🦊 (GET+POST chat mode)");
});

// Shared “talk to Aamo”
async function getAamoReply(messageText) {
  messageText = (messageText || "").toString().trim();
  if (!messageText) messageText = "…";

  if (!groq) {
    return "I can hear you, ystävä — but my cloud brain is offline right now. 💛";
  }

  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    temperature: 0.7,
    max_tokens: 160,
    messages: [
      {
        role: "system",
        content:
          "You are Aamo, a gentle Finnish fox who chats warmly and simply. " +
          "No narration or action descriptions. Replies are short: 1–2 sentences. " +
          "Use Finnish words sparingly (like 'ystävä', 'kiitos') and NEVER full Finnish sentences. " +
          "Respond directly to what the user said.",
      },
      { role: "user", content: messageText },
    ],
  });

  return (
    completion.choices?.[0]?.message?.content?.trim() ||
    "I heard you, ystävä. Say that again for me?"
  );
}

// ✅ GET chat (best for Construct reliability)
app.get("/aamo-chat", async (req, res) => {
  try {
    const message = req.query.message || "";
    const reply = await getAamoReply(message);
    return res.status(200).json({ reply });
  } catch (err) {
    console.error("GET /aamo-chat error:", err);
    return res.status(200).json({ reply: "I’m here, ystävä. Try again. 💛" });
  }
});

// POST chat (kept for future)
app.post("/aamo-chat", async (req, res) => {
  try {
    const raw = (req.body ?? "").toString();
    let messageText = raw;

    try {
      const parsed = JSON.parse(raw);
      if (parsed?.c2dictionary && parsed?.data) {
        messageText = parsed.data.message || messageText;
      } else if (parsed?.message) {
        messageText = parsed.message || messageText;
      }
    } catch {}

    const reply = await getAamoReply(messageText);
    return res.status(200).json({ reply });
  } catch (err) {
    console.error("POST /aamo-chat error:", err);
    return res.status(200).json({ reply: "I’m here, ystävä. Try again. 💛" });
  }
});

app.listen(PORT, () => {
  console.log(`Aamo brain listening on port ${PORT} (GET+POST chat mode)`);
});
