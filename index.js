const express = require("express");
const cors = require("cors");
const { Groq } = require("groq-sdk");

const app = express();
const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

// CORS (safe)
app.use(cors());
app.options("*", cors());

// SUPER TOLERANT BODY: accept anything as text, never auto-400 on JSON parse
app.use(express.text({ type: "*/*" }));

const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

// Health check
app.get("/", (req, res) => {
  res.status(200).send("Aamo brain is running 🦊 (Render tolerant AI mode)");
});

// IMPORTANT: a simple GET endpoint to test in browser
app.get("/aamo-chat", (req, res) => {
  res.status(200).send("Aamo chat endpoint is alive 🦊 (use POST to chat)");
});

app.post("/aamo-chat", async (req, res) => {
  // Always reply something, never 400
  try {
    const raw = (req.body ?? "").toString();

    let sessionId = "unknown";
    let messageText = raw;

    // Try to parse Construct Dictionary JSON or normal JSON
    try {
      const parsed = JSON.parse(raw);

      // Construct Dictionary.AsJSON format
      if (parsed?.c2dictionary && parsed?.data) {
        sessionId = parsed.data.sessionId || sessionId;
        messageText = parsed.data.message || messageText;
      }
      // Simple JSON format
      else if (parsed?.message || parsed?.sessionId) {
        sessionId = parsed.sessionId || sessionId;
        messageText = parsed.message || messageText;
      }
    } catch {
      // Not JSON = fine (plain text)
    }

    messageText = (messageText || "").toString().trim();
    if (!messageText) messageText = "…";

    // If key missing, still reply 200
    if (!groq) {
      return res
        .status(200)
        .type("text/plain")
        .send(`I can hear you, ystävä — but my cloud brain is offline right now. 💛`);
    }

    // AI reply
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
            "Respond directly to what the user said (no generic mismatched replies).",
        },
        { role: "user", content: messageText },
      ],
    });

    const aiReply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "I heard you, ystävä. Say that again for me?";

    return res.status(200).type("text/plain").send(aiReply);
  } catch (err) {
    // Even on failure: never 400, always 200
    console.error("Aamo error:", err);
    return res
      .status(200)
      .type("text/plain")
      .send("I’m here, ystävä. Something glitched, but you can try again. 💛");
  }
});

app.listen(PORT, () => {
  console.log(`Aamo brain listening on port ${PORT} (AI chat mode, c2dictionary-aware)`);
});
