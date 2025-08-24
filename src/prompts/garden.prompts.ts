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
                "instructions": ["string", "string", ...] (required),
                "note": "string (optional)"
            }
        ]

        Guidelines:
            - Output must be valid JSON, without any extra text or commentary.
            - Each object should represent a distinct phase of the planting process (e.g., Soil Preparation, Sowing, Watering, Fertilization, Pest Management, Harvesting).
            - "instructions" must contain sequential steps. Add as many steps as required for successful cultivation of this crop.
            - Keep the descriptions concise, accurate, and actionable.
            - Do not invent irrelevant details; only use reliable agricultural knowledge.
            - Exclude anything outside the JSON.

        Crop Information:
            - Name: ${name}
            - Scientific Name: ${scientificName}
            ${description ? `- Description: ${description}` : ''}
        `.trim();
  }
}
