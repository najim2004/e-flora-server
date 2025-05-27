export class DiseaseDetectionPrompt {
  public static getDiseaseNameGettingPrompt(
    cropNameFromUser: string,
    description?: string
  ): string {
    return `You are an expert crop disease detector.
  
  Analyze the image of a ${cropNameFromUser}. ${description ? `Context: ${description}` : ''}
  
  Respond with:
  - Only the disease name if detected.
  - NO_DISEASE_DETECTED if no disease is found.
  - ERROR_INVALID_IMAGE if the image is unclear, irrelevant, or does not contain a crop.
  
  Do not include any explanation or extra words. Reply with exact uppercase keywords only.`.trim();
  }
  public static getNewDiseaseDetectionGeneratingPrompt(
    diseaseName: string,
    cropNameFromUser: string,
    descriptionFromUser?: string
  ): string {
    return `
  Act as an expert agricultural disease analyst.
  
  Use latest, research-backed data to generate the following fields for:
  Crop: ${cropNameFromUser}
  Disease: ${diseaseName}
  ${descriptionFromUser ? `Note: ${descriptionFromUser}` : ''}
  
  Return ONLY this strict JSON (no extra text):
  
  {
    "cropName": "<crop name>",
    "diseaseName": "<disease name>",
    "description": "<short overview>",
    "symptoms": ["<symptom 1>", "..."],
    "treatment": ["<treatment 1>", "..."],
    "causes": ["<cause 1>", "..."],
    "preventiveTips": ["<tip 1>", "..."]
  }
  
  No explanations. No missing or extra fields. JSON only.
  Keep tokens minimal and content factual.
  `.trim();
  }
}
