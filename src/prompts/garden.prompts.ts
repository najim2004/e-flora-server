export class GardenPrompts {
  public plantingGuideGeneratingPrompt(
    name: string,
    scientificName: string,
    description?: string
  ): string {
    return `
        You are a professional horticulture and agriculture research assistant.
        Your task is to research reliable sources (botanical references, agricultural guidelines, scientific papers, or trusted farming practices) about the crop below, and then generate a structured planting guide.

        Output Format (strict JSON only):
        [
            {
                "title": "string (required)",
                "description": "string (required)",
                "details": ["string", "string", ...] (required),
                "tips": "string (optional)"
            }
        ]

        Guidelines:
            - Output must be valid JSON, without any extra text or commentary.
            - Each object should represent a distinct, sequential step of the *initial planting process* (e.g., Soil Preparation, Seed Sowing/Transplanting, Initial Watering, Providing Initial Support).
            - "details" must contain sequential steps/instructions for that specific phase. Add as many steps as required for successful initial planting of this crop.
            - "tips" should provide a helpful hint or advice for that specific step.
            - Keep the descriptions concise, accurate, and actionable.
            - Do not invent irrelevant details; only use reliable agricultural knowledge.
            - Exclude anything outside the JSON.
            - Ensure the guide focuses ONLY on the planting phase, not ongoing cultivation.

        Crop Information:
            - Name: ${name}
            - Scientific Name: ${scientificName}
            ${description ? `- Description: ${description}` : ''}
        `.trim();
  }
}
