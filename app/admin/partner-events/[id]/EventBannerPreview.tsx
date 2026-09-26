import { ChevronRight } from 'lucide-react';

/**
 * 앱 홈 배너(HomeEventBannerCard)와 같은 모양으로 그린다 — 크기·색·배치를 앱 값 그대로 맞춘다.
 * 폭은 375 기준 기기의 배너 폭(335px), 높이는 앱 homeBannerHeight(160px).
 */
const BANNER_WIDTH = 335;
const BANNER_HEIGHT = 160;

// 앱 colors.dart 값
const PRIMARY = '#FF822F';
const TEXT_BLACK = '#2B2B2B';
const GRAY_100 = '#F5F5F5';
const GRAY_200 = '#EEEEEE';
const GRAY_500 = '#9E9E9E';
const GRAY_700 = '#616161';
const GRAY_800 = '#424242';

export interface EventBannerPreviewData {
  businessName: string;
  title: string;
  bannerType: 'template' | 'image';
  bannerImageUrl: string | null;
  winnerCount: number;
  participationType: 'draw' | 'first_come';
  benefitText: string;
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
        className="block overflow-hidden rounded-lg"
        style={{ width: BANNER_WIDTH, height: BANNER_HEIGHT, backgroundColor: GRAY_100 }}
      >
        {data.bannerImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.bannerImageUrl} alt="이벤트 배너" className="h-full w-full object-cover" />
        )}
      </button>
    );
  }

  return (
    <div
      className="flex items-center gap-3 rounded-lg bg-white px-4 py-3"
      style={{ width: BANNER_WIDTH, height: BANNER_HEIGHT, border: `1px solid ${GRAY_200}` }}
    >
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        {data.businessName && (
          <span className="truncate text-[13px] font-medium" style={{ color: GRAY_700 }}>
            {data.businessName}
          </span>
        )}
        <span
          className="mt-0.5 line-clamp-2 text-[20px] font-extrabold leading-[1.25]"
          style={{ color: TEXT_BLACK }}
        >
          {data.title}
        </span>
        <span className="mt-0.5 truncate text-[14px] font-semibold" style={{ color: GRAY_800 }}>
          {data.benefitText}
        </span>
        <span className="mt-2 text-[13px] font-medium" style={{ color: GRAY_700 }}>
          <span className="font-bold" style={{ color: PRIMARY }}>
            {data.winnerCount}명
          </span>{' '}
          {data.participationType === 'draw' ? '추첨' : '선착순'}
        </span>
        <span className="mt-0.5 truncate text-[13px] font-medium" style={{ color: GRAY_700 }}>
          {shortDateHour(data.entryStartAt)} ~ {shortDateHour(data.announceAt)}까지
        </span>
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <button
          type="button"
          onClick={onImageClick}
          className="h-24 w-24 overflow-hidden rounded-lg"
          style={{ backgroundColor: GRAY_100 }}
        >
          {data.bannerImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.bannerImageUrl} alt="배너 썸네일" className="h-full w-full object-cover" />
          )}
        </button>
        <span className="mt-1.5 flex items-center text-[13px] font-semibold" style={{ color: GRAY_500 }}>
          자세히 보기
          <ChevronRight className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}
