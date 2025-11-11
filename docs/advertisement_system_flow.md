# 광고 시스템 전체 플로우

> 울단지 앱의 광고 시스템 - 매니저 회원가입부터 광고 노출까지의 전체 프로세스

---

## 목차

1. [시스템 개요](#시스템-개요)
2. [매니저 회원가입 및 등록](#매니저-회원가입-및-등록)
3. [광고주 등록](#광고주-등록)
4. [광고 카테고리 관리](#광고-카테고리-관리)
5. [광고 등록](#광고-등록)
6. [광고 노출 로직](#광고-노출-로직)
7. [RLS 권한 정책](#rls-권한-정책)
8. [전체 플로우 다이어그램](#전체-플로우-다이어그램)

---

## 시스템 개요

### 주요 역할

| 역할           | 설명                                                                 |
| -------------- | -------------------------------------------------------------------- |
| **슈퍼 관리자** | 매니저 계정 생성, 전체 시스템 관리                                   |
| **매니저**      | 영업 담당자 - 광고주 등록, 광고 생성, 아파트 등록                    |
| **광고주**      | 실제 사업자 - 광고를 원하는 업체 (시스템에 로그인하지 않음)          |
| **일반 사용자** | 아파트 거주자 - 앱에서 자기 지역/아파트에 맞는 광고를 봄             |

### 광고 타입

| 타입               | 설명                                      | 타겟팅 방식                    |
| ------------------ | ----------------------------------------- | ------------------------------ |
| **동네 광고**      | 특정 아파트만 선택해서 광고               | `advertisement_apartments` 연결 |
| **지역 광고**      | 구/동 단위로 넓은 지역에 광고             | `regionSido/Sigungu/Dong` 필터 |

---

## 매니저 회원가입 및 등록

### 1단계: 슈퍼 관리자가 매니저 계정 생성

> ❗ **중요**: 매니저는 자가 가입 불가, 슈퍼 관리자만 생성 가능

**관리자 페이지 (Supabase Auth)**

```typescript
// 1. Supabase Auth로 매니저 이메일 계정 생성
const { data: authUser, error } = await supabase.auth.admin.createUser({
  email: 'manager@example.com',
  password: 'secure-password',
  email_confirm: true, // 이메일 인증 자동 완료
});

// 2. user 테이블에 기본 정보 저장 (Supabase Auth 트리거로 자동 생성됨)
// registrationType = 'GENERAL' (매니저는 아파트 등록 안함)

// 3. user_roles 테이블에 MANAGER 역할 추가
await supabase.from('user_roles').insert({
  userId: authUser.user.id,
  role: 'MANAGER',
});

// 4. manager_profiles 테이블에 매니저 추가 정보 저장
await supabase.from('manager_profiles').insert({
  userId: authUser.user.id,
  businessRegistration: '사업자등록증_URL',
  address: '매니저 회사 주소',
  memo: '영업 담당 지역: 서울 남부',
});
```

### 2단계: 매니저 로그인 및 프로필 확인

**매니저 웹 패널**

```typescript
// 매니저 로그인
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'manager@example.com',
  password: 'secure-password',
});

// 매니저 역할 확인
const { data: roles } = await supabase
  .from('user_roles')
  .select('role')
  .eq('userId', data.user.id);

if (!roles.some(r => r.role === 'MANAGER')) {
  throw new Error('매니저 권한이 없습니다');
}
```

### 3단계: 매니저가 아파트 등록 (영업 후)

> 매니저가 영업해서 계약한 아파트를 시스템에 등록

**매니저 웹 패널**

```typescript
// 1. 아파트 검색 또는 신규 등록
const { data: apartment } = await supabase
  .from('apartments')
  .select('id, name, address')
  .eq('name', '○○아파트')
  .single();

// 2. manager_apartments에 연결 (내가 관리하는 아파트로 등록)
await supabase.from('manager_apartments').insert({
  managerId: currentUserId, // 현재 로그인한 매니저
  apartmentId: apartment.id,
});
```

**RLS 확인**: 매니저는 자기가 등록한 아파트만 조회/관리 가능

---

## 광고주 등록

> 매니저가 영업한 사업자(광고주) 정보를 시스템에 등록

**매니저 웹 패널**

```typescript
// 광고주 정보 등록
const { data: advertiser } = await supabase
  .from('advertisers')
  .insert({
    businessName: '○○필라테스',
    businessType: '헬스/필라테스',
    representativeName: '홍길동',
    email: 'business@example.com',
    phoneNumber: '02-1234-5678',
    businessRegistration: 'storage_url/사업자등록증.jpg',
    address: '서울 관악구 봉천동 123-45',
    representativeImage: 'storage_url/대표이미지.jpg',
    logo: 'storage_url/로고.png',
    description: '20년 경력의 전문 필라테스 강사진',
    website: 'https://example.com',
    contractStartDate: '2025-01-01T00:00:00Z',
    contractEndDate: '2025-12-31T23:59:59Z',
    contractDocument: 'storage_url/계약서.pdf',
    contractMemo: '월 50만원, 3개월 선불',
    createdBy: currentUserId, // 현재 로그인한 매니저
    isActive: true,
  })
  .select()
  .single();
```

**필드 설명**:
- `businessRegistration`: 사업자등록증 이미지 (Supabase Storage)
- `address`: 광고주의 **실제 사업장 위치** (광고 타겟팅과 무관)
- `contractStartDate/EndDate`: 계약 기간 (광고 게시 기간과 별개)
- `createdBy`: 등록한 매니저 ID (RLS로 본인만 조회 가능)

---

## 광고 카테고리 관리

> 슈퍼 관리자가 광고 카테고리를 생성하고 시간대별 노출 제어 설정

**관리자 페이지**

```typescript
// 카테고리 생성
await supabase.from('ad_categories').insert({
  categoryName: '필라테스',
  iconUrl: 'storage_url/icons/pilates.png',
  orderIndex: 1, // 표시 순서 (작을수록 상단)

  // 평일 노출 설정 (월~금)
  weekdayEnabled: true,
  weekdayStartTime: '09:00:00', // 오전 9시부터
  weekdayEndTime: '18:00:00',   // 오후 6시까지

  // 주말 노출 설정 (토~일)
  weekendEnabled: true,
  weekendStartTime: '10:00:00', // 오전 10시부터
  weekendEndTime: '17:00:00',   // 오후 5시까지

  isActive: true,
});
```

**시간 제어 로직 (앱에서 구현)**:

```dart
// 현재 시간이 카테고리 노출 시간에 포함되는지 확인
bool isCategoryVisible(AdCategory category) {
  final now = DateTime.now();
  final currentTime = TimeOfDay.fromDateTime(now);
  final isWeekend = now.weekday >= 6; // 토(6), 일(7)

  if (isWeekend) {
    if (!category.weekendEnabled) return false;
    if (category.weekendStartTime == null || category.weekendEndTime == null) {
      return true; // 시간 제한 없음
    }
    return _isTimeBetween(currentTime,
      category.weekendStartTime!,
      category.weekendEndTime!
    );
  } else {
    if (!category.weekdayEnabled) return false;
    if (category.weekdayStartTime == null || category.weekdayEndTime == null) {
      return true; // 시간 제한 없음
    }
    return _isTimeBetween(currentTime,
      category.weekdayStartTime!,
      category.weekdayEndTime!
    );
  }
}

bool _isTimeBetween(TimeOfDay current, TimeOfDay start, TimeOfDay end) {
  final currentMinutes = current.hour * 60 + current.minute;
  final startMinutes = start.hour * 60 + start.minute;
  final endMinutes = end.hour * 60 + end.minute;
  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}
```

---

## 광고 등록

### 동네 광고 (특정 아파트 타겟팅)

**매니저 웹 패널**

```typescript
// 1. 광고 생성
const { data: ad } = await supabase
  .from('advertisements')
  .insert({
    advertiserId: advertiserId, // 위에서 등록한 광고주
    categoryId: categoryId,     // 필라테스 카테고리
    adType: 'NEIGHBORHOOD',     // 동네 광고
    regionSido: null,           // 동네 광고는 NULL
    regionSigungu: null,
    regionDong: null,
    title: '신규 회원 50% 할인 이벤트',
    imageUrl: 'storage_url/ads/pilates_promo.jpg',
    linkUrl: 'https://example.com/promotion',
    startDate: '2025-01-01T00:00:00Z',
    endDate: '2025-01-31T23:59:59Z',
    createdBy: currentUserId,   // 현재 로그인한 매니저
    isActive: true,
  })
  .select()
  .single();

// 2. 타겟 아파트 연결 (A, B, C 아파트에만 광고)
const targetApartments = ['apt-A-uuid', 'apt-B-uuid', 'apt-C-uuid'];

await supabase.from('advertisement_apartments').insert(
  targetApartments.map(aptId => ({
    advertisementId: ad.id,
    apartmentId: aptId,
  }))
);
```

**노출 대상**:
- A 아파트 거주자 ✅
- B 아파트 거주자 ✅
- C 아파트 거주자 ✅
- 기타 아파트 거주자 ❌

### 지역 광고 (구/동 단위 타겟팅)

**매니저 웹 패널**

```typescript
// 지역 광고 생성 (관악구 전체)
await supabase.from('advertisements').insert({
  advertiserId: advertiserId,
  categoryId: categoryId,
  adType: 'REGION',           // 지역 광고
  regionSido: '서울',          // 필수
  regionSigungu: '관악구',     // 선택
  regionDong: null,           // 선택 (NULL = 전체 구)
  title: '영어학원 여름특강 모집',
  imageUrl: 'storage_url/ads/english_academy.jpg',
  linkUrl: 'https://example.com',
  startDate: '2025-06-01T00:00:00Z',
  endDate: '2025-08-31T23:59:59Z',
  createdBy: currentUserId,
  isActive: true,
});

// ❗ advertisement_apartments 테이블에는 연결하지 않음
```

**노출 대상**:
- 서울 관악구 거주자 전체 ✅
  - 관악구 A 아파트 ✅
  - 관악구 B 아파트 ✅
  - 관악구 모든 아파트 ✅
- 다른 구 거주자 ❌

### 지역 광고 세분화 예시

```typescript
// 예시 1: 서울 전체 (시/도만 지정)
regionSido: '서울',
regionSigungu: null,
regionDong: null,
// → 서울시 전체 거주자에게 노출

// 예시 2: 관악구 전체 (시/군/구까지 지정)
regionSido: '서울',
regionSigungu: '관악구',
regionDong: null,
// → 서울 관악구 거주자에게만 노출

// 예시 3: 봉천동만 (동까지 지정)
regionSido: '서울',
regionSigungu: '관악구',
regionDong: '봉천동',
// → 서울 관악구 봉천동 거주자에게만 노출
```

---

## 광고 노출 로직

### 사용자 앱에서 광고 조회

**Flutter 앱**

```dart
// 1. 현재 사용자 정보 조회
final user = await supabase
  .from('user')
  .select('apartmentId, regionSido, regionSigungu, regionDong')
  .eq('id', supabase.auth.currentUser!.id)
  .single();

// 2. 광고 조회 (RLS가 자동으로 필터링)
final ads = await supabase
  .from('advertisements')
  .select('''
    *,
    advertisers(*),
    ad_categories(*),
    advertisement_apartments(apartmentId)
  ''')
  .order('createdAt', ascending: false);

// RLS 정책이 자동으로 다음 조건 적용:
// - isActive = true
// - NOW() BETWEEN startDate AND endDate
// - (지역 광고 OR 동네 광고) 필터링
```

### RLS 자동 필터링 로직

```sql
-- RLS 정책: 사용자는 자기에게 관련된 광고만 조회
CREATE POLICY "Users view relevant ads"
ON advertisements FOR SELECT
USING (
  isActive = true
  AND NOW() BETWEEN startDate AND endDate
  AND (
    -- 지역 광고: 사용자의 지역 정보와 매칭
    (
      adType = 'REGION' AND (
        regionSido = (SELECT regionSido FROM "user" WHERE id = auth.uid())
        OR regionSigungu = (SELECT regionSigungu FROM "user" WHERE id = auth.uid())
        OR regionDong = (SELECT regionDong FROM "user" WHERE id = auth.uid())
      )
    )
    OR
    -- 동네 광고: 사용자의 아파트가 연결되어 있는지 확인
    (
      adType = 'NEIGHBORHOOD' AND EXISTS (
        SELECT 1 FROM advertisement_apartments aa
        WHERE aa.advertisementId = advertisements.id
          AND aa.apartmentId = (SELECT apartmentId FROM "user" WHERE id = auth.uid())
      )
    )
  )
);
```

### 카테고리별 광고 조회 (시간 제어 포함)

**Flutter 앱**

```dart
// 1. 활성 카테고리 조회 (orderIndex 순서대로)
final categories = await supabase
  .from('ad_categories')
  .select()
  .eq('isActive', true)
  .order('orderIndex');

// 2. 현재 시간에 노출 가능한 카테고리 필터링
final visibleCategories = categories.where((cat) {
  return isCategoryVisible(cat); // 위에서 정의한 함수
}).toList();

// 3. 각 카테고리별 광고 조회
for (final category in visibleCategories) {
  final categoryAds = await supabase
    .from('advertisements')
    .select('*, advertisers(*)')
    .eq('categoryId', category.id)
    .order('createdAt', ascending: false)
    .limit(10);

  // UI에 표시
  displayCategorySection(category, categoryAds);
}
```

---

## RLS 권한 정책

### 매니저 권한

```sql
-- 1. 매니저는 자기가 등록한 광고주만 조회
CREATE POLICY "Managers view own advertisers"
ON advertisers FOR SELECT
USING (createdBy = auth.uid());

CREATE POLICY "Managers insert advertisers"
ON advertisers FOR INSERT
WITH CHECK (
  createdBy = auth.uid()
  AND public.is_manager()
);

-- 2. 매니저는 자기가 등록한 광고만 조회/수정
CREATE POLICY "Managers view own ads"
ON advertisements FOR SELECT
USING (createdBy = auth.uid());

CREATE POLICY "Managers manage own ads"
ON advertisements FOR ALL
USING (createdBy = auth.uid())
WITH CHECK (
  createdBy = auth.uid()
  AND public.is_manager()
);

-- 3. 매니저는 자기가 관리하는 아파트만 조회
CREATE POLICY "Managers view own apartments"
ON manager_apartments FOR SELECT
USING (managerId = auth.uid());
```

### 헬퍼 함수

```sql
-- 매니저 역할 확인
CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE "userId" = auth.uid()
      AND role = 'MANAGER'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 슈퍼 관리자 확인
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE "userId" = auth.uid()
      AND role = 'SUPER_ADMIN'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 일반 사용자 권한

```sql
-- 광고 조회만 가능 (위의 "Users view relevant ads" 정책)
-- 생성/수정/삭제 불가

-- 카테고리 조회만 가능
CREATE POLICY "Everyone can view active categories"
ON ad_categories FOR SELECT
USING (isActive = true);
```

---

## 전체 플로우 다이어그램

### 매니저 등록 및 광고 생성 플로우

```
┌─────────────────┐
│ 슈퍼 관리자     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│ 1. 매니저 계정 생성              │
│    - Supabase Auth 계정         │
│    - user_roles: MANAGER        │
│    - manager_profiles 정보 입력  │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────┐
│ 매니저 로그인   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│ 2. 아파트 등록 (영업 후)         │
│    - manager_apartments 연결     │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ 3. 광고주 등록                   │
│    - advertisers 테이블          │
│    - 사업자 정보, 계약 정보      │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ 4. 광고 등록                     │
│    ┌─────────────┬─────────────┐│
│    │ 동네 광고   │  지역 광고  ││
│    ├─────────────┼─────────────┤│
│    │ 아파트 선택 │ 지역 선택   ││
│    │ (A,B,C)     │ (서울/관악) ││
│    └─────────────┴─────────────┘│
└─────────────────────────────────┘
```

### 사용자 광고 조회 플로우

```
┌─────────────────┐
│ 일반 사용자 앱  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│ 1. 사용자 정보 조회              │
│    - apartmentId                │
│    - regionSido/Sigungu/Dong    │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ 2. 광고 카테고리 조회            │
│    - 현재 시간에 노출 가능한지   │
│    - 평일/주말 시간대 체크       │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ 3. 광고 조회 (RLS 자동 필터링)   │
│    ┌─────────────┬─────────────┐│
│    │ 동네 광고   │  지역 광고  ││
│    ├─────────────┼─────────────┤│
│    │ 내 아파트   │ 내 지역     ││
│    │ 광고만 표시 │ 광고 표시   ││
│    └─────────────┴─────────────┘│
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ 4. UI 렌더링                     │
│    - 카테고리별 섹션             │
│    - 광고 카드 표시              │
│    - 클릭 시 linkUrl 이동        │
└─────────────────────────────────┘
```

---

## 데이터 흐름 예시

### 시나리오: 필라테스 광고 등록 및 노출

#### Step 1: 매니저가 광고 등록

```typescript
// 매니저: manager-abc (서울 남부 영업 담당)
// 관리 아파트: A아파트, B아파트

// 1. 광고주 등록
const advertiser = {
  businessName: '○○필라테스',
  address: '서울 관악구 봉천동 123',
  createdBy: 'manager-abc',
  // ... 기타 정보
};

// 2. 동네 광고 등록
const ad = {
  advertiserId: advertiser.id,
  categoryId: '필라테스-category-id',
  adType: 'NEIGHBORHOOD',
  title: '신규 회원 50% 할인',
  imageUrl: 'ad-image.jpg',
  startDate: '2025-01-01',
  endDate: '2025-01-31',
  createdBy: 'manager-abc',
};

// 3. A, B 아파트에 연결
advertisement_apartments: [
  { advertisementId: ad.id, apartmentId: 'A-apt' },
  { advertisementId: ad.id, apartmentId: 'B-apt' },
];
```

#### Step 2: 사용자가 앱에서 광고 조회

```
사용자 A (A아파트 거주):
  ✅ 광고 표시 (advertisement_apartments 연결됨)

사용자 B (B아파트 거주):
  ✅ 광고 표시 (advertisement_apartments 연결됨)

사용자 C (C아파트 거주):
  ❌ 광고 미표시 (연결 안됨)
```

#### Step 3: 같은 광고주가 지역 광고도 등록

```typescript
// 관악구 전체에 광고
const regionAd = {
  advertiserId: advertiser.id,
  adType: 'REGION',
  regionSido: '서울',
  regionSigungu: '관악구',
  title: '전지점 이벤트',
  // ...
};
```

```
사용자 A (서울 관악구 A아파트):
  ✅ 동네 광고 표시 (A아파트 연결)
  ✅ 지역 광고 표시 (관악구 거주)

사용자 D (서울 관악구 D아파트):
  ❌ 동네 광고 미표시 (D아파트 연결 안됨)
  ✅ 지역 광고 표시 (관악구 거주)

사용자 E (서울 강남구):
  ❌ 두 광고 모두 미표시
```

---

## 주요 체크리스트

### 매니저 등록 시
- [ ] 슈퍼 관리자가 Supabase Auth로 계정 생성
- [ ] `user_roles`에 `MANAGER` 역할 추가
- [ ] `manager_profiles`에 추가 정보 입력
- [ ] 매니저 로그인 후 역할 확인

### 광고 등록 시
- [ ] 광고주 정보 먼저 등록 (`advertisers`)
- [ ] 광고 타입 결정 (동네 vs 지역)
- [ ] 동네 광고: `advertisement_apartments`에 아파트 연결
- [ ] 지역 광고: `regionSido/Sigungu/Dong` 설정
- [ ] `startDate`, `endDate` 설정
- [ ] 이미지 Supabase Storage 업로드

### 앱 개발 시
- [ ] RLS 정책 신뢰 (별도 필터링 불필요)
- [ ] 카테고리 시간 제어 로직 구현
- [ ] 광고 이미지 캐싱 처리
- [ ] 광고 클릭 이벤트 처리 (`linkUrl`)
- [ ] 로딩 상태 처리

---

## 참고 자료

- [table_structure.md](./table_structure.md) - 전체 데이터베이스 스키마
- Supabase RLS 문서: https://supabase.com/docs/guides/auth/row-level-security
- Flutter Supabase 클라이언트: https://supabase.com/docs/reference/dart

---

**작성일**: 2025-01-09
**최종 수정**: 2025-01-09
