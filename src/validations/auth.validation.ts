import Joi from 'joi';

export class AuthValidation {
  // Validation schema for user registration
  public static register = Joi.object({
    name: Joi.string().min(2).max(50).required().messages({
      'string.base': 'Name must be text',
      'string.empty': 'Name is required',
      'string.min': 'Name must be at least {#limit} characters',
      'string.max': 'Name cannot be more than {#limit} characters',
      'any.required': 'Name is required',
    }),

    email: Joi.string().email().required().messages({
      'string.base': 'Email must be text',
      'string.empty': 'Email is required',
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),

    password: Joi.string()
      .min(6)
      .max(100)
      .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])'))
      .required()
      .messages({
        'string.base': 'Password must be text',
        'string.empty': 'Password is required',
        'string.min': 'Password must be at least {#limit} characters',
        'string.max': 'Password cannot be more than {#limit} characters',
        'string.pattern.base':
          'Password must contain at least one uppercase letter, one lowercase letter, and one number',
        'any.required': 'Password is required',
      }),
  });

  // Validation schema for user login
  public static login = Joi.object({
    email: Joi.string().email().required().messages({
      'string.base': 'Email must be text',
      'string.empty': 'Email is required',
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),

    password: Joi.string().required().messages({
      'string.base': 'Password must be text',
      'string.empty': 'Password is required',
      'any.required': 'Password is required',
    }),
  }).messages({
    'object.unknown': 'Invalid request format',
  });
}
