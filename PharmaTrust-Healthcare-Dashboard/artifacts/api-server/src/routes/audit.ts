import { Router, type IRouter } from "express";
import Groq from "groq-sdk";
import {
  AuditPrescriptionBody,
  AuditPrescriptionResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/audit", async (req, res): Promise<void> => {
  const parsed = AuditPrescriptionBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid prescription audit request");
    res.status(400).json({ error: "extractedText is required and must be 12000 characters or fewer" });
    return;
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    req.log.error("GROQ_API_KEY is not configured");
    res.status(503).json({ error: "Groq AI is not configured" });
    return;
  }

  const systemPrompt = `You are an expert clinical pharmacology auditor. Output 2 concise bullet points: 1) Active salt breakdown, 2) Potential over-prescription warning or cost advisory. Keep response under 50 words.`;
  const userPrompt = `Analyze these extracted prescription items:\n${parsed.data.extractedText}`;

  try {
    const groq = new Groq({ apiKey });
    const models = [
      "llama-3.3-70b-versatile",
      "llama3-70b-8192",
      "llama-3.1-8b-instant",
    ];
    let text = "";
    let lastError: unknown;

    const runModel = async (model: string): Promise<string> => {
      const completion = await groq.chat.completions.create({
        model,
        temperature: 0.2,
        max_tokens: 120,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
      return completion.choices[0]?.message?.content?.trim() ?? "";
    };

    const tryModels = async (candidates: string[]) => {
      for (const model of candidates) {
        try {
          text = await runModel(model);
          if (text) return;
        } catch (error) {
          lastError = error;
          const isModelUnavailable =
            error instanceof Error &&
            (error.message.includes("model_not_found") ||
              error.message.includes("model_decommissioned"));
          if (!isModelUnavailable) return;
          req.log.warn({ model }, "Groq model unavailable; trying fallback");
        }
      }
    };

    await tryModels(models);

    if (!text) {
      try {
        const catalog = await groq.models.list();
        const excluded = /whisper|guard|safety|playai-tts|distil-whisper/i;
        const preferred = [
          "openai/gpt-oss-120b",
          "openai/gpt-oss-20b",
          "meta-llama/llama-4-scout-17b-16e-instruct",
          "qwen/qwen3-32b",
        ];
        const catalogIds = catalog.data
          .map((model) => model.id)
          .filter((model) => !excluded.test(model));
        const catalogFallbacks = [
          ...preferred.filter((model) => catalogIds.includes(model)),
          ...catalogIds.filter((model) => !preferred.includes(model)),
        ].filter((model) => !models.includes(model));
        await tryModels(catalogFallbacks);
      } catch (error) {
        lastError = error;
      }
    }

    if (!text) {
      req.log.error({ err: lastError }, "Groq returned no audit response");
      res.status(503).json({ error: "Groq prescription audit is temporarily unavailable" });
      return;
    }

    res.json(AuditPrescriptionResponse.parse({ text }));
  } catch (error) {
    req.log.error({ err: error }, "Groq prescription audit failed");
    res.status(503).json({ error: "Groq prescription audit is temporarily unavailable" });
  }
});

export default router;