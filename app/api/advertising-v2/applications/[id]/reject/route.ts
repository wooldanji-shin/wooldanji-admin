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
    const { rejectReason } = body as { rejectReason: string };

    if (!rejectReason || !rejectReason.trim()) {
      return NextResponse.json(
        { error: 'Reject reason is required' },
        { status: 400 }
      );
    }

    const { data: ad, error: fetchError } = await supabase
      .from('advertisements_v2')
      .select('adStatus')
      .eq('id', id)
      .single();

    if (fetchError || !ad) {
      return NextResponse.json(
        { error: 'Advertisement not found' },
        { status: 404 }
      );
    }

    if (!['pending', 'approved'].includes(ad.adStatus)) {
      return NextResponse.json(
        { error: 'Advertisement cannot be rejected in its current status' },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from('advertisements_v2')
      .update({
        adStatus: 'rejected',
        rejectReason: rejectReason.trim(),
        rejectedAt: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Failed to reject advertisement:', updateError);
      return NextResponse.json(
        { error: 'Failed to reject advertisement' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Advertisement rejected successfully',
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
