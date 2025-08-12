import Joi from 'joi';

export class CropSuggestionValidation {
  public static cropSuggestion = Joi.object({
    plantType: Joi.array()
      .items(Joi.string().valid('vegetable', 'fruit', 'flower', 'herb', 'tree', 'ornamental'))
      .min(1)
      .required()
      .messages({
        'any.only': 'Please provide a valid plant type',
        'any.required': 'Plant type is required',
      }),
    mode: Joi.string().valid('manual', 'auto').required().messages({
      'any.only': 'Mode must be manual or auto',
      'any.required': 'Mode is required',
    }),

    gardenId: Joi.when('mode', {
      is: 'auto',
      then: Joi.string().required().messages({
        'any.required': 'Garden ID is required in auto mode',
      }),
      otherwise: Joi.forbidden(),
    }),
    avoidCurrentCrops: Joi.when('mode', {
      is: 'auto',
      then: Joi.boolean().required().messages({
        'any.required': 'Avoid current crops flag is required in auto mode',
      }),
      otherwise: Joi.forbidden(),
    }),

    // Location required only in manual mode
    location: Joi.when('mode', {
      is: 'manual',
      then: Joi.object({
        latitude: Joi.number().required().messages({
          'any.required': 'Latitude is required',
          'number.base': 'Latitude must be a number',
        }),
        longitude: Joi.number().required().messages({
          'any.required': 'Longitude is required',
          'number.base': 'Longitude must be a number',
        }),
        country: Joi.string().min(2).required().messages({
          'string.min': 'Country name is too short',
          'any.required': 'Country is required',
        }),
        state: Joi.string().min(2).required().messages({
          'string.min': 'State name is too short',
          'any.required': 'State is required',
        }),
        city: Joi.string().min(2).required().messages({
          'string.min': 'City name is too short',
          'any.required': 'City is required',
        }),
      })
        .required()
        .messages({
          'any.required': 'Location information is required in manual mode',
        }),
      otherwise: Joi.forbidden(),
    }),

    soilType: Joi.when('mode', {
      is: 'manual',
      then: Joi.string()
        .valid('loamy', 'sandy', 'clayey', 'silty', 'peaty', 'chalky', 'unknown')
        .required()
        .messages({
          'any.only': 'Please provide a valid soil type',
          'any.required': 'Soil type is required',
        }),
      otherwise: Joi.forbidden(),
    }),

    area: Joi.when('mode', {
      is: 'manual',
      then: Joi.number().greater(0).required().messages({
        'number.greater': 'Please provide a valid garden area greater than 0',
        'any.required': 'Garden area is required',
      }),
      otherwise: Joi.forbidden(),
    }),

    waterSource: Joi.when('mode', {
      is: 'manual',
      then: Joi.string()
        .valid('tube-well', 'tap', 'rainwater', 'storage', 'manual', 'uncertain', 'unknown')
        .required()
        .messages({
          'any.only': 'Please provide a valid water source',
          'any.required': 'Water source is required',
        }),
      otherwise: Joi.forbidden(),
    }),

    purpose: Joi.when('mode', {
      is: 'manual',
      then: Joi.string().valid('eat', 'sell', 'decor', 'educational', 'mixed').required().messages({
        'any.only': 'Please provide a valid purpose',
        'any.required': 'Purpose is required',
      }),
      otherwise: Joi.forbidden(),
    }),

    sunlight: Joi.when('mode', {
      is: 'manual',
      then: Joi.string().valid('full', 'partial', 'shade').required().messages({
        'any.only': 'Please provide a valid sunlight exposure',
        'any.required': 'Sunlight exposure is required',
      }),
      otherwise: Joi.forbidden(),
    }),

    currentCrops: Joi.when('mode', {
      is: 'manual',
      then: Joi.array().items(Joi.string().min(2)).optional().messages({
        'string.min': 'Each crop name should be at least 2 characters',
      }),
      otherwise: Joi.forbidden(),
    }),
    gardenType: Joi.when('mode', {
      is: 'manual',
      then: Joi.string()
        .valid('rooftop', 'balcony', 'backyard', 'indoor', 'terrace', 'field')
        .required()
        .messages({
          'any.only': 'Please provide a valid garden type',
          'any.required': 'Garden type is required',
        }),
      otherwise: Joi.forbidden(),
    }),
    gardenerType: Joi.when('mode', {
      is: 'manual',
      then: Joi.string().valid('beginner', 'intermediate', 'expert').required().messages({
        'any.only': 'Please provide a valid gardener type',
        'any.required': 'Gardener type is required',
      }),
      otherwise: Joi.forbidden(),
    }),
  });
}
