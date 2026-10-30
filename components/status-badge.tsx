import type { ReactNode } from 'react';
import { Badge, type BadgeProps, type MantineColor } from '@mantine/core';

type StatusBadgeVariant =
  | 'active'
  | 'success'
  | 'pending'
  | 'inactive'
  | 'error'
  | 'info'
  | 'primary'
  | 'free';
type StatusBadgeSize = 'sm' | 'md' | 'lg';

const VARIANT_COLOR: Record<StatusBadgeVariant, MantineColor> = {
  active: 'green',
  success: 'green',
  pending: 'yellow',
  inactive: 'gray',
  error: 'red',
  info: 'blue',
  primary: 'violet',
  // 무료체험 전용 — 같은 셀에 서는 진행중(파랑)·수정신청(보라)과 색조를 띄운다
  free: 'pink',
};

const SIZE_MAP: Record<StatusBadgeSize, BadgeProps['size']> = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
};

interface BaseStatusBadgeProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'color'> {
  variant?: StatusBadgeVariant | null;
  size?: StatusBadgeSize | null;
  withDot?: boolean | null;
  children: ReactNode;
}

function BaseStatusBadge({
  variant,
  size,
  withDot = true,
  className,
  children,
  ...props
}: BaseStatusBadgeProps): React.ReactElement {
  const color = VARIANT_COLOR[variant ?? 'inactive'];
  return (
    <Badge
      variant="light"
      color={color}
      size={SIZE_MAP[size ?? 'md']}
      radius="sm"
      className={className}
      leftSection={
        withDot ? (
          <span
            aria-hidden
            style={{
              display: 'block',
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: `var(--mantine-color-${color}-filled)`,
            }}
          />
        ) : undefined
      }
      {...props}
    >
      {children}
    </Badge>
  );
}

// ---- Domain presets ---------------------------------------------------------

export type AdStatus = 'pending' | 'approved' | 'rejected' | 'running' | 'ended' | 'draft';
export type ModificationStatus = 'pending' | 'approved' | 'rejected' | null;
export type PaymentStatus = 'paid' | 'unpaid';
export type InquiryStatus = 'pending' | 'answered';
export type MembershipStatus = 'pending' | 'approved' | 'rejected';
export type PremiumStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'running'
  | 'ended'
  | 'draft'
  | 'modification_pending';
export type UserStatus = 'active' | 'pending' | 'suspended' | 'rejected';
export type SettlementPaymentStatus = 'paid' | 'freeTrial' | 'failed' | 'success';
export type EventStatus = 'pending' | 'approved' | 'rejected' | 'ended';

const AD_PRESET: Record<AdStatus, { label: string; variant: StatusBadgeVariant }> = {
  pending: { label: '승인대기', variant: 'pending' },
  approved: { label: '승인됨', variant: 'success' },
  rejected: { label: '거절됨', variant: 'error' },
  running: { label: '진행중', variant: 'info' },
  ended: { label: '종료', variant: 'inactive' },
  draft: { label: '임시저장', variant: 'inactive' },
};

const MODIFICATION_PRESET: Record<
  Exclude<ModificationStatus, null>,
  { label: string; variant: StatusBadgeVariant }
> = {
  pending: { label: '수정신청', variant: 'primary' },
  approved: { label: '수정승인', variant: 'success' },
  rejected: { label: '수정거절', variant: 'error' },
};

const PAYMENT_PRESET: Record<PaymentStatus, { label: string; variant: StatusBadgeVariant }> = {
  paid: { label: '결제완료', variant: 'success' },
  unpaid: { label: '미결제', variant: 'inactive' },
};

const INQUIRY_PRESET: Record<InquiryStatus, { label: string; variant: StatusBadgeVariant }> = {
  pending: { label: '미응답', variant: 'pending' },
  answered: { label: '응답완료', variant: 'success' },
};

const MEMBERSHIP_PRESET: Record<MembershipStatus, { label: string; variant: StatusBadgeVariant }> =
  {
    pending: { label: '승인대기', variant: 'pending' },
    approved: { label: '승인됨', variant: 'success' },
    rejected: { label: '거절됨', variant: 'error' },
  };

const PREMIUM_PRESET: Record<PremiumStatus, { label: string; variant: StatusBadgeVariant }> = {
  pending: { label: '승인대기', variant: 'pending' },
  approved: { label: '승인됨', variant: 'success' },
  rejected: { label: '거절됨', variant: 'error' },
  running: { label: '진행중', variant: 'info' },
  ended: { label: '종료', variant: 'inactive' },
  draft: { label: '임시저장', variant: 'inactive' },
  modification_pending: { label: '수정 심사', variant: 'primary' },
};

const USER_PRESET: Record<UserStatus, { label: string; variant: StatusBadgeVariant }> = {
  active: { label: '활성', variant: 'success' },
  pending: { label: '승인대기', variant: 'pending' },
  suspended: { label: '정지', variant: 'error' },
  rejected: { label: '거절', variant: 'inactive' },
};

const SETTLEMENT_PRESET: Record<
  SettlementPaymentStatus,
  { label: string; variant: StatusBadgeVariant }
> = {
  paid: { label: '결제완료', variant: 'success' },
  success: { label: '결제완료', variant: 'success' },
  freeTrial: { label: '무료체험', variant: 'info' },
  failed: { label: '결제실패', variant: 'error' },
};

const EVENT_PRESET: Record<EventStatus, { label: string; variant: StatusBadgeVariant }> = {
  pending: { label: '승인대기', variant: 'pending' },
  approved: { label: '승인됨', variant: 'success' },
  rejected: { label: '거절됨', variant: 'error' },
  ended: { label: '종료', variant: 'inactive' },
};

interface DomainStatusBadgeProps {
  size?: StatusBadgeSize;
  withDot?: boolean;
  className?: string;
}

interface AdProps extends DomainStatusBadgeProps {
  status: AdStatus;
}

interface ModificationProps extends DomainStatusBadgeProps {
  status: ModificationStatus;
}

interface PaymentProps extends DomainStatusBadgeProps {
  status: PaymentStatus;
}

interface InquiryProps extends DomainStatusBadgeProps {
  status: InquiryStatus;
}

interface MembershipProps extends DomainStatusBadgeProps {
  status: MembershipStatus;
}

interface PremiumProps extends DomainStatusBadgeProps {
  status: PremiumStatus;
}

interface UserProps extends DomainStatusBadgeProps {
  status: UserStatus;
}

interface SettlementProps extends DomainStatusBadgeProps {
  status: SettlementPaymentStatus;
}

interface EventProps extends DomainStatusBadgeProps {
  status: EventStatus;
}

const FALLBACK = { label: '', variant: 'inactive' as StatusBadgeVariant };

function Ad({ status, ...rest }: AdProps): React.ReactElement {
  const { label, variant } = AD_PRESET[status] ?? { ...FALLBACK, label: String(status) };
  return (
    <BaseStatusBadge variant={variant} {...rest}>
      {label}
    </BaseStatusBadge>
  );
}

function Modification({ status, ...rest }: ModificationProps): React.ReactElement | null {
  if (!status) return null;
  const { label, variant } = MODIFICATION_PRESET[status] ?? { ...FALLBACK, label: String(status) };
  return (
    <BaseStatusBadge variant={variant} {...rest}>
      {label}
    </BaseStatusBadge>
  );
}

function Payment({ status, ...rest }: PaymentProps): React.ReactElement {
  const { label, variant } = PAYMENT_PRESET[status] ?? { ...FALLBACK, label: String(status) };
  return (
    <BaseStatusBadge variant={variant} {...rest}>
      {label}
    </BaseStatusBadge>
  );
}

function Inquiry({ status, ...rest }: InquiryProps): React.ReactElement {
  const { label, variant } = INQUIRY_PRESET[status] ?? { ...FALLBACK, label: String(status) };
  return (
    <BaseStatusBadge variant={variant} {...rest}>
      {label}
    </BaseStatusBadge>
  );
}

function Membership({ status, ...rest }: MembershipProps): React.ReactElement {
  const { label, variant } = MEMBERSHIP_PRESET[status] ?? { ...FALLBACK, label: String(status) };
  return (
    <BaseStatusBadge variant={variant} {...rest}>
      {label}
    </BaseStatusBadge>
  );
}

function Premium({ status, ...rest }: PremiumProps): React.ReactElement {
  const { label, variant } = PREMIUM_PRESET[status] ?? { ...FALLBACK, label: String(status) };
  return (
    <BaseStatusBadge variant={variant} {...rest}>
      {label}
    </BaseStatusBadge>
  );
}

function User({ status, ...rest }: UserProps): React.ReactElement {
  const { label, variant } = USER_PRESET[status] ?? { ...FALLBACK, label: String(status) };
  return (
    <BaseStatusBadge variant={variant} {...rest}>
      {label}
    </BaseStatusBadge>
  );
}

function Settlement({ status, ...rest }: SettlementProps): React.ReactElement {
  const { label, variant } = SETTLEMENT_PRESET[status] ?? { ...FALLBACK, label: String(status) };
  return (
    <BaseStatusBadge variant={variant} {...rest}>
      {label}
    </BaseStatusBadge>
  );
}

function Event({ status, ...rest }: EventProps): React.ReactElement {
  const { label, variant } = EVENT_PRESET[status] ?? { ...FALLBACK, label: String(status) };
  return (
    <BaseStatusBadge variant={variant} {...rest}>
      {label}
    </BaseStatusBadge>
  );
}

export const StatusBadge = Object.assign(BaseStatusBadge, {
  Ad,
  Modification,
  Payment,
  Inquiry,
  Membership,
  Premium,
  User,
  Settlement,
  Event,
});
