import Joi from 'joi';

export class DiseaseDetectionValidation {
  public static diseaseDetection = Joi.object({
    cropName: Joi.string().required().messages({
      'string.empty': `"cropName" is required`,
    }),
    description: Joi.string().optional(),
  });
}
