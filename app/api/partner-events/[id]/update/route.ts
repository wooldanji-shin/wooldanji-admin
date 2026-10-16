import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface UpdateBody {
  title: string;
  couponTitle: string;
  participationType: 'draw' | 'first_come';
  winnerCount: number;
  couponDiscountType: 'percent' | 'fixed' | 'gift';
  couponDiscountValue: number | null;
  couponExpiresAt: string;
  entryStartAt: string;
  entryEndAt: string;
  apartmentIds: string[];
}

/** DB CHECK 제약(chk_partner_events_schedule_order) 위반 시 나오는 불친절한 메시지를 대체 */
const CONSTRAINT_MESSAGE: Record<string, string> = {
  chk_partner_events_schedule_order: '응모 종료는 응모 시작보다 늦어야 합니다.',
  chk_partner_events_coupon_discount_value_required: '증정이 아니면 할인 값을 입력해야 합니다.',
  chk_partner_events_winner_count: '당첨 인원은 1명 이상이어야 합니다.',
  chk_partner_events_coupon_expiry_after_announce: '쿠폰 만료일은 당첨 발표(응모 종료 + 2시간) 1일 이후여야 합니다.',
  chk_partner_events_percent_discount_max: '% 할인은 100을 초과할 수 없습니다.',
};

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
        { error: '로그인이 만료되었습니다. 다시 로그인해 주세요.' },
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
        { error: '이 작업을 할 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const { data: event, error: fetchError } = await supabase
      .from('partner_events')
      .select('status')
      .eq('id', id)
      .single();

    if (fetchError || !event) {
      return NextResponse.json(
        { error: '이벤트를 찾을 수 없습니다. 삭제되었을 수 있으니 목록을 새로고침해 주세요.' },
        { status: 404 }
      );
    }

    // 종료된 이벤트는 이미 확정된 결과라 내용을 고치지 않는다
    if (event.status === 'ended') {
      return NextResponse.json(
        { error: '종료된 이벤트는 수정할 수 없습니다.' },
        { status: 400 }
      );
    }

    const body = await request.json() as UpdateBody;

    if (!body.title?.trim()) {
      return NextResponse.json({ error: '이벤트 제목을 입력해 주세요.' }, { status: 400 });
    }
    if (!body.couponTitle?.trim()) {
      return NextResponse.json({ error: '할인 대상(증정품)을 입력해주세요.' }, { status: 400 });
    }
    if (!Array.isArray(body.apartmentIds) || body.apartmentIds.length === 0) {
      return NextResponse.json({ error: '대상 아파트를 1곳 이상 선택해 주세요.' }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from('partner_events')
      .update({
        title: body.title.trim(),
        participationType: body.participationType,
        winnerCount: body.winnerCount,
        couponTitle: body.couponTitle.trim(),
        couponDiscountType: body.couponDiscountType,
        couponDiscountValue: body.couponDiscountType === 'gift' ? null : body.couponDiscountValue,
        couponExpiresAt: body.couponExpiresAt,
        // announceAt(응모종료+2시간)/endAt(발표 다음날 자정 KST)은 DB generated column이라 보내지 않는다
        entryStartAt: body.entryStartAt,
        entryEndAt: body.entryEndAt,
      })
      .eq('id', id);

    if (updateError) {
      console.error('Failed to update event:', updateError);
      const constraintName = (updateError as { message?: string }).message?.match(/constraint "([a-z_]+)"/)?.[1];
      const friendly = constraintName ? CONSTRAINT_MESSAGE[constraintName] : undefined;
      return NextResponse.json(
        { error: friendly ?? '이벤트 정보를 저장하지 못했습니다. 입력값을 확인한 뒤 다시 시도해 주세요.' },
        { status: 400 }
      );
    }

    // 대상 아파트 override — junction table을 통째로 교체
    const { error: deleteError } = await supabase
      .from('partner_event_apartments')
      .delete()
      .eq('eventId', id);

    if (deleteError) {
      console.error('Failed to clear event apartments:', deleteError);
      return NextResponse.json({ error: '이벤트 내용은 저장됐지만 대상 아파트를 저장하지 못했습니다. 대상 아파트가 비어 있을 수 있으니 다시 선택해 저장해 주세요.' }, { status: 500 });
    }

    const { error: insertError } = await supabase
      .from('partner_event_apartments')
      .insert(body.apartmentIds.map((apartmentId) => ({ eventId: id, apartmentId })));

    if (insertError) {
      console.error('Failed to insert event apartments:', insertError);
      return NextResponse.json({ error: '이벤트 내용은 저장됐지만 대상 아파트를 저장하지 못했습니다. 대상 아파트가 비어 있을 수 있으니 다시 선택해 저장해 주세요.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Event updated successfully',
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    );
  }
}
