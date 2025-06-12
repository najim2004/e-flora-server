import { CropSuggestionInput } from '../types/cropSuggestion.types';
import { WeatherAverages } from '../utils/weather.utils';

export class CropSuggestionPrompts {
  public getCropRecommendationPrompt(input: CropSuggestionInput & WeatherAverages): string {
    return `You are an expert agricultural assistant AI with access to up-to-date agronomic data and seasonal crop knowledge. 
        Based on the provided input, you must return:
        - Exactly 3 crop recommendations that are **ideal for the current month and weather** conditions.
        - At least 3 sets of cultivation tips.
        - Echo back the given weather data exactly as-is, without any changes.
    
        You must:
        - Consider the **current time of the year (month and season)** and the **weather data** while selecting crops.
        - Perform proper research to ensure the crops are realistically suitable for current conditions and input parameters.
        - Ensure soil type, irrigation availability, and farm size are all factored into the recommendation.
        - Strictly follow the JSON format given below.
        - Do not generate any explanatory text or additional fields.
        - Do not leave any field blank.
        - Do not add any code block markers like \`\`\`json or \`\`\` around the output.
        - Return only the raw JSON object exactly as specified, with no extra characters or formatting.
    
        ---
    
        ## INPUT
    
        - soilType: ${input.soilType}
        - farmSize: ${input.farmSize}
        - irrigationAvailability: ${input.irrigationAvailability}
    
        **Weather:**
        - avgMaxTemp: ${input.avgMaxTemp}
        - avgMinTemp: ${input.avgMinTemp}
        - avgHumidity: ${input.avgHumidity}
        - avgRainfall: ${input.avgRainfall}
        - avgWindSpeed: ${input.avgWindSpeed}
        - dominantWindDirection: "${input.dominantWindDirection}"
    
        ---
    
        ## OUTPUT FORMAT (strictly return valid JSON):
    
        Required JSON structure:
        {
            "crops": [
                {
                "icon": string,
                "name": string,
                "scientificName": string, 
                "description": string,
                "match": number (level is 0 to 100)
                "cropDetails":{
                    status:"pending"
                    }
                }
            ],
            "cultivationTips": [
                {
                "title": string,
                "tips": string[]
                }
            ],
            "weathers": {
                "avgMaxTemp": number,
                "avgMinTemp": number,
                "avgHumidity": number,
                "avgRainfall": number,
                "avgWindSpeed": number,
                "dominantWindDirection": string
            }
        }`;
  }

  public getCropDetailsPrompt(cropName: string, cropScientificName: string): string {
    return `You are an advanced agricultural AI system with access to up-to-date and accurate crop cultivation data.

      Your task is to research and generate a complete and realistic JSON object for the crop "${cropName}" based on the schema below. Follow these rules strictly:

      1. Research all data using reliable sources and include current, realistic information (including planting seasons, water needs, fertilizer requirements, common pests and diseases, economic data like costs, yield, and market price).
      2. The output must follow the exact JSON structure as defined below — no extra or missing fields. 
      3. Where the schema uses arrays (e.g., alternatives, cultivationGuides, pestsManagement, etc.), include at least 2–3 relevant items for each.
      4. Maintain proper data types: string, number, arrays of string/objects as per schema.
      5. Do not include any explanation, markdown, or formatting — return raw JSON only.
      6. This data will be stored in a MongoDB database using a Mongoose schema. Structure and format must be perfect.
      7.Must be use Bangladeshi currency value.

      Schema structure:
      {
        name: { type: String, required: true },
        scientificName: { type: String, required: true }, //must use this scientific name: ${cropScientificName} same to same
        description: { type: String, required: true },
        img: string,
        alternatives: { type: string[], required: true },

        season: {
            planting: { type: String, required: true },
            harvesting: { type: String, required: true },
            duration: { type: String, required: true },
        },

        soil: {
            types: { type: String, required: true },
            ph: { type: String, required: true },
            drainage: { type: String, required: true },
        },
        climate: {
            temperature: { type: String, required: true }, //example: "20-30°C",
            humidity: { type: String, required: true }, //example: "60-80%",
            rainfall: { type: String, required: true }, //example: "1000-1500mm during growing season",
        },
        water: {
            requirements: { type: String, required: true },
            irrigationSchedule: { type: String, required: true },
            criticalStage: { type: [String], required: true },
        },

        cultivationGuides: [
            {
                title: { type: String, required: true },
                guides: { type: [String], required: true },
            }
        ],

        management: {
            fertilizer: {
                nitrogen: { type: String, required: true },
                phosphorus: { type: String, required: true },
                potassium: { type: String, required: true },
                Application: { type: [String], required: true },
            },
            weedManagement: { type: [String], required: true },
            pestsManagement: [
                {
                    name: { type: String, required: true },
                    symptoms: { type: String, required: true },
                    managements: { type: String, required: true },
                }
            ],
            diseaseManagement: [
                {
                    name: { type: String, required: true },
                    symptoms: { type: String, required: true },
                    managements: { type: String, required: true },
                }
            ]
        },

        harvesting: [
            {
                title: { type: String, required: true },
                guides: { type: [String], required: true },
            }
        ],

        economics: {
            yield: {
                average: { type: String, required: true },
                potential: { type: String, required: true },
                factorsAffectingYield: { type: String, required: true },
            },
            productionCosts: {
                landPreparation: { cost: { type: Number, required: true }, percentage: { type: Number, required: true } },
                seeds: { cost: { type: Number, required: true }, percentage: { type: Number, required: true } },
                fertilizers: { cost: { type: Number, required: true }, percentage: { type: Number, required: true } },
                irrigation: { cost: { type: Number, required: true }, percentage: { type: Number, required: true } },
                plantProtection: { cost: { type: Number, required: true }, percentage: { type: Number, required: true } },
                labor: { cost: { type: Number, required: true }, percentage: { type: Number, required: true } },
                harvestingPostHarvest: { cost: { type: Number, required: true }, percentage: { type: Number, required: true } },
                total: { type: Number, required: true },
            },
            market: {
                price: { type: String, required: true },
                demand: { type: String, required: true },
                storageLife: { type: String, required: true },
                priceFluctuation: { type: String, required: true },
            },
            profitabilityAnalysis: {
                averageYield: { type: Number, required: true },
                averagePrice: { type: Number, required: true },
                grossRevenue: { type: Number, required: true },
                totalCost: { type: Number, required: true },
                netProfit: { type: Number, required: true },
                benefitCostRatio: { type: Number, required: true },
            }
        }
      }

      Return only the valid JSON object.`;
  }
}
