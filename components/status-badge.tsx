import type { ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const statusBadgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-[4px] border px-2.5 py-0.5 text-[14px] leading-5 font-medium transition-colors',
  {
    variants: {
      variant: {
        active:
          'border-success/30 bg-success/10 text-success-foreground [&>span:first-child]:bg-success',
        success:
          'border-success/30 bg-success/10 text-success-foreground [&>span:first-child]:bg-success',
        pending:
          'border-warning/30 bg-warning/10 text-warning-foreground [&>span:first-child]:bg-warning',
        inactive:
          'border-border bg-muted text-muted-foreground [&>span:first-child]:bg-muted-foreground/60',
        error:
          'border-destructive/30 bg-destructive/10 text-destructive [&>span:first-child]:bg-destructive',
        info:
          'border-info/30 bg-info/10 text-info-foreground [&>span:first-child]:bg-info',
        primary:
          'border-primary/30 bg-primary/10 text-primary [&>span:first-child]:bg-primary',
      },
      size: {
        sm: 'px-2 py-0 text-[14px]',
        md: 'px-2.5 py-0.5 text-[14px]',
        lg: 'px-3 py-1 text-[14px]',
      },
      withDot: {
        true: '',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'inactive',
      size: 'md',
      withDot: true,
    },
  }
);

type StatusBadgeVariant = NonNullable<VariantProps<typeof statusBadgeVariants>['variant']>;
type StatusBadgeSize = NonNullable<VariantProps<typeof statusBadgeVariants>['size']>;

interface BaseStatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
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
  return (
    <span
      data-slot="status-badge"
      data-size={size ?? 'md'}
      className={cn(statusBadgeVariants({ variant, size, withDot }), className)}
      {...props}
    >
      {withDot && <span className="h-1.5 w-1.5 rounded-full" aria-hidden />}
      {children}
    </span>
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

export const StatusBadge = Object.assign(BaseStatusBadge, {
  Ad,
  Modification,
  Payment,
  Inquiry,
  Membership,
  Premium,
  User,
});
