import Joi from 'joi';

export class CropSuggestionValidation {
  public static cropSuggestion = Joi.object({
    locations: Joi.object({
      latitude: Joi.number().required().message('Latitude is required'),
      longitude: Joi.number().required().message('Longitude is required'),
    })
      .required()
      .messages({
        'any.required': 'Location is required',
      }),
    soilType: Joi.string().min(3).required().messages({
      'string.min': 'Please provide a valid soil type',
      'any.required': 'Soil type is required',
    }),
    farmSize: Joi.number().greater(0).required().messages({
      'number.greater': 'Please provide a valid farm size',
      'any.required': 'Farm size is required',
    }),
    irrigationAvailability: Joi.string().min(3).required().messages({
      'string.min': 'Please provide a valid irrigation availability',
      'any.required': 'Irrigation availability size is required',
    }),
  });
}
