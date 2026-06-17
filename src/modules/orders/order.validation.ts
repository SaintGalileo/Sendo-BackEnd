import Joi from 'joi';


//join create order schema..
export const createOrderSchema = Joi.object({
    addressId: Joi.string().uuid().required(),
    notes: Joi.string().allow('').optional(),
    paymentMethod: Joi.string().valid('wallet', 'cash').default('wallet'),
});



//delivery fee order schema
export const deliveryFeeEstimateSchema = Joi.object({
    merchantId: Joi.string().uuid().required(),
    addressId: Joi.string().uuid().required(),
});


//rate order schema
export const rateOrderSchema = Joi.object({
    rating: Joi.number().min(1).max(5).required(),
    comment: Joi.string().allow('').optional(),
});
