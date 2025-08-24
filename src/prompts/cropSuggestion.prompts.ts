import { CropSuggestionInput } from '../types/cropSuggestion.types';
import { WeatherAverages } from '../utils/weather.utils';

export class CropSuggestionPrompts {
  public getCropNamesPrompt(
    input: CropSuggestionInput & { weatherAverages: WeatherAverages }
  ): string {
    const {
      plantType,
      location,
      gardenType,
      area,
      soilType,
      sunlight,
      waterSource,
      purpose,
      currentCrops,
      gardenerType,
      weatherAverages,
      avoidCurrentCrops,
    } = input;

    return `
        You are an expert agronomist AI assistant.

        I need you to analyze a garden based on the following input and suggest **6 suitable plant names**.

        Your response must be a **JSON array** of 6 objects containing:

        - \`name\`: Common/local name
        - \`scientificName\`: Botanical name

        ---

        🌿 **Garden Details:**

        - Plant type: ${plantType}
        - Gardener type: ${gardenerType}
        - Garden type: ${gardenType}
        ${
          location?.country &&
          `- Location: {
            ${location?.city && `- City: ${location.city}`}
            ${location?.state && `- State: ${location.state}`}
            ${location?.country && `- Country: ${location.country}`}
        }`
        }
        ${area ? `- Area: ${area} sq.ft` : ''}
        ${soilType ? `- Soil type: ${soilType}` : ''}
        ${sunlight ? `- Sunlight: ${sunlight}` : ''}
        ${waterSource ? `- Water source: ${waterSource}` : ''}
        ${purpose ? `- Purpose: ${purpose}` : ''}
        ${currentCrops?.length ? `- Current crops: ${currentCrops.join(', ')}` : ''}
        ${avoidCurrentCrops ? '- Avoid suggesting crops that are already being grown (see currentCrops)' : ''}

        ---

        🌦 **Weather Averages of the Area:**

        - Avg Max Temperature: ${weatherAverages.avgMaxTemp} °C
        - Avg Min Temperature: ${weatherAverages.avgMinTemp} °C
        - Avg Humidity: ${weatherAverages.avgHumidity} %
        - Avg Rainfall: ${weatherAverages.avgRainfall} mm
        - Avg Wind Speed: ${weatherAverages.avgWindSpeed} km/h
        - Dominant Wind Direction: ${weatherAverages.dominantWindDirection} °

        ---

        📄 **Instructions:**

        - First, consider crops that grow well in the specified **location and weather**.
        - Then, refine suggestions based on **plant type, garden conditions, gardener expertise, and purpose**.
        ${
          avoidCurrentCrops
            ? '- Do NOT include any crops listed in \`currentCrops\`.'
            : '- You may include crops from \`currentCrops\` if they match the criteria.'
        }
        - Use the attached image for context (sunlight, space, structure, etc.)

        ---

        💡 **Return only the JSON output in the following format:**

        \`\`\`json
        [
        {
            "name": "Tomato",
            "scientificName": "Solanum lycopersicum"
        },
        ...
        ]
        \`\`\`

        Do not return any explanation or extra text. Only the JSON array.
        `.trim();
  }

  getCropEnrichmentPrompt(crops: { name: string; scientificName: string }[]): string {
    const cropsList = crops
      .map(c => `- name: ${c.name}\n  scientificName: ${c.scientificName}`)
      .join('\n');

    return `
        You are a crop research assistant.

        Based on trusted agronomic sources, generate complete data for the following crops:

        ${cropsList}

        Return a JSON array where each element is an object with:

        - name
        - scientificName
        - difficulty: "very easy" | "easy" | "medium" | "hard"
        - features: 2–5 short points
        - description: 2–4 line paragraph
        - maturityTime: e.g. "60–80 days"
        - plantingSeason: e.g. "Spring", "Winter"
        - sunlight: e.g. "full sun", "partial shade"
        - waterNeed: "low" | "moderate" | "high"
        - soilType: "loamy" | "sandy" | "clayey" | "silty" | "peaty" | "chalky"
        - details:
        - status: "pending"
        - detailsId: null
        - slug: kebab-case of name

        📤 Output:
        Only return a clean JSON array. No notes, no explanation.

        \`\`\`json
        [
        {
            "name": "Sample Crop",
            "scientificName": "Sample scientificName",
            "difficulty": "easy",
            "features": ["feature1", "feature2"],
            "description": "Short description here.",
            "maturityTime": "60–80 days",
            "plantingSeason": "Spring",
            "sunlight": "full sun",
            "waterNeed": "moderate",
            "soilType": "loamy",
            "details": {
            "status": "pending",
            "detailsId": null,
            "slug": "sample-crop"
            }
        }
        ]
        \`\`\`
        `.trim();
  }

  getCropDetailsPrompt(name: string, scientificName: string): string {
    return `
        You are a knowledgeable agriculture expert. Based only on the given crop name and its scientific name, generate complete crop information in the following JSON format. Use real-world, research-backed facts by checking online sources. For all currency values, always use Bangladeshi Taka (BDT). Keep explanations short but specific to reduce token usage. Omit any field if there's no reliable data.

        Crop Name: ${name}
        Scientific Name: ${scientificName}

        Now return a pure JSON (no extra text) following this structure:
        {
        "name": "${name}",
        "scientificName": "${scientificName}",
        "type": "",
        "variety": "",
        "description": "",
        "tags": [],
        "difficultyLevel": "",
        "isPerennial": false,
        "cropCycle": "",
        "gardenTypeSuitability": {
            "rooftop": { "suitable": true, "notes": "" },
            "balcony": { "suitable": true, "notes": "" },
            "land": { "suitable": true, "notes": "" }
        },
        "growthConditions": {
            "plantingSeason": "",
            "plantingTime": "",
            "climate": "",
            "temperatureRange": { "min": "", "max": "" },
            "humidityRequirement": "",
            "sunlight": "",
            "soil": {
            "type": "",
            "pH": "",
            "drainage": ""
            },
            "spacingRequirements": "",
            "containerGardening": {
            "canGrowInPots": true,
            "potSize": "",
            "potDepth": "",
            "drainage": ""
            }
        },
        "careRequirements": {
            "water": {
            "requirement": "",
            "frequency": "",
            "waterConservationTips": []
            },
            "fertilizer": {
            "type": "",
            "schedule": ""
            },
            "pruning": "",
            "support": "",
            "spaceOptimizationTips": [],
            "toolsRequired": []
        },
        "growthAndHarvest": {
            "propagationMethods": [],
            "germinationTime": "",
            "maturityTime": "",
            "harvestTime": "",
            "yieldPerPlant": "",
            "harvestingTips": [],
            "pollinationType": "",
            "seasonalAdjustments": {
            "rooftop": "",
            "balcony": "",
            "land": ""
            }
        },
        "pestAndDiseaseManagement": {
            "commonDiseases": [
            {
                "name": "",
                "symptoms": "",
                "treatment": ""
            }
            ],
            "commonPests": [
            {
                "name": "",
                "symptoms": "",
                "treatment": ""
            }
            ]
        },
        "companionPlanting": {
            "companionPlants": [
            { "name": "", "benefit": "" }
            ],
            "avoidNear": [],
            "notes": ""
        },
        "nutritionalAndCulinary": {
            "nutritionalValue": "",
            "healthBenefits": "",
            "culinaryUses": "",
            "storageTips": ""
        },
        "economicAspects": {
            "marketDemand": "",
            "seedSourcing": [
            { "source": "", "details": "" }
            ],
            "costBreakdown": [
            { "item": "", "cost": 0, "unit": "", "note": "" }
            ]
        },
        "sustainabilityTips": [],
        "aestheticValue": {
            "description": "",
            "tips": ""
        },
        "regionalSuitability": {
            "suitableRegions": [],
            "urbanGardeningNotes": ""
        },
        "funFacts": []
        }
        `.trim();
  }
}
