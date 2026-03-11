import Joi from 'joi';

export const updateProfileSchema = Joi.object({
    full_name: Joi.string().optional(),
    avatar_url: Joi.string().uri().optional(),
});

export const createAddressSchema = Joi.object({
    title: Joi.string().required(),
    address: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    postal_code: Joi.string().optional(),
    latitude: Joi.number().optional(),
    longitude: Joi.number().optional(),
    is_default: Joi.boolean().optional(),
});

export const updateAddressSchema = Joi.object({
    title: Joi.string().optional(),
    address: Joi.string().optional(),
    city: Joi.string().optional(),
    state: Joi.string().optional(),
    postal_code: Joi.string().optional(),
    latitude: Joi.number().optional(),
    longitude: Joi.number().optional(),
    is_default: Joi.boolean().optional(),
});
