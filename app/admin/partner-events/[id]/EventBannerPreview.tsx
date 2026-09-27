import { eventBannerThemeOf, type EventBannerDeco } from './eventBannerThemes';

/**
 * 앱 홈 배너(HomeEventBannerCard)와 같은 모양으로 그린다 — 크기·배치·글자 위계를 앱 값 그대로 맞춘다.
 * 폭은 375 기준 기기의 배너 폭(335px), 높이는 앱 homeBannerHeight(160px).
 * 기본 배너의 색·배경 장식은 파트너가 고른 테마(bannerTheme)를 따른다.
 */
const BANNER_WIDTH = 335;
const BANNER_HEIGHT = 160;
const CARD_RADIUS = 8;
const THUMBNAIL_SIZE = 84;
const THUMBNAIL_RADIUS = 14;
const GRAY_100 = '#F5F5F5';

export interface EventBannerPreviewData {
  businessName: string;
  title: string;
  bannerType: 'template' | 'image';
  bannerTheme: string;
  bannerImageUrl: string | null;
  winnerCount: number;
  participationType: 'draw' | 'first_come';
  /** 할인 대상 (쿠폰명) */
  target: string;
  /** '1,000원' / '10%' / '증정' — 할인 값이 없으면 null */
  amount: string | null;
  /** ' 할인' 또는 '' (증정) */
  amountSuffix: string;
  entryStartAt: Date;
  announceAt: Date;
}

/** '9.26 18시' — 브라우저 로컬(KST) 기준 */
function shortDateHour(date: Date): string {
  return `${date.getMonth() + 1}.${date.getDate()} ${date.getHours()}시`;
}

export function EventBannerPreview({
  data,
  onImageClick,
}: {
  data: EventBannerPreviewData;
  onImageClick?: () => void;
}): React.ReactElement {
  if (data.bannerType === 'image') {
    return (
      <button
        type="button"
        onClick={onImageClick}
        className="block overflow-hidden"
        style={{ width: BANNER_WIDTH, height: BANNER_HEIGHT, borderRadius: CARD_RADIUS, backgroundColor: GRAY_100 }}
      >
        {data.bannerImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.bannerImageUrl} alt="이벤트 배너" className="h-full w-full object-cover" />
        )}
      </button>
    );
  }

  const { palette, decos } = eventBannerThemeOf(data.bannerTheme);
  const line = 'block truncate';

  return (
    <div
      className="relative flex items-center overflow-hidden"
      style={{
        width: BANNER_WIDTH,
        height: BANNER_HEIGHT,
        borderRadius: CARD_RADIUS,
        backgroundColor: palette.background,
        padding: '12px 16px 12px 20px',
        gap: 14,
      }}
    >
      {decos.map((deco, index) => (
        <BannerDeco key={index} deco={deco} />
      ))}

      {/* 글자 위계: 이벤트명 20 > 할인 대상 15 · 금액 18 > 추첨 14 > 기간 13 > 상호명 13 (앱과 동일) */}
      <div className="relative flex min-w-0 flex-1 flex-col justify-center">
        {data.businessName && (
          <span className={line} style={{ fontSize: 13, lineHeight: '18px', fontWeight: 500, color: palette.business }}>
            {data.businessName}
          </span>
        )}
        <span
          className={line}
          style={{ fontSize: 20, lineHeight: '26px', fontWeight: 800, letterSpacing: -0.4, color: palette.title }}
        >
          {data.title}
        </span>
        <div style={{ height: 2 }} />
        {data.target && (
          <span className={line} style={{ fontSize: 15, lineHeight: '20px', fontWeight: 600, color: palette.benefit }}>
            {data.target}
          </span>
        )}
        {data.amount && (
          <span
            className={line}
            style={{ fontSize: 18, lineHeight: '24px', fontWeight: 800, letterSpacing: -0.36, color: palette.title }}
          >
            {data.amount}
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: 0 }}>{data.amountSuffix}</span>
          </span>
        )}
        <div style={{ height: 4 }} />
        <span className={line} style={{ fontSize: 14, lineHeight: '20px', fontWeight: 600, color: palette.benefit }}>
          <span style={{ color: palette.winner, fontWeight: 800 }}>{data.winnerCount}명</span>{' '}
          {data.participationType === 'draw' ? '추첨' : '선착순'}
        </span>
        <span className={line} style={{ fontSize: 13, lineHeight: '18px', fontWeight: 500, color: palette.sub }}>
          {shortDateHour(data.entryStartAt)} ~ {shortDateHour(data.announceAt)}까지
        </span>
      </div>

      <div className="relative flex shrink-0 flex-col items-end" style={{ gap: 8 }}>
        <button
          type="button"
          onClick={onImageClick}
          className="overflow-hidden"
          style={{
            width: THUMBNAIL_SIZE,
            height: THUMBNAIL_SIZE,
            borderRadius: THUMBNAIL_RADIUS,
            backgroundColor: palette.thumbnail,
          }}
        >
          {data.bannerImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.bannerImageUrl} alt="배너 썸네일" className="h-full w-full object-cover" />
          )}
        </button>
        <span style={{ fontSize: 13, lineHeight: '18px', fontWeight: 600, color: palette.title }}>자세히 보기 ›</span>
      </div>
    </div>
  );
}

/** 테마 배경 장식 하나 — 앱 _BannerDeco 와 같은 규칙 (다이아몬드는 정사각형을 45도 회전) */
function BannerDeco({ deco }: { deco: EventBannerDeco }): React.ReactElement {
  const height = deco.height ?? deco.width;
  const rotation = deco.shape === 'diamond' ? 45 : (deco.rotationDeg ?? 0);
  const shapeStyle: React.CSSProperties = (() => {
    switch (deco.shape) {
      case 'circle':
        return { borderRadius: '50%', backgroundColor: deco.color };
      case 'ring':
        return { borderRadius: '50%', border: `${deco.ringWidth ?? 0}px solid ${deco.color}` };
      case 'diamond':
        return { backgroundColor: deco.color };
      case 'pill':
        return { borderRadius: height / 2, backgroundColor: deco.color };
      case 'dotGrid':
        return {
          backgroundImage: `radial-gradient(${deco.color} 1.6px, transparent 1.8px)`,
          backgroundSize: '12px 12px',
        };
    }
  })();

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        right: deco.right,
        top: deco.top,
        bottom: deco.bottom,
        width: deco.width,
        height,
        boxSizing: 'border-box',
        opacity: deco.opacity ?? 1,
        transform: `rotate(${rotation}deg)`,
        ...shapeStyle,
      }}
    />
  );
}
