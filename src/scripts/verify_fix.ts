import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyOrderRelationships() {
    console.log('--- Verifying Order Relationships ---');

    // 1. Fetch one order to see if it works with the new joins
    const { data: orderById, error: errorId } = await supabase
        .from('orders')
        .select('*, merchant:merchants(*), address:addresses(*), items:order_items(*, product:products(*)), courier:couriers(*, user:users(*))')
        .limit(1)
        .single();

    if (errorId) {
        console.error('Error fetching order by ID with joins:', errorId.message);
    } else {
        console.log('Successfully fetched order with nested courier-user join!');
        console.log('Order ID:', orderById.id);
        console.log('Courier User:', orderById.courier?.user ? `${orderById.courier.user.first_name} ${orderById.courier.user.last_name}` : 'Not assigned');
    }

    // 2. Fetch orders with consumer join
    const { data: ordersWithCustomer, error: errorCustomer } = await supabase
        .from('orders')
        .select('*, customer:users!consumer_id(*)')
        .limit(1);

    if (errorCustomer) {
        console.error('Error fetching orders with customer join:', errorCustomer.message);
    } else {
        console.log('Successfully fetched orders with consumer_id join!');
        console.log('Customer Name:', ordersWithCustomer[0].customer ? `${ordersWithCustomer[0].customer.first_name} ${ordersWithCustomer[0].customer.last_name}` : 'N/A');
    }

    console.log('\nNOTE: If you haven\'t run the fix_orders_relationships.sql migration yet, these tests might still fail.');
}

verifyOrderRelationships();
