import Joi from 'joi';

export class GardenValidation {
  public static addToGarden = Joi.object({
    id: Joi.string().alphanum().length(24).required().messages({
      'string.alphanum': 'id must be a alphanumeric string',
      'string.length': 'id must be 24 characters long',
      'any.required': 'id is required',
    }),
  });
}
