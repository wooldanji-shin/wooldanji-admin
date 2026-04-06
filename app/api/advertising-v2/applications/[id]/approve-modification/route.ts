import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// running 광고 수정 심사 승인
// pendingChanges를 실제 컬럼에 적용하고 modificationStatus를 초기화
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('userId', currentUser.id);

    const isAdmin = roles?.some(r => ['SUPER_ADMIN', 'MANAGER'].includes(r.role));
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    // 광고 조회 (modificationStatus, pendingChanges 포함)
    const { data: ad, error: fetchError } = await supabase
      .from('advertisements_v2')
      .select('adStatus, modificationStatus, pendingChanges')
      .eq('id', id)
      .single();

    if (fetchError || !ad) {
      return NextResponse.json({ error: 'Advertisement not found' }, { status: 404 });
    }

    if (ad.modificationStatus !== 'pending') {
      return NextResponse.json({ error: 'No pending modification to approve' }, { status: 400 });
    }

    if (!ad.pendingChanges) {
      return NextResponse.json({ error: 'pendingChanges is empty' }, { status: 400 });
    }

    const changes = ad.pendingChanges as Record<string, unknown>;

    // pendingChanges를 실제 컬럼에 적용 + modificationStatus/pendingChanges 초기화
    const { error: updateError } = await supabase
      .from('advertisements_v2')
      .update({
        ...changes,
        modificationStatus: null,
        modificationRejectedReason: null,
        pendingChanges: null,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Failed to approve modification:', updateError);
      return NextResponse.json({ error: 'Failed to approve modification' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
