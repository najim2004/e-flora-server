import Joi from 'joi';

export class UpdateUserValidation {
  public static update = Joi.object({
    name: Joi.string().optional(),
    occupation: Joi.string().optional(),
    location: Joi.string().optional(),
    phoneNumber: Joi.string().optional(),
    gender: Joi.string().optional(),
    dateOfBirth: Joi.date().optional(),
  });
}
