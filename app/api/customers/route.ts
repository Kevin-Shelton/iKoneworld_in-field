import { NextRequest, NextResponse } from 'next/server';
import { createCustomer, updateCustomerInteraction, incrementCustomerConversations } from '@/lib/db/customers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'create': {
        const { enterpriseId, preferredLanguage } = body;
        
        if (!enterpriseId) {
          return NextResponse.json(
            { error: 'Enterprise ID is required' },
            { status: 400 }
          );
        }

        const customer = await createCustomer(enterpriseId, preferredLanguage);
        
        return NextResponse.json({ customer });
      }

      case 'updateInteraction': {
        const { customerId } = body;
        
        if (!customerId) {
          return NextResponse.json(
            { error: 'Customer ID is required' },
            { status: 400 }
          );
        }

        await updateCustomerInteraction(customerId);
        
        return NextResponse.json({ success: true });
      }

      case 'incrementConversations': {
        const { customerId } = body;
        
        if (!customerId) {
          return NextResponse.json(
            { error: 'Customer ID is required' },
            { status: 400 }
          );
        }

        await incrementCustomerConversations(customerId);
        
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Customer API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
