export class DiseaseDetectionPrompt {
  public static getDiseaseNameGettingPrompt(cropName: string, description?: string): string {
    return `You are an expert crop disease detector.
  
  Analyze the image of a ${cropName}. ${description ? `Context: ${description}` : ''}
  
  Respond with:
  - Only the disease name if detected.
  - NO_DISEASE_DETECTED if no disease is found.
  - ERROR_INVALID_IMAGE if the image is unclear, irrelevant, or does not contain a crop.
  
  Do not include any explanation or extra words. Reply with exact uppercase keywords only.`;
  }
}
