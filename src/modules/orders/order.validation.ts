import Joi from 'joi';


//join create order schema..
export const createOrderSchema = Joi.object({
    addressId: Joi.string().uuid().allow(null, '').optional(),
    fulfillmentType: Joi.string().valid('pickup', 'delivery').default('delivery'),
    notes: Joi.string().allow('', null).optional(),
    merchantNotes: Joi.string().allow('', null).optional(),
    riderNotes: Joi.string().allow('', null).optional(),
    merchant_notes: Joi.string().allow('', null).optional(),
    rider_notes: Joi.string().allow('', null).optional(),
    paymentMethod: Joi.string().valid('wallet', 'cash', 'online', 'online_paid').default('wallet'),
    paymentReference: Joi.string().allow('', null).optional(),
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
