import Joi from 'joi';

export class DiseaseDetectionValidation {
  public static diseaseDetection = Joi.object({
    mode: Joi.string().valid('MANUAL', 'GARDEN_CROP').required(),
    description: Joi.string().allow('', null).optional(),
    cropName: Joi.when('mode', {
      is: 'MANUAL',
      then: Joi.string().required().messages({
        'string.empty': 'cropName is required for MANUAL mode',
        'any.required': 'cropName is required for MANUAL mode',
      }),
      otherwise: Joi.forbidden(),
    }),
    gardenCropId: Joi.when('mode', {
      is: 'GARDEN_CROP',
      then: Joi.string().required().messages({
        'string.empty': 'gardenCropId is required for GARDEN_CROP mode',
        'any.required': 'gardenCropId is required for GARDEN_CROP mode',
      }),
      otherwise: Joi.forbidden(),
    }),
  });
  public static resultParam = Joi.object({
    id: Joi.string().alphanum().length(24).required().messages({
      'string.alphanum': 'id must be a alphanumeric string',
      'string.length': 'id must be 24 characters long',
      'any.required': 'id is required',
    }),
  });
  public static historiesQuery = Joi.object({
    page: Joi.number().integer().default(1).messages({
      'number.integer': 'page must be an integer',
      'number.default': 'page default value is 1',
    }),
    limit: Joi.number().integer().default(10).messages({
      'number.integer': 'limit must be an integer',
      'number.default': 'limit default value is 10',
    }),
  });
}
