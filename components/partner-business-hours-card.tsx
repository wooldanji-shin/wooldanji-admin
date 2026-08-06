'use client';

import { Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DAY_OF_WEEK_LABEL, type PartnerBusinessHour } from '@/lib/types/partner';

interface PartnerBusinessHoursCardProps {
  businessHours: PartnerBusinessHour[];
  /** partner_users.businessHoursNote — 파트너가 자유롭게 적은 안내 문구 */
  businessHoursNote?: string | null;
  loading?: boolean;
}

export function PartnerBusinessHoursCard({
  businessHours,
  businessHoursNote,
  loading = false,
}: PartnerBusinessHoursCardProps): React.ReactElement {
  const hasHours = businessHours.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Clock className="h-4 w-4 text-muted-foreground" />
          영업시간
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 py-0 pb-4">
        {loading ? (
          <p className="py-2 text-sm text-muted-foreground">불러오는 중...</p>
        ) : !hasHours ? (
          <p className="py-2 text-sm text-muted-foreground">등록된 영업시간이 없습니다.</p>
        ) : (
          <div className="divide-y divide-border/60">
            {businessHours.map((hour) => (
              <div
                key={hour.dayOfWeek}
                className="flex items-start justify-between gap-4 py-2 text-sm"
              >
                <span className="w-8 shrink-0 font-medium">
                  {DAY_OF_WEEK_LABEL[hour.dayOfWeek]}
                </span>
                {hour.isClosed ? (
                  <Badge variant="secondary" className="ml-auto">
                    휴무
                  </Badge>
                ) : (
                  <div className="ml-auto text-right">
                    <div className="tabular-nums">
                      {hour.openTime && hour.closeTime
                        ? `${hour.openTime} – ${hour.closeTime}`
                        : '-'}
                    </div>
                    {/* 브레이크타임·라스트오더는 입력한 파트너가 적어 등록된 경우에만 표기 */}
                    {(hour.breakStartTime || hour.lastOrderTime) && (
                      <div className="mt-1 flex flex-wrap justify-end gap-1">
                        {hour.breakStartTime && hour.breakEndTime && (
                          <Badge variant="outline" className="font-normal tabular-nums">
                            브레이크 {hour.breakStartTime}–{hour.breakEndTime}
                          </Badge>
                        )}
                        {hour.lastOrderTime && (
                          <Badge variant="outline" className="font-normal tabular-nums">
                            라스트오더 {hour.lastOrderTime}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {businessHoursNote && (
          <div className="mt-3 rounded-md bg-muted/40 px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground">파트너 안내 문구</p>
            <p className="mt-0.5 whitespace-pre-wrap text-sm">{businessHoursNote}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
