import Joi from 'joi';

export class DiseaseDetectionValidation {
  public static diseaseDetection = Joi.object({
    cropName: Joi.string().required().messages({
      'string.empty': `"cropName" is required`,
    }),
    description: Joi.string().allow('', null).optional(),
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
