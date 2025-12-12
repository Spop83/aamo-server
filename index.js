const express = require("express");
const cors = require("cors");
const { Groq } = require("groq-sdk");

const app = express();
const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

// CORS + OPTIONS (important for browsers/webviews)
app.use(cors());
app.options("*", cors());

// SUPER TOLERANT BODY PARSING:
// We intentionally DO NOT use express.json() because it can throw 400 on bad JSON.
// We accept everything as TEXT and then parse ourselves.
app.use(express.text({ type: "*/*" }));

const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

app.get("/", (req, res) => {
  res.status(200).send("Aamo brain is running 🦊 (Render tolerant JSON mode)");
});

// Helpful browser test
app.get("/aamo-chat", (req, res) => {
  res.status(200).json({ reply: "Aamo chat endpoint is alive 🦊 (POST to chat)" });
});

app.post("/aamo-chat", async (req, res) => {
  // Never allow a 400 response from this endpoint.
  try {
    const raw = (req.body ?? "").toString();

    let sessionId = "unknown";
    let messageText = "";

    // Try parse JSON (works for both your manual JSON and Construct dictionary JSON)
    try {
      const parsed = JSON.parse(raw);

      // Construct Dictionary.AsJSON format:
      // {"c2dictionary":true,"data":{"sessionId":"...","message":"..."}}
      if (parsed?.c2dictionary && parsed?.data) {
        sessionId = parsed.data.sessionId || sessionId;
        messageText = parsed.data.message || "";
      }
      // Normal JSON format:
      // {"sessionId":"...","message":"..."}
      else {
        sessionId = parsed.sessionId || sessionId;
        messageText = parsed.message || "";
      }
    } catch {
      // Not JSON? Treat raw body as the message
      messageText = raw;
    }

    messageText = (messageText || "").toString().trim();
    if (!messageText) messageText = "…";

    // If Groq key missing, still return valid JSON
    if (!groq) {
      return res.status(200).json({
        reply: "I can hear you, ystävä — but my cloud brain is offline right now. 💛",
      });
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
            "Speak like a supportive friend. No narration or action descriptions. " +
            "Replies are short: 1–2 sentences. " +
            "Use Finnish words sparingly (like 'ystävä', 'kiitos') and NEVER full Finnish sentences. " +
            "Respond directly to what the user said.",
        },
        { role: "user", content: messageText },
      ],
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "I heard you, ystävä. Say that again for me?";

    return res.status(200).json({ reply });
  } catch (err) {
    console.error("Aamo error:", err);
    // Even on error, still return 200 with JSON
    return res.status(200).json({
      reply: "I’m here, ystävä. Something glitched — try again. 💛",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Aamo brain listening on port ${PORT} (tolerant JSON mode)`);
});
