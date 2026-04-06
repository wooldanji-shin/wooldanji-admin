import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('userId', currentUser.id);

    const isAdmin = roles?.some(r =>
      ['SUPER_ADMIN', 'MANAGER'].includes(r.role)
    );

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { adminExtraMonths, discountRate } = body as {
      adminExtraMonths: number;
      discountRate: number;
    };

    const [adResult, pricingResult] = await Promise.all([
      supabase
        .from('advertisements_v2')
        .select('adStatus')
        .eq('id', id)
        .single(),
      supabase
        .from('ad_pricing_v2')
        .select('pricePerHousehold')
        .order('effectiveFrom', { ascending: false })
        .limit(1)
        .single(),
    ]);

    const { data: ad, error: fetchError } = adResult;

    if (fetchError || !ad) {
      return NextResponse.json(
        { error: 'Advertisement not found' },
        { status: 404 }
      );
    }

    if (ad.adStatus !== 'pending') {
      return NextResponse.json(
        { error: 'Advertisement is not pending' },
        { status: 400 }
      );
    }

    const { data: householdsData } = await supabase
      .from('advertisement_apartments_v2')
      .select('totalHouseholds')
      .eq('advertisementId', id);

    const totalHouseholds = (householdsData ?? []).reduce(
      (sum: number, row: { totalHouseholds: number }) => sum + row.totalHouseholds,
      0
    );

    const pricePerHousehold = (pricingResult.data as any)?.pricePerHousehold ?? 70;
    const approvedMonthlyAmount =
      Math.round((totalHouseholds * pricePerHousehold * (1 - discountRate / 100)) / 10) * 10;

    const { error: updateError } = await supabase
      .from('advertisements_v2')
      .update({
        adStatus: 'approved',
        adminExtraMonths: adminExtraMonths ?? 0,
        approvedDiscountRate: discountRate,
        approvedMonthlyAmount,
        approvedAt: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Failed to approve advertisement:', updateError);
      return NextResponse.json(
        { error: 'Failed to approve advertisement' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Advertisement approved successfully',
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
