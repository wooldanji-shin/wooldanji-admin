# V2 광고 시스템 DB 설계 플랜

## Context

기존 광고 시스템(관리자 수동 등록 방식)에서 파트너 회원이 직접 광고를 신청하고 정기결제까지 처리하는 셀프서브 구조로 전환.
기존 테이블은 그대로 유지하고 `_v2` 접미사를 붙인 새 테이블을 별도로 생성한다.

**핵심 결정사항:**
- `advertisers_v2` 없음 → `partner_users` 직접 참조
- 이벤트 상태: running+paid = 광고중, ended = 종료
- 타겟팅 방식: `advertisement_apartments_v2` 주 사용. `advertisement_regions_v2`는 구조만 생성, 향후 지역 타겟팅 확장 시 활용 (현재 미사용)
- `endDate` 제거 → 정기결제 모델에 맞게 `ad_subscriptions_v2`로 관심사 분리
- 구독 취소 시 `cancel_pending` 상태로 현재 기간 종료까지 광고 유지
- 광고 이미지는 별도 테이블 없이 `imageUrls text[]`로 저장 (최대 7개)
- 클릭/노출/링크 등 행동 데이터는 `ad_analytics_v2`에 일별 집계로 분리
- 파트너당 광고 **여러 개** 허용 (1:N)
- running 중 **타겟팅(아파트/지역) 변경 불가** — `pendingChanges`는 본문 필드(title, content, URL, imageUrls)만 임시 저장
- 이벤트 쿠폰 만료(`couponExpiryDate` 초과) 처리는 **Edge Function cron**에서 `status='expired'`로 일괄 업데이트
- 이벤트 종료(`eventEndDate` 초과) 처리는 **Edge Function cron**에서 `eventStatus='ended'`로 일괄 업데이트
- 이벤트 광고 결제는 **단건 PG 결제** (정기결제와 독립)
- 월 청구 금액 = `totalHouseholds 합산 × pricePerHousehold(ad_pricing_v2)` — 기본 단가 70원/세대, 관리자가 변경 가능
- 결제 예정금액 = `totalHouseholds 합산 × pricePerHousehold × (1 - discountRate/100)`, **10원 단위 반올림** 적용
- 관리자 **승인 시점**에 `approvedMonthlyAmount`로 스냅샷 저장 → 앱은 이 값을 직접 읽음 (단가·할인율 변경 영향 없음)
- `monthlyAmount` 확정 스냅샷은 빌링키 등록(activatedAt) 시점에 `ad_subscriptions_v2`에도 저장
- 광고 수정 후 재승인 대기 중에도 **기존 running 광고 계속 노출** (`pendingChanges jsonb` 컬럼으로 임시 저장)

**paymentStatus 의미:**
- `'unpaid'` = 빌링키 미등록 상태
- `'paid'` = 빌링키 등록 완료 (실제 결제 발생과 무관, 무료 기간 포함)

**무료 기간 + 정기결제 전체 흐름:**
```
광고 신청 (draft → pending)
  → 관리자 승인 (adStatus='approved', paymentStatus='unpaid')
  → 파트너가 '결제 필요' 화면에서 빌링키(카드) 등록
  → adStatus='running', paymentStatus='paid'
     activatedAt = 빌링키 등록 시각
     periodStartDate = activatedAt (구독 기간 시작일)
     freeEndDate = periodStartDate + freeMonths + adminExtraMonths (개월)
     (이 시점에 실제 결제 없음)

freeEndDate 도달 (Edge Function cron):
  빌링키 존재 → 첫 정기결제 시도
    성공 → running 유지, nextBillingDate = +1달
    실패 → grace_period (graceEndDate = 실패일 + 3일)
  빌링키 없음 → adStatus='ended' (이론상 발생 불가, 방어 처리)

grace_period → 재시도 성공 → active
grace_period → graceEndDate 초과 → adStatus='ended', subscriptionStatus='expired'

구독 취소/만료 처리 (Edge Function):
  cancel_pending → cancelled or grace_period 초과 → expired 시:
    advertisements_v2.adStatus = 'ended'

  hasCancelledSubscription 설정 타이밍:
    취소 신청 시 즉시 true로 갱신 (cancel_pending 전환과 동시)
    → 재활성화 시 무료+할인 혜택 소멸 여부는 이 시점부터 확정

  무료 기간 중 취소:
    subscriptionStatus = 'cancel_pending', cancelEffectiveAt = freeEndDate
    → freeEndDate 도달까지 광고 유지 (grace_period 없이 곧바로 cancelled)
    → freeEndDate 도달 시 adStatus='ended', hasCancelledSubscription=true

재활성화 플로우:
  adStatus='ended' → 파트너가 재활성화 신청 → adStatus='pending' (재심사)
  관리자 승인 → adStatus='approved'
  파트너가 '결제필요' 화면에서 빌링키 재등록
  → adStatus='running', paymentStatus='paid'
  → 새 ad_subscriptions_v2 row INSERT (이전 구독 이력 보존, 기간별 완전 분리)

  hasCancelledSubscription=true (취소/만료 이력 있음):
    freeEndDate = periodStartDate   ← 무료 없음
    discountRate = 0          ← 정상가
    monthlyAmount = originalMonthlyAmount

  hasCancelledSubscription=false (이력 없음, 이론상 발생 불가):
    freeEndDate = periodStartDate + (freeMonths + adminExtraMonths)개월
    discountRate = advertisements_v2.approvedDiscountRate ?? ad_pricing_v2.defaultDiscountRate
    monthlyAmount = originalMonthlyAmount × (1 - discountRate/100)

  → 현재 구독 조회: WHERE advertisementId=? AND subscriptionStatus IN ('active','grace_period','cancel_pending')
```

---

## 신규 생성 테이블 (V2)

### 1. `ad_categories_v2`
기존 `ad_categories`와 동일 구조, V2용 사본.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | DEFAULT gen_random_uuid() |
| createdAt | timestamptz | DEFAULT now() |
| categoryName | text NOT NULL | 카테고리명 |
| iconUrl | text | nullable |
| isActive | bool | DEFAULT true |
| orderIndex | int | DEFAULT 0 |

---

### 2. `ad_sub_categories_v2`
기존 `ad_sub_categories`와 동일 구조, FK만 v2로 변경.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | |
| createdAt | timestamptz | DEFAULT now() |
| categoryId | uuid FK | → ad_categories_v2(id) ON DELETE CASCADE |
| subCategoryName | text NOT NULL | |
| isActive | bool | DEFAULT true |
| orderIndex | int | DEFAULT 0 |

---

### 3. `advertisements_v2` ⭐ 핵심 변경

파트너 회원이 직접 신청하는 광고. 상태 기반 라이프사이클 관리.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | |
| createdAt | timestamptz | DEFAULT now() |
| updatedAt | timestamptz | DEFAULT now() |
| partnerId | uuid FK NOT NULL | → partner_users(id) ON DELETE CASCADE |
| categoryId | uuid FK | → ad_categories_v2(id) SET NULL (관리자 변경 가능) |
| subCategoryId | uuid FK | → ad_sub_categories_v2(id) SET NULL |
| title | text NOT NULL | 한줄소개 |
| content | text | NOT NULL, 최대 2000자 |
| naverMapUrl | text | nullable |
| blogUrl | text | nullable |
| youtubeUrl | text | nullable |
| instagramUrl | text | nullable |
| imageUrls | text[] | DEFAULT '{}', 최대 7개 URL |
| adStatus | text NOT NULL | 'draft'\|'pending'\|'approved'\|'rejected'\|'running'\|'ended' |
| paymentStatus | text NOT NULL | 'unpaid'\|'paid' DEFAULT 'unpaid' |
| freeMonths | int | DEFAULT 1 (기본 무료 1달) |
| adminExtraMonths | int | DEFAULT 0 (관리자 추가 무료 개월) |
| approvedDiscountRate | int | nullable, 관리자 승인 시 오버라이드 할인율(%). NULL이면 ad_pricing_v2.defaultDiscountRate 사용 |
| approvedMonthlyAmount | int | nullable, 승인 시 확정된 월 결제예정금액 (10원 단위 반올림). 앱에서 직접 표시 |
| submittedAt | timestamptz | nullable (승인 요청 시각) |
| approvedAt | timestamptz | nullable |
| rejectedAt | timestamptz | nullable |
| rejectReason | text | nullable, 거절 사유 |
| activatedAt | timestamptz | nullable (빌링키 등록 시각. running 전환 시 기록, 재활성화 시 갱신) |
| pendingChanges | jsonb | nullable, 수정 후 재승인 대기 중인 변경 내용 임시 저장 |
| hasCancelledSubscription | bool | DEFAULT false, 광고 단위 취소 이력 플래그. 정기결제 취소/만료/무료기간 중 중단 시 true로 갱신. 재활성화 시 무료+할인 혜택 소멸 여부 결정 |


**표시 상태 매핑:**
| 사용자 표시 | adStatus | paymentStatus | subscriptionStatus | 비고 |
|------------|----------|---------------|--------------------|----|
| 임시저장 | draft | any | - | |
| 승인대기 | pending | unpaid | - | |
| 심사거절 | rejected | unpaid | - | |
| 결제필요 | approved | unpaid | - | |
| 광고중 (20% 할인) | running | paid | active | hasCancelledSubscription=false |
| 광고중 (정상가) | running | paid | active | hasCancelledSubscription=true |
| 결제 유예중 (광고 유지) | running | paid | grace_period | 결제 실패, 유예기간 내 광고 계속 노출 |
| 취소 예정 | running | paid | cancel_pending | |
| 수정 심사중 | running | paid | active | pendingChanges IS NOT NULL |
| 광고종료 | ended | any | cancelled / expired | |

**상태 전이:**
```
draft → pending (제출)
pending → approved (관리자 승인)
pending → rejected (관리자 거절)
rejected → draft (파트너 수정 임시저장)
draft → pending (파트너 수정 후 재신청)
approved → running (빌링키 등록 완료)
running → ended (구독 만료/취소)
ended → pending (파트너 재활성화 신청 → 재심사)
```

**인덱스:**
- `(partnerId)`
- `(adStatus, paymentStatus)`
- `(categoryId, adStatus)` WHERE adStatus = 'running'

---

### 4. `ad_pricing_v2` ⭐ 신규
관리자가 세대당 단가 및 기본 할인율을 설정. 월 청구 금액 = totalHouseholds × pricePerHousehold.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | DEFAULT gen_random_uuid() |
| pricePerHousehold | int NOT NULL | 세대당 단가 (원, 부가세 제외). 기본값 70원 |
| defaultDiscountRate | int NOT NULL | 시스템 기본 할인율(%). DEFAULT 28. 관리자가 변경 가능 |
| effectiveFrom | timestamptz NOT NULL | 단가 적용 시작일 |
| createdBy | uuid FK | → auth.users(id), 변경한 관리자 |
| createdAt | timestamptz | DEFAULT now() |

> 단가·할인율 이력을 보존하기 위해 UPDATE 대신 INSERT로 관리. 현재 정책 = effectiveFrom 기준 최신 row.
> 광고 신청 시점 단가는 `ad_subscriptions_v2.monthlyAmount`에 스냅샷으로 저장.
> 광고별 할인율 오버라이드: 관리자 승인 시 `advertisements_v2.approvedDiscountRate`에 저장.
>   구독 생성 시 `discountRate = approvedDiscountRate ?? defaultDiscountRate` 로 결정.

**인덱스:** `(effectiveFrom DESC)`

---

### 5. `advertisement_apartments_v2`
광고-아파트 연결 (정기결제 금액 산정 기준).

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | |
| advertisementId | uuid FK NOT NULL | → advertisements_v2(id) ON DELETE CASCADE |
| apartmentId | uuid FK NOT NULL | → apartments(id) ON DELETE CASCADE |
| totalHouseholds | int NOT NULL | 가입 시점 세대수 스냅샷 |
| createdAt | timestamptz | DEFAULT now() |

**인덱스:** `(advertisementId)`, `(apartmentId)`

> `totalHouseholds` 스냅샷 이유: 아파트 세대수가 바뀌어도 기존 계약 금액에 영향 없도록

---

### 6. `advertisement_regions_v2`
지역 기반 타겟팅 (기존 구조 유지).

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | |
| advertisementId | uuid FK NOT NULL | → advertisements_v2(id) ON DELETE CASCADE |
| regionSido | text NOT NULL | 시/도 |
| regionSigungu | text | nullable, 시/군/구 |
| regionDong | text | nullable, 읍/면/동 |
| createdAt | timestamptz | DEFAULT now() |

---

### 7. `ad_billing_keys_v2`
정기결제 빌링키 저장. **RLS: 본인만 접근 가능.**

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | |
| partnerId | uuid FK NOT NULL | → partner_users(id) ON DELETE CASCADE |
| billingKey | text NOT NULL | PG사 발급 빌링키 (AES-256 암호화 저장) |
| cardLastFour | text | nullable, 카드 끝 4자리 |
| cardCompany | text | nullable, 카드사명 |
| isActive | bool | DEFAULT true |
| createdAt | timestamptz | DEFAULT now() |
| updatedAt | timestamptz | DEFAULT now() |

> 빌링키는 파트너 단위로 관리. 광고와의 연결은 `ad_subscriptions_v2`에서 담당.

**카드 변경 플로우 (Edge Function):**
```
파트너가 카드 변경 요청
  → PG사에 기존 빌링키 삭제 요청 후 새 카드로 빌링키 재발급
    PG사가 새 빌링키 반환:
      → ad_billing_keys_v2 기존 row: isActive=false
      → ad_billing_keys_v2 새 row INSERT
      → ad_subscriptions_v2 활성 구독(active/grace_period/cancel_pending)의 billingKeyId → 새 row ID로 UPDATE
    PG사가 동일 빌링키 갱신(카드 번호만 변경):
      → ad_billing_keys_v2 기존 row UPDATE (cardLastFour, cardCompany 갱신)
      → ad_subscriptions_v2 billingKeyId 변경 불필요
```

**보안 정책:**

**AES-256 암호화:**
- `billingKey`는 DB에 평문으로 저장하지 않고 AES-256으로 암호화 후 저장
- 암호화 키는 Supabase Edge Function 환경변수에만 보관 (`BILLING_KEY_SECRET`)
- 복호화는 Edge Function 내에서만 수행 → 클라이언트에 복호화 키 노출 없음
- Supabase `pgcrypto` 익스텐션의 `pgp_sym_encrypt` / `pgp_sym_decrypt` 활용 가능

```sql
-- 저장 시 (Edge Function에서)
pgp_sym_encrypt(billingKey, env.BILLING_KEY_SECRET)

-- 조회 시 (Edge Function에서)
pgp_sym_decrypt(billingKey::bytea, env.BILLING_KEY_SECRET)
```

**RLS 정책:**
```sql
-- SELECT/UPDATE/DELETE: auth.uid() = (SELECT userId FROM partner_users WHERE id = partnerId)
-- INSERT: 서비스 롤 전용 (결제 완료 후 서버에서 저장)
```

---

### 8. `ad_subscriptions_v2` ⭐
정기결제 구독 관리. 광고 라이프사이클과 결제/구독 라이프사이클을 분리.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | |
| advertisementId | uuid FK NOT NULL | → advertisements_v2(id) ON DELETE CASCADE (1:N, 재활성화 시 새 row) |
| billingKeyId | uuid FK | → ad_billing_keys_v2(id) SET NULL |
| subscriptionStatus | text NOT NULL | 'active'\|'grace_period'\|'cancel_pending'\|'cancelled'\|'expired' |
| originalMonthlyAmount | int NOT NULL | 할인 전 정상 월 청구 금액 (totalHouseholds_합산 × pricePerHousehold) |
| discountRate | int NOT NULL | DEFAULT 28. 적용 할인율(%). 구독 생성 시 스냅샷: hasCancelledSubscription=false → advertisements_v2.approvedDiscountRate ?? ad_pricing_v2.defaultDiscountRate, hasCancelledSubscription=true → 0 |
| monthlyAmount | int NOT NULL | 실제 청구 금액 스냅샷 = originalMonthlyAmount × (1 - discountRate/100) |
| periodStartDate | timestamptz NOT NULL | 이 구독 기간 시작일 (= activatedAt 기록 시각). 재활성화 시 새 row에 새 값 저장 |
| freeEndDate | timestamptz NOT NULL | 무료기간 종료일. hasCancelledSubscription=false → periodStartDate + (freeMonths + adminExtraMonths)개월. hasCancelledSubscription=true → periodStartDate (무료 없음, 의도적으로 동일 값 저장) |
| nextBillingDate | timestamptz | nullable, 다음 결제 예정일 |
| graceEndDate | timestamptz | nullable, 유예기간 종료일 (결제 실패일 + 3일) |
| retryCount | int | DEFAULT 0, 결제 재시도 횟수 |
| lastRetryAt | timestamptz | nullable, 마지막 재시도 시각 |
| cancelRequestedAt | timestamptz | nullable, 취소 신청 시각 |
| cancelEffectiveAt | timestamptz | nullable, 취소 효력 발생일 (현재 기간 종료 시) |
| cancelReason | text | nullable |
| createdAt | timestamptz | DEFAULT now() |
| updatedAt | timestamptz | DEFAULT now() |

**구독 상태 흐름:**
```
active → (결제 실패) → grace_period → (재시도 성공) → active
                                    → (유예기간 만료) → expired
active → cancel_pending → cancelled
```

**인덱스:** `(advertisementId)`, `(subscriptionStatus, nextBillingDate)`

```sql
-- 광고당 활성 구독 중복 방지 (버그로 인한 이중 구독 차단)
CREATE UNIQUE INDEX ON ad_subscriptions_v2 ("advertisementId")
WHERE "subscriptionStatus" IN ('active', 'grace_period', 'cancel_pending');
```

> UNIQUE(advertisementId) 전체 제약 없음 — 재활성화 시 새 row를 생성하므로 1:N 허용.

---

### 9. `ad_payment_history_v2`
결제 내역 (정기결제 이력).

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | |
| subscriptionId | uuid FK NOT NULL | → ad_subscriptions_v2(id) |
| billingKeyId | uuid FK | → ad_billing_keys_v2(id) |
| supplyAmount | int NOT NULL | 공급가액 (부가세 제외) |
| vatAmount | int NOT NULL | 부가세 (supplyAmount * 0.1) |
| amount | int NOT NULL | 최종 결제 금액 (supplyAmount + vatAmount) |
| paymentDate | timestamptz | DEFAULT now() |
| billingPeriodStart | timestamptz NOT NULL | 과금 기간 시작 |
| billingPeriodEnd | timestamptz NOT NULL | 과금 기간 종료 |
| status | text NOT NULL | 'success'\|'failed'\|'cancelled' |
| pgTransactionId | text | nullable, PG사 거래 ID |
| receiptUrl | text | nullable, PG사 발급 영수증 URL (법적 증빙) |
| receiptIssuedAt | timestamptz | nullable, 영수증 발행 시각 |
| failReason | text | nullable |
| createdAt | timestamptz | DEFAULT now() |

**인덱스:** `(subscriptionId)`, `(billingKeyId)`

---

### 10. `event_advertisements_v2` ⭐
광고중(running+paid) 상태인 광고에 연결되는 단발성 이벤트.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | |
| advertisementId | uuid FK NOT NULL | → advertisements_v2(id) ON DELETE CASCADE |
| eventTitle | text NOT NULL | 이벤트 제목 |
| eventContent | text | nullable |
| eventStartDate | timestamptz NOT NULL | |
| eventEndDate | timestamptz NOT NULL | |
| eventStatus | text NOT NULL | 'pending'\|'approved'\|'rejected'\|'active'\|'ended' |
| paymentStatus | text NOT NULL | 'unpaid'\|'paid' DEFAULT 'unpaid' |
| amount | int | nullable, 이벤트 결제 금액 |
| pgTransactionId | text | nullable |
| approvedAt | timestamptz | nullable |
| rejectedAt | timestamptz | nullable |
| rejectReason | text | nullable, 거절 사유 |
| couponTitle | text | nullable, 쿠폰 제목 (null = 쿠폰 없는 이벤트) |
| couponExpiryDate | timestamptz | nullable, 쿠폰 사용기한 |
| createdAt | timestamptz | DEFAULT now() |
| updatedAt | timestamptz | DEFAULT now() |

**표시 상태 매핑:**
| 사용자 표시 | eventStatus | paymentStatus |
|------------|-------------|---------------|
| 이벤트 승인대기 | pending | unpaid |
| 이벤트 심사거절 | rejected | unpaid | |
| 이벤트 결제필요 | approved | unpaid |
| 이벤트 광고중 | active | paid |
| 이벤트 종료 | ended | any |

**상태 전이:**
```
pending → approved (관리자 승인)
pending → rejected (관리자 거절)
rejected → pending (파트너 수정 후 재신청)
approved → active (결제 완료)
active → ended (eventEndDate 초과 → cron)
```

**결제 방식:** 단건 PG 결제 (정기결제 빌링키와 독립). 승인 후 파트너가 별도 결제 진행.

**제약:** advertisementId로 참조하는 advertisements_v2의 adStatus='running' AND paymentStatus='paid' 여야 함 (앱 레벨에서 검증)

**인덱스:** `(advertisementId)`, `(eventStatus, paymentStatus)` WHERE eventStatus = 'active', `(eventStartDate, eventEndDate)`

---

### 11. `event_payment_history_v2` ⭐ 신규
이벤트 광고 단건 PG 결제 이력. 정기결제(`ad_payment_history_v2`)와 독립.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | DEFAULT gen_random_uuid() |
| eventId | uuid FK NOT NULL | → event_advertisements_v2(id) ON DELETE CASCADE |
| supplyAmount | int NOT NULL | 공급가액 (부가세 제외) |
| vatAmount | int NOT NULL | 부가세 (supplyAmount * 0.1) |
| amount | int NOT NULL | 최종 결제 금액 (supplyAmount + vatAmount) |
| status | text NOT NULL | 'success'\|'failed'\|'cancelled' |
| pgTransactionId | text | nullable, PG사 거래 ID |
| receiptUrl | text | nullable, 영수증 URL |
| receiptIssuedAt | timestamptz | nullable |
| failReason | text | nullable |
| paymentDate | timestamptz | DEFAULT now() |
| createdAt | timestamptz | DEFAULT now() |

**인덱스:** `(eventId)`, `(status, paymentDate)`

> `event_advertisements_v2.pgTransactionId`/`amount` 컬럼은 최신 성공 결제 요약 참조용으로 유지.
> 실패/재시도 전체 이력은 이 테이블에서 조회.

---

### 12. `event_coupon_redemptions_v2` ⭐ 신규
이벤트 쿠폰 발급·사용 추적 (이벤트 1개당 쿠폰 1개, 유저당 1발급).

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | DEFAULT gen_random_uuid() |
| eventId | uuid FK NOT NULL | → event_advertisements_v2(id) ON DELETE CASCADE |
| userId | uuid FK NOT NULL | → auth.users(id) ON DELETE CASCADE |
| issuedAt | timestamptz NOT NULL | DEFAULT now(), 쿠폰 발급 시각 |
| usedAt | timestamptz | nullable, 쿠폰 사용 시각 |
| status | text NOT NULL | 'issued'\|'used'\|'expired', DEFAULT 'issued' |
| createdAt | timestamptz | DEFAULT now() |

**제약:** UNIQUE(eventId, userId) — 동일 이벤트에서 1인 1쿠폰

**인덱스:** `(eventId)`, `(userId, status)`, UNIQUE `(eventId, userId)`

---

### 13. `ad_analytics_v2` ⭐ 신규
광고/이벤트 광고 행동 데이터 일별 집계.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | |
| targetType | text NOT NULL | 'advertisement'\|'event' |
| targetId | uuid NOT NULL | advertisements_v2.id 또는 event_advertisements_v2.id |
| date | date NOT NULL | 집계 날짜 |
| impressionCount | int | DEFAULT 0, API 노출 횟수 |
| clickCount | int | DEFAULT 0, 광고 상세 클릭 횟수 |
| phoneClickCount | int | DEFAULT 0, 전화 클릭 횟수 |
| messageClickCount | int | DEFAULT 0, 문자 클릭 횟수 |
| naverMapClickCount | int | DEFAULT 0, 네이버지도 클릭 횟수 |
| blogClickCount | int | DEFAULT 0, 블로그 클릭 횟수 |
| youtubeClickCount | int | DEFAULT 0, 유튜브 클릭 횟수 |
| instagramClickCount | int | DEFAULT 0, 인스타그램 클릭 횟수 |
| createdAt | timestamptz | DEFAULT now() |
| updatedAt | timestamptz | DEFAULT now() |

**제약:** UNIQUE(targetType, targetId, date) — 하루에 한 행

**인덱스:** `(targetType, targetId, date)`, `(targetId, date)`

**집계 방식:** 이벤트 발생 시 RPC로 atomic increment
```sql
-- 예시: 광고 클릭 시
INSERT INTO ad_analytics_v2 (targetType, targetId, date, clickCount)
VALUES ('advertisement', $id, CURRENT_DATE, 1)
ON CONFLICT (targetType, targetId, date)
DO UPDATE SET clickCount = ad_analytics_v2.clickCount + 1, updatedAt = now();
```

---

## 테이블 관계도

```
partner_users
  ├── ad_billing_keys_v2 (N, 파트너 단위 빌링키)
  └── advertisements_v2 (N)
        ├── imageUrls text[] (컬럼, 최대 7개)
        ├── advertisement_apartments_v2 (N)
        ├── advertisement_regions_v2 (N)
        ├── ad_subscriptions_v2 (N, 재활성화 시 새 row)
        │     ├── ad_billing_keys_v2 (FK)
        │     └── ad_payment_history_v2 (N)
        ├── ad_analytics_v2 (N, targetType='advertisement')
        └── event_advertisements_v2 (N, running+paid만)
              ├── couponTitle/couponExpiryDate (컬럼, 쿠폰 메타)
              ├── event_payment_history_v2 (N, 이벤트 결제 이력)
              ├── event_coupon_redemptions_v2 (N, 유저당 1발급)
              └── ad_analytics_v2 (N, targetType='event')

ad_categories_v2 (1)
  └── ad_sub_categories_v2 (N)
        └── advertisements_v2.subCategoryId
```

---

## 마이그레이션 파일 구조

`supabase/migrations/` 아래에 순서대로 생성:

1. `create_ad_categories_v2.sql` (categories + sub_categories)
2. `create_ad_pricing_v2.sql` (단가 테이블)
3. `create_advertisements_v2.sql`
4. `create_advertisement_targeting_v2.sql` (apartments + regions)
5. `create_ad_billing_v2.sql` (billing_keys + subscriptions + payment_history + RLS)
6. `create_event_advertisements_v2.sql` (쿠폰 컬럼 포함)
7. `create_event_payment_history_v2.sql` (이벤트 단건 결제 이력 + RLS)
8. `create_event_coupon_redemptions_v2.sql` (쿠폰 발급/사용 추적)
9. `create_ad_analytics_v2.sql` (analytics + UNIQUE 제약 + increment RPC)

---

## 구현 완료 범위

- **관리자 웹 대시보드 — 광고 신청 관리** (`app/admin/advertising-v2/applications/`)
  - 목록 페이지: `adStatus='pending'` 필터, 상태 뱃지, 아파트 수 표시
  - 상세 페이지 UI: 2컬럼 레이아웃, 상태 색상 뱃지, 이미지 갤러리, sticky 액션 버튼
  - 승인 다이얼로그: 추가 무료 개월 수 + 할인율 입력 (기본값 `defaultDiscountRate` 자동 로드)
  - 거절 다이얼로그: 거절 사유 필수 입력
  - 재신청 파트너 할인율 0% 처리: 동일 파트너의 `adStatus='ended' AND paymentStatus='paid'` 이력 조회 → 있으면 할인율 0% 적용
  - 결제 예정금액 10원 단위 반올림 (`Math.round(금액 / 10) * 10`)
  - 기본 할인율 28%로 변경 (코드 fallback + `ad_pricing_v2` DB)
  - 승인 API: `approvedMonthlyAmount` 계산(10원 단위 반올림) 후 저장
  - API: `POST /api/advertising-v2/applications/[id]/approve|reject`
  - 사이드바: 광고 시스템 메뉴 내 "광고 신청 관리" 항목 + 뱃지 카운트
  - DB 마이그레이션 (dev): `advertisements_v2.approvedMonthlyAmount integer` 컬럼 추가

## 미포함 범위 (추후 구현)

- Flutter 모델/Repository/Provider 코드
- PG사 연동 코드 (Portone 등)
- 관리자 웹 대시보드 — 구독·결제 이력 조회, 이벤트 광고 승인 관리

---

## RLS 전략

### 접근 주체

| 주체 | 식별 방법 |
|------|-----------|
| 일반 사용자 (GENERAL/APARTMENT) | `authenticated` + `user.registrationType IN ('GENERAL','APARTMENT')` — 별도 role 없음 |
| 파트너 | `auth.uid()` → `partner_users.userId` |
| 관리자 | `auth.uid()` → `user_roles.role IN ('MANAGER','SUPER_ADMIN')` |
| 서비스 롤 | `service_role` (RLS 자동 bypass) |

> 일반 사용자는 `user_roles`에 별도 row가 없으므로, RLS에서 "파트너도 관리자도 아닌 authenticated 사용자"로 처리.

---

### 공통 Helper 함수 (SECURITY DEFINER)

```sql
-- 관리자 여부 확인
CREATE OR REPLACE FUNCTION is_admin()
RETURNS bool LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE "userId" = auth.uid()
      AND role IN ('MANAGER', 'SUPER_ADMIN')
  );
$$;

-- 현재 유저의 partner_users.id 반환 (파트너가 아니면 NULL)
CREATE OR REPLACE FUNCTION my_partner_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id FROM partner_users WHERE "userId" = auth.uid();
$$;
```

> `SECURITY DEFINER`로 실행해 RLS 재귀 방지 및 성능 보장.

---

### 테이블별 RLS 정책

#### `ad_categories_v2` / `ad_sub_categories_v2`

| 연산 | 허용 주체 | 조건 |
|------|-----------|------|
| SELECT | 전체 (anon 포함) | 광고 목록 진입 전 카테고리 노출 |
| INSERT/UPDATE/DELETE | 관리자 | `is_admin()` |

```sql
ALTER TABLE ad_categories_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories_select" ON ad_categories_v2
  FOR SELECT USING (true);

CREATE POLICY "categories_admin_write" ON ad_categories_v2
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- ad_sub_categories_v2 동일 패턴
```

---

#### `advertisements_v2` ⭐

| 연산 | 허용 주체 | 조건 |
|------|-----------|------|
| SELECT | 파트너(본인), APP_USER, 관리자 | APP_USER는 running+paid만 |
| INSERT | 파트너 | `partnerId = my_partner_id()` |
| UPDATE | 파트너(본인), 관리자 | |
| DELETE | 관리자 | 파트너는 adStatus 변경으로 처리 |

```sql
ALTER TABLE advertisements_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ads_select" ON advertisements_v2
  FOR SELECT TO authenticated USING (
    is_admin()
    OR "partnerId" = my_partner_id()
    OR ("adStatus" = 'running' AND "paymentStatus" = 'paid')
  );

CREATE POLICY "ads_insert" ON advertisements_v2
  FOR INSERT TO authenticated
  WITH CHECK ("partnerId" = my_partner_id());

-- running 상태 광고를 파트너가 수정하면 앱 레벨에서 adStatus를 pending으로 변경해야 함 (재승인 필요)
-- RLS는 상태 제한 없이 파트너에게 UPDATE 허용, 재승인 로직은 앱/Repository에서 처리
CREATE POLICY "ads_update" ON advertisements_v2
  FOR UPDATE TO authenticated
  USING (is_admin() OR "partnerId" = my_partner_id())
  WITH CHECK (is_admin() OR "partnerId" = my_partner_id());

CREATE POLICY "ads_delete" ON advertisements_v2
  FOR DELETE TO authenticated USING (is_admin());
```

---

#### `advertisement_apartments_v2` / `advertisement_regions_v2`

| 연산 | 허용 주체 | 조건 |
|------|-----------|------|
| SELECT | 파트너(본인 광고), 관리자, APP_USER | APP_USER는 running+paid 광고의 것만 |
| INSERT/UPDATE/DELETE | 파트너(draft/pending 상태 광고), 관리자 | |

```sql
ALTER TABLE advertisement_apartments_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ad_targeting_select" ON advertisement_apartments_v2
  FOR SELECT TO authenticated USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM advertisements_v2 a WHERE a.id = "advertisementId"
        AND (
          a."partnerId" = my_partner_id()
          OR (a."adStatus" = 'running' AND a."paymentStatus" = 'paid')
        )
    )
  );

CREATE POLICY "ad_targeting_write" ON advertisement_apartments_v2
  FOR ALL TO authenticated USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM advertisements_v2 a WHERE a.id = "advertisementId"
        AND a."partnerId" = my_partner_id()
        AND a."adStatus" IN ('draft', 'pending')
    )
  );

-- advertisement_regions_v2 동일 패턴
```

---

#### `ad_billing_keys_v2` ⭐ (보안 최우선)

| 연산 | 허용 주체 | 조건 |
|------|-----------|------|
| SELECT | 파트너(본인) | `partnerId = my_partner_id()` |
| INSERT/UPDATE/DELETE | 서비스 롤 전용 | 클라이언트 직접 쓰기 차단 |

```sql
ALTER TABLE ad_billing_keys_v2 ENABLE ROW LEVEL SECURITY;

-- SELECT만 파트너에게 허용, 나머지는 service_role(RLS bypass)만 가능
CREATE POLICY "billing_keys_select" ON ad_billing_keys_v2
  FOR SELECT TO authenticated
  USING ("partnerId" = my_partner_id());
```

> `billingKey`는 AES-256 암호화 저장. 복호화는 Edge Function 내부에서만.

---

#### `ad_subscriptions_v2`

| 연산 | 허용 주체 | 조건 |
|------|-----------|------|
| SELECT | 파트너(본인 광고), 관리자 | |
| INSERT | 서비스 롤 전용 | 결제 처리 Edge Function |
| UPDATE | 파트너(cancel_pending 변경만), 서비스 롤 | 파트너는 취소 신청만 가능 |
| DELETE | 없음 | |

```sql
ALTER TABLE ad_subscriptions_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_select" ON ad_subscriptions_v2
  FOR SELECT TO authenticated USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM advertisements_v2 a WHERE a.id = "advertisementId"
        AND a."partnerId" = my_partner_id()
    )
  );

-- 파트너는 active 상태인 자신의 구독을 cancel_pending으로만 변경 가능
-- cancelRequestedAt, cancelReason 필드도 함께 설정 (앱 레벨에서 처리)
CREATE POLICY "subscriptions_cancel" ON ad_subscriptions_v2
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM advertisements_v2 a WHERE a.id = "advertisementId"
        AND a."partnerId" = my_partner_id()
    )
    AND "subscriptionStatus" = 'active'
  )
  WITH CHECK ("subscriptionStatus" = 'cancel_pending');
```

---

#### `ad_payment_history_v2`

| 연산 | 허용 주체 | 조건 |
|------|-----------|------|
| SELECT | 파트너(본인 구독 이력), 관리자 | |
| INSERT/UPDATE/DELETE | 서비스 롤 전용 | 불변 이력 |

```sql
ALTER TABLE ad_payment_history_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_history_select" ON ad_payment_history_v2
  FOR SELECT TO authenticated USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM ad_subscriptions_v2 s
      JOIN advertisements_v2 a ON a.id = s."advertisementId"
      WHERE s.id = "subscriptionId"
        AND a."partnerId" = my_partner_id()
    )
  );
```

---

#### `event_advertisements_v2`

| 연산 | 허용 주체 | 조건 |
|------|-----------|------|
| SELECT | 파트너(본인), 관리자, APP_USER | APP_USER는 active+paid만 |
| INSERT | 파트너 | 광고가 running+paid일 때만 |
| UPDATE | 파트너(pending/approved 상태), 관리자 | |
| DELETE | 관리자 | |

```sql
ALTER TABLE event_advertisements_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_select" ON event_advertisements_v2
  FOR SELECT TO authenticated USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM advertisements_v2 a WHERE a.id = "advertisementId"
        AND a."partnerId" = my_partner_id()
    )
    OR ("eventStatus" = 'active' AND "paymentStatus" = 'paid')
  );

CREATE POLICY "events_insert" ON event_advertisements_v2
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM advertisements_v2 a WHERE a.id = "advertisementId"
        AND a."partnerId" = my_partner_id()
        AND a."adStatus" = 'running' AND a."paymentStatus" = 'paid'
    )
  );

CREATE POLICY "events_update" ON event_advertisements_v2
  FOR UPDATE TO authenticated
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM advertisements_v2 a WHERE a.id = "advertisementId"
        AND a."partnerId" = my_partner_id()
        AND "eventStatus" IN ('pending', 'approved')
    )
  );

CREATE POLICY "events_delete" ON event_advertisements_v2
  FOR DELETE TO authenticated USING (is_admin());
```

---

#### `event_payment_history_v2`

| 연산 | 허용 주체 | 조건 |
|------|-----------|------|
| SELECT | 파트너(본인 이벤트), 관리자 | |
| INSERT/UPDATE/DELETE | 서비스 롤 전용 | 불변 이력 |

```sql
ALTER TABLE event_payment_history_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_payment_history_select" ON event_payment_history_v2
  FOR SELECT TO authenticated USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM event_advertisements_v2 e
      JOIN advertisements_v2 a ON a.id = e."advertisementId"
      WHERE e.id = "eventId" AND a."partnerId" = my_partner_id()
    )
  );
```

---

#### `event_coupon_redemptions_v2`

| 연산 | 허용 주체 | 조건 |
|------|-----------|------|
| SELECT | 본인(userId), 파트너(자신 이벤트), 관리자 | |
| INSERT | APP_USER | `userId = auth.uid()`, 수량 제한은 RPC에서 검증 |
| UPDATE | 서비스 롤 전용 | used/expired 상태 변경 |
| DELETE | 없음 | |

```sql
ALTER TABLE event_coupon_redemptions_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coupon_redemptions_select" ON event_coupon_redemptions_v2
  FOR SELECT TO authenticated USING (
    is_admin()
    OR "userId" = auth.uid()
    OR EXISTS (
      SELECT 1 FROM event_advertisements_v2 e
      JOIN advertisements_v2 a ON a.id = e."advertisementId"
      WHERE e.id = "eventId" AND a."partnerId" = my_partner_id()
    )
  );

CREATE POLICY "coupon_redemptions_insert" ON event_coupon_redemptions_v2
  FOR INSERT TO authenticated
  WITH CHECK ("userId" = auth.uid());
```

**쿠폰 발급 RPC** (유저당 1발급, 수량 제한 없음):

```sql
-- UNIQUE(eventId, userId) 제약이 중복 발급을 DB 레벨에서 차단
CREATE OR REPLACE FUNCTION issue_coupon(p_event_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id uuid;
BEGIN
  -- 이벤트 활성 상태 확인
  IF NOT EXISTS (
    SELECT 1 FROM event_advertisements_v2
    WHERE id = p_event_id AND "eventStatus" = 'active' AND "paymentStatus" = 'paid'
  ) THEN RAISE EXCEPTION 'event_not_active'; END IF;

  INSERT INTO event_coupon_redemptions_v2 ("eventId", "userId")
  VALUES (p_event_id, auth.uid()) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
```

---

#### `ad_analytics_v2`

| 연산 | 허용 주체 | 조건 |
|------|-----------|------|
| SELECT | 파트너(본인 광고/이벤트), 관리자 | |
| INSERT/UPDATE | SECURITY DEFINER RPC 전용 | 클라이언트 직접 DML 차단 |

```sql
ALTER TABLE ad_analytics_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analytics_select" ON ad_analytics_v2
  FOR SELECT TO authenticated USING (
    is_admin()
    OR (
      "targetType" = 'advertisement' AND EXISTS (
        SELECT 1 FROM advertisements_v2 a
        WHERE a.id = "targetId" AND a."partnerId" = my_partner_id()
      )
    )
    OR (
      "targetType" = 'event' AND EXISTS (
        SELECT 1 FROM event_advertisements_v2 e
        JOIN advertisements_v2 a ON a.id = e."advertisementId"
        WHERE e.id = "targetId" AND a."partnerId" = my_partner_id()
      )
    )
  );
```

**Analytics 증가 RPC** (Flutter 클라이언트에서 직접 호출):

```sql
-- Flutter: supabase.rpc('increment_analytics', params: {'p_target_type': ..., ...})
CREATE OR REPLACE FUNCTION increment_analytics(
  p_target_type text,
  p_target_id uuid,
  p_action text  -- 'impression'|'click'|'phone'|'message'|'naver_map'|'blog'|'youtube'|'instagram'
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_col text;
BEGIN
  v_col := CASE p_action
    WHEN 'impression'  THEN 'impressionCount'
    WHEN 'click'       THEN 'clickCount'
    WHEN 'phone'       THEN 'phoneClickCount'
    WHEN 'message'     THEN 'messageClickCount'
    WHEN 'naver_map'   THEN 'naverMapClickCount'
    WHEN 'blog'        THEN 'blogClickCount'
    WHEN 'youtube'     THEN 'youtubeClickCount'
    WHEN 'instagram'   THEN 'instagramClickCount'
    ELSE NULL
  END;
  IF v_col IS NULL THEN RAISE EXCEPTION 'invalid_action: %', p_action; END IF;

  -- 파트너 본인 광고/이벤트는 카운트 제외
  IF p_target_type = 'advertisement' THEN
    IF EXISTS (
      SELECT 1 FROM advertisements_v2 WHERE id = p_target_id
        AND "partnerId" = my_partner_id()
    ) THEN RETURN; END IF;
  ELSIF p_target_type = 'event' THEN
    IF EXISTS (
      SELECT 1 FROM event_advertisements_v2 e
      JOIN advertisements_v2 a ON a.id = e."advertisementId"
      WHERE e.id = p_target_id AND a."partnerId" = my_partner_id()
    ) THEN RETURN; END IF;
  END IF;

  INSERT INTO ad_analytics_v2 ("targetType", "targetId", date)
  VALUES (p_target_type, p_target_id, CURRENT_DATE)
  ON CONFLICT ("targetType", "targetId", date) DO NOTHING;

  EXECUTE format(
    'UPDATE ad_analytics_v2 SET "%I" = "%I" + 1, "updatedAt" = now()
     WHERE "targetType" = $1 AND "targetId" = $2 AND date = CURRENT_DATE',
    v_col, v_col
  ) USING p_target_type, p_target_id;
END;
$$;
```

---

### 마이그레이션 파일 구조

`supabase/migrations/` 에 순서대로 생성:

```
create_ad_rls_helpers.sql          ← is_admin(), my_partner_id() 헬퍼 함수
create_ad_categories_v2_rls.sql   ← categories + sub_categories RLS
create_advertisements_v2_rls.sql  ← advertisements + targeting(apartments/regions) RLS
create_ad_billing_v2_rls.sql      ← billing_keys + subscriptions + payment_history RLS
create_event_ads_v2_rls.sql       ← events + coupon_redemptions RLS + issu                  e_coupon RPC
create_ad_analytics_v2_rls.sql    ← analytics RLS + increment_analytics RPC
```
