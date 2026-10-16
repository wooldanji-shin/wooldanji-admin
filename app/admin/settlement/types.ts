export type SettlementPaymentStatus = 'paid' | 'freeTrial' | 'failed' | 'success';
export type SettlementPaymentType = 'basic' | 'premium' | 'extension' | 'solo_popup' | 'solo_popup_extension';

export interface SettlementPayment {
  id: string;
  partnerId: string | null;
  partnerBusinessName: string | null;
  representativeName: string | null;
  businessRegistrationNumber: string | null;
  subscriptionId: string | null;
  premiumAdId: string | null;
  soloPopupAdId: string | null;
  paymentType: SettlementPaymentType;
  adTitle: string | null;
  supplyAmount: number;
  vatAmount: number;
  amount: number;
  paymentDate: string;
  billingPeriodStart: string | null;
  billingPeriodEnd: string | null;
  status: SettlementPaymentStatus;
  receiptUrl: string | null;
  failReason: string | null;
  orderId: string | null;
}

export type StatusFilter = 'all' | 'success' | 'freeTrial' | 'failed';
export type TypeFilter = 'all' | 'basic' | 'premium' | 'extension' | 'solo_popup' | 'solo_popup_extension';

export interface PartnerOption {
  id: string;
  businessName: string;
}

export interface SettlementSummary {
  totalRevenue: number;
  totalRevenueDeltaPct: number | null;
  successCount: number;
  successCountDeltaPct: number | null;
  failedCount: number;
  premiumRevenueRatioPct: number;
}
