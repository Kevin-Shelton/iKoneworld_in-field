import { supabaseAdmin } from '../supabase/server';

/**
 * Create a new anonymous customer and return their ID
 */
export async function createCustomer(enterpriseId: string, preferredLanguage?: string) {
  const { data, error } = await supabaseAdmin
    .from('customers')
    .insert({
      enterprise_id: enterpriseId,
      preferred_language: preferredLanguage,
      first_interaction_at: new Date().toISOString(),
      last_interaction_at: new Date().toISOString(),
      total_conversations: 0,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating customer:', error);
    throw error;
  }

  return data;
}

/**
 * Update customer's last interaction time
 */
export async function updateCustomerInteraction(customerId: string) {
  const { error } = await supabaseAdmin
    .from('customers')
    .update({
      last_interaction_at: new Date().toISOString(),
    })
    .eq('id', customerId);

  if (error) {
    console.error('Error updating customer interaction:', error);
    throw error;
  }
}

/**
 * Increment customer's conversation count
 */
export async function incrementCustomerConversations(customerId: string) {
  const { error } = await supabaseAdmin.rpc('increment_customer_conversations', {
    customer_uuid: customerId,
  });

  if (error) {
    console.error('Error incrementing customer conversations:', error);
    // Don't throw - this is not critical
  }
}
