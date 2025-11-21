# Database Schema (ERD → Markdown)

> 본 문서는 제공된 ERD 스크린샷을 기반으로 작성한 **컬럼 요약 + 관계(외래키) 개요**입니다.  
> 실제 제약(UNIQUE/CHECK/RLS 등)은 운영 시점에 맞춰 추가하세요.

---

## Table: `user`

| Column            | Type        | Notes                                                                                             |
| ----------------- | ----------- | ------------------------------------------------------------------------------------------------- |
| id                | uuid        | **PK**, = `auth.users.id`                                                                         |
| createdAt         | timestamptz |                                                                                                   |
| email             | text        |                                                                                                   |
| name              | text        |                                                                                                   |
| address           | text        |                                                                                                   |
| detailAddress     | text        |                                                                                                   |
| premium           | bool        |                                                                                                   |
| birthDay          | text        | (날짜 타입으로 변경 고려)                                                                         |
| premiumExpiryDate | timestamptz |                                                                                                   |
| confirmImageUrl   | text        |                                                                                                   |
| shareUserCount    | int4        |                                                                                                   |
| recommendCode     | text        |                                                                                                   |
| openDoorCount     | int4        |                                                                                                   |
| rssLevel          | int4        |                                                                                                   |
| approvalStatus              | text        | `pending` \| `approve` \| `inactive`                                                              |
| registerMethods             | text[]      | 가입 방법 배열 (예: `['google', 'kakao']`)                                                        |
| registrationType            | text        | `GENERAL` \| `APARTMENT` - 일반회원 vs 아파트 등록회원                                            |
| apartmentId       | uuid        | **FK** → `apartments.id` **ON DELETE SET NULL** (APARTMENT 타입인 경우 필수, GENERAL인 경우 NULL) |
| buildingNumber    | int4        | 동 번호 (예: 101, 102)                                                                            |
| unit              | int4        | 호수 (예: 1023, 1034) - `unit % 100`으로 라인 매칭                                                |
| termsAgreed       | bool        |                                                                                                   |
| privacyAgreed     | bool        |                                                                                                   |
| marketingAgreed   | bool        |                                                                                                   |
| phoneNumber       | text        |                                                                                                   |
| lastAccessedAt    | timestamptz | 마지막 출입 시간 (문 열림 성공 시 업데이트)                                                       |
| regionSido                  | text        | ✓ 추가: 시/도 (예: 서울, 경기) - 다음 주소 검색 API 결과 저장                                     |
| regionSigungu               | text        | ✓ 추가: 시/군/구 (예: 관악구, 수원시) - 다음 주소 검색 API 결과 저장                              |
| regionDong                  | text        | ✓ 추가: 읍/면/동 (예: 신림동, 봉천동) - 다음 주소 검색 API 결과 저장                              |
| overlayPermissionGranted    | bool        | 오버레이 권한 허용 여부 (기본값: false)                                                           |
| platform                    | text        | 플랫폼 정보 (예: 'android', 'ios')                                                                |
| fcmToken                    | text[]      | FCM 토큰 배열 - 사용자가 여러 기기에서 로그인 시 모든 기기의 토큰 저장                            |

> **✓ 추가: 지역 정보 저장**:
>
> - 회원가입 시 다음 주소 검색 API의 결과에서 `sido`, `sigungu`, `dong` 값을 저장
> - 홈 화면 콘텐츠 필터링에 사용 (지역별 광고, 카테고리 아이템 표시)
> - NULL 허용 (기존 사용자 호환성)
>
> **호수-라인 매칭 규칙**: `unit % 100`으로 간단하게 매칭
>
> - **매칭 공식**: `unit % 100`의 값이 라인 배열에 포함되어 있는지 확인
> - **예시**:
>   - **1004호** → `1004 % 100 = 4` → `[1,2,3,4]` 배열에 4가 있으면 매칭 ✅
>   - **1044호** → `1044 % 100 = 44` → `[44]` 배열에 44가 있으면 매칭 ✅
>   - **1003호** → `1003 % 100 = 3` → `[1,2,3,4]` 배열에 3이 있으면 매칭 ✅
>   - **1099호** → `1099 % 100 = 99` → 어떤 라인 배열에도 99가 없으면 회원가입 불가 ❌
> - **관리자**: 1~99까지 라인을 배열로 자유롭게 등록 가능
>
> **제약조건**:
>
> - `CHECK (registrationType IN ('GENERAL', 'APARTMENT'))`
> - `CHECK (registrationType = 'APARTMENT' AND apartmentId IS NOT NULL AND buildingNumber IS NOT NULL AND unit IS NOT NULL)` 또는 `registrationType = 'GENERAL'`

---

## Table: `user_roles`

| Column    | Type        | Notes                                                         |
| --------- | ----------- | ------------------------------------------------------------- |
| id        | uuid        | **PK**                                                        |
| userId    | uuid        | **FK** → `user.id` **ON DELETE CASCADE**                      |
| role      | text        | 예: `APP_USER` / `APT_ADMIN` / `MANAGER` / `SUPER_ADMIN` |
| createdAt | timestamptz |                                                               |

> **제약조건**:
>
> - `UNIQUE (userId, role)`
> - **ON DELETE CASCADE**: 사용자 삭제 시 역할도 함께 삭제

---

## Table: `admin_scopes`

| Column      | Type        | Notes                                                                         |
| ----------- | ----------- | ----------------------------------------------------------------------------- |
| id          | uuid        | **PK**                                                                        |
| createdAt   | timestamptz |                                                                               |
| userId      | uuid        | **FK** → `user.id` **ON DELETE CASCADE**                                      |
| apartmentId | uuid        | **FK** → `apartments.id` **ON DELETE CASCADE** (NULL 가능)                    |
| buildingId  | uuid        | **FK** → `apartment_buildings.id` **ON DELETE CASCADE** (NULL 가능)           |
| lineId      | uuid        | **FK** → `apartment_lines.id` **ON DELETE CASCADE** (NULL 가능)               |
| scopeLevel  | text        | `APARTMENT` \| `BUILDING` \| `LINE` _(필요 시 `REGION`/`LINE_PLACE` 등 확장)_ |

> **제약조건**:
>
> - `CHECK (scopeLevel IN ('APARTMENT', 'BUILDING', 'LINE'))`
> - `CHECK` (scopeLevel에 따라 필수 FK NOT NULL)
> - `UNIQUE (userId, scopeLevel, apartmentId, buildingId, lineId)`
> - **ON DELETE CASCADE**: 사용자나 관리 대상(아파트/동/라인) 삭제 시 관리 권한도 함께 삭제

---

## Table: `apartments`

| Column    | Type        | Notes                                           |
| --------- | ----------- | ----------------------------------------------- |
| id        | uuid        | **PK**                                          |
| name      | text        |                                                 |
| address   | text        |                                                 |
| createdAt | timestamptz |                                                 |
| createdBy | uuid        | **FK** → `user.id` **ON DELETE SET NULL** - 아파트를 등록한 매니저 또는 슈퍼 어드민 |

---

## Table: `apartment_buildings`

| Column          | Type        | Notes                                          |
| --------------- | ----------- | ---------------------------------------------- |
| id              | uuid        | **PK**                                         |
| createdAt       | timestamptz |                                                |
| buildingNumber  | int4        | 예: 101, 102                                   |
| apartmentId     | uuid        | **FK** → `apartments.id` **ON DELETE CASCADE** |
| householdsCount | int4        | 동의 총 세대수                                 |

> **제약조건**:
>
> - `UNIQUE (apartmentId, buildingNumber)`
> - **ON DELETE CASCADE**: 아파트 삭제 시 해당 동들도 함께 삭제

---

## Table: `apartment_lines`

| Column     | Type        | Notes                                                                     |
| ---------- | ----------- | ------------------------------------------------------------------------- |
| id         | uuid        | **PK**                                                                    |
| createdAt  | timestamptz |                                                                           |
| line       | int4[]      | **라인 번호 배열** - 예: `[1,2,3,4]` (1~4라인), `[1,2,...,20]` (1~20라인) |
| buildingId | uuid        | **FK** → `apartment_buildings.id` **ON DELETE CASCADE**                   |

> **라인 배열 설명**:
>
> - 하나의 장치가 여러 라인을 담당할 수 있도록 **배열**로 저장
> - 예시:
>   - `[1,2,3,4]`: 끝자리 1,2,3,4호가 모두 이 라인 사용 (Case-1)
>   - `[1,2]`, `[3,4]`: 끝자리 1,2호와 3,4호가 각각 다른 라인 사용 (Case-2)
>   - `[1]`, `[2]`, `[3]`, `[4]`: 각 끝자리마다 독립 라인 (Case-3)
>   - `[1,2,3,...,40]`: 관리자가 1~40 입력 시
>
> **제약조건**:
>
> - `CHECK (array_length(line, 1) > 0)`: 배열은 비어있으면 안됨
> - **ON DELETE CASCADE**: 동 삭제 시 해당 라인들도 함께 삭제

---

## Table: `apartment_line_places`

| Column    | Type        | Notes                                               |
| --------- | ----------- | --------------------------------------------------- |
| id        | uuid        | **PK**                                              |
| lineId    | uuid        | **FK** → `apartment_lines.id` **ON DELETE CASCADE** |
| createdAt | timestamptz |                                                     |
| placeName | text        | 예: 'B1 전기실', '1F 엘리베이터홀', '각 층 현관문'  |

> **제약조건**:
>
> - `UNIQUE (lineId, placeName)` 또는 층 기준 유니크
> - **ON DELETE CASCADE**: 라인 삭제 시 해당 장소들도 함께 삭제
> - 권장: `floor_label`, `place_type` 추가 고려

---

## Table: `devices`

| Column         | Type        | Notes                                                     |
| -------------- | ----------- | --------------------------------------------------------- |
| id             | uuid        | **PK**                                                    |
| created_at     | timestamptz |                                                           |
| linePlaceId    | uuid        | **FK** → `apartment_line_places.id` **ON DELETE CASCADE** |
| macAddress     | text        | **BLE 기기 MAC 주소** (예: `74:F0:7D:B2:70:32`)           |
| devicePassword | text        | **권장:** 암호화 저장 (AES 등)                            |
| lastOpenedAt   | timestamptz | 마지막으로 문이 성공적으로 열린 시간 (고장 감지용)        |
| isWorking      | bool        | 기기 작동 여부 (기본값: true, false = 점검 중)            |

> **제약조건**:
>
> - `UNIQUE (macAddress)`
> - **ON DELETE CASCADE**: 장소 삭제 시 해당 기기들도 함께 삭제
>
> **기기 상태 관리**:
>
> - `isWorking = true`: 정상 작동 (문 열기 가능)
> - `isWorking = false`: 점검 중 (문 열기 시도 안 함, "기기가 점검중입니다" 표시)
> - `lastOpenedAt`: 24시간 이상 미사용 시 pg_cron으로 `isWorking = false` 자동 설정 가능 (선택사항)

---

## Table: `user_line_access`

| Column     | Type        | Notes                                                                                |
| ---------- | ----------- | ------------------------------------------------------------------------------------ |
| id         | uuid        | **PK**                                                                               |
| userId     | uuid        | **FK** → `user.id` **ON DELETE CASCADE** (제약명: `fk_user_line_access_user`)        |
| lineId     | uuid        | **FK** → `apartment_lines.id` **ON DELETE CASCADE**                                  |
| accessType | text        | `OWNER` \| `SHARED` \| `TEMPORARY`                                                   |
| grantedBy  | uuid        | **FK** → `user.id` **ON DELETE SET NULL** (제약명: `fk_user_line_access_granted_by`) |
| expiresAt  | timestamptz | 만료 시간 (OWNER/SHARED는 NULL, TEMPORARY는 특정 시간)                               |
| createdAt  | timestamptz | DEFAULT now()                                                                        |
| isActive   | bool        | DEFAULT true - 수동 비활성화 가능                                                    |

> **접근 유형**:
>
> - `OWNER`: 실제 거주자 (영구 접근)
> - `SHARED`: 공유 사용자 - 같은 호수의 가족/동거인 (최대 5명)
> - `TEMPORARY`: 일회성 초대 (택배, 방문객 등)
>
> **제약조건**:
>
> - `UNIQUE (userId, lineId)`
> - `CHECK (accessType IN ('OWNER', 'SHARED', 'TEMPORARY'))`
> - 애플리케이션 레벨에서 같은 호수(apartmentId + buildingNumber + unit 조합) 최대 5명 제한
>
> **외래키 삭제 규칙**:
>
> - `userId` **ON DELETE CASCADE**: 사용자 삭제 시 접근 권한도 함께 삭제
> - `lineId` **ON DELETE CASCADE**: 라인 삭제 시 접근 권한도 함께 삭제
> - `grantedBy` **ON DELETE SET NULL**: 권한을 부여한 사용자가 삭제되어도 받은 사람의 권한은 유지 (추적 정보만 NULL)

---

## Relations (요약 다이어그램)

```
auth.users.id
      │
      ▼
user.id (PK)
  ├─< user_roles.userId
  ├─< admin_scopes.userId
  ├─< user_line_access.userId
  ├─< user_line_access.grantedBy
  └─> apartments.id (apartmentId FK)

apartments.id
  └─< apartment_buildings.apartmentId
       └─< apartment_lines.buildingId
            ├─< apartment_line_places.lineId
            │    └─< devices.linePlaceId
            └─< user_line_access.lineId
```

---

## 회원가입 및 기기 접근 프로세스

### 1. 일반 회원가입 (GENERAL)

```sql
INSERT INTO user (registrationType, ...)
VALUES ('GENERAL', ...);
-- apartmentId, buildingNumber, unit은 NULL
-- 기기 제어 기능 없음
```

### 2. 아파트 등록 회원가입 (APARTMENT)

```sql
-- Step 1: 유저 생성
INSERT INTO user (registrationType, apartmentId, buildingNumber, unit, ...)
VALUES ('APARTMENT', '아파트UUID', 101, 1023, ...);

-- Step 2: 자동으로 user_line_access 생성
-- 1023호 → 1023 % 100 = 23 → 배열에 23이 포함된 라인 찾기
INSERT INTO user_line_access (userId, lineId, accessType, grantedBy)
SELECT
  '신규유저UUID',
  (SELECT id FROM apartment_lines
   WHERE buildingId = '101동UUID'
     AND (1023 % 100) = ANY(line)  -- 23 = ANY(line)
   LIMIT 1),
  'OWNER',
  '신규유저UUID';
```

### 3. 공유 사용자 추가 (최대 5명)

```dart
// 애플리케이션 레벨 체크
final existingUsers = await supabase
  .from('user_line_access')
  .select('*, user!inner(*)')
  .eq('lineId', currentLineId)
  .eq('user.apartmentId', apartmentId)
  .eq('user.buildingNumber', buildingNumber)
  .eq('user.unit', unit)
  .in('accessType', ['OWNER', 'SHARED']);

if (existingUsers.length >= 5) {
  throw Exception('같은 호수는 최대 5명까지만 등록 가능합니다');
}

// 공유 사용자 추가
await supabase.from('user_line_access').insert({
  'userId': newFamilyMemberId,
  'lineId': currentLineId,
  'accessType': 'SHARED',
  'grantedBy': ownerId,
});
```

### 4. 일회성 초대

```dart
await supabase.from('user_line_access').insert({
  'userId': guestId,
  'lineId': currentLineId,
  'accessType': 'TEMPORARY',
  'grantedBy': ownerId,
  'expiresAt': DateTime.now().add(Duration(hours: 2)),
});
```

### 5. 기기 제어 (macAddress, password 가져오기)

```dart
// 1. 유저의 라인 접근 권한 확인
final access = await supabase
  .from('user_line_access')
  .select('lineId')
  .eq('userId', currentUserId)
  .eq('isActive', true)
  .or('expiresAt.is.null,expiresAt.gt.${DateTime.now().toIso8601String()}')
  .single();

// 2. 해당 라인의 기기 정보 조회
final devices = await supabase
  .from('devices')
  .select('''
    id,
    macAddress,
    devicePassword,
    isWorking,
    apartment_line_places!inner(
      lineId,
      placeName
    )
  ''')
  .eq('apartment_line_places.lineId', access['lineId'])
  .eq('isWorking', true);  // 정상 작동 중인 기기만

// 3. BLE 기기와 통신
for (final device in devices) {
  await connectToDevice(
    macAddress: device['macAddress'],
    password: device['devicePassword'],
  );
}
```

---

## 라인 매칭 SQL 함수

### 호수에 맞는 라인 찾기 (단일 방식: unit % 100)

```sql
-- 호수에 맞는 라인 ID 찾기 함수
CREATE OR REPLACE FUNCTION find_line_for_unit(
  p_building_id uuid,
  p_unit int
)
RETURNS uuid AS $$
DECLARE
  v_line_id uuid;
  v_line_number int := p_unit % 100;
BEGIN
  -- unit % 100 값이 배열에 포함된 라인 찾기
  SELECT id INTO v_line_id
  FROM apartment_lines
  WHERE "buildingId" = p_building_id
    AND v_line_number = ANY(line)
  LIMIT 1;

  RETURN v_line_id;  -- NULL이면 가입 불가
END;
$$ LANGUAGE plpgsql;

-- 사용 예시
SELECT find_line_for_unit('101동UUID', 1004);  -- 4가 포함된 라인 반환
SELECT find_line_for_unit('101동UUID', 1044);  -- 44가 포함된 라인 반환
SELECT find_line_for_unit('101동UUID', 1023);  -- 23이 포함된 라인 반환
```

---

## 디바이스 비밀번호 암호화

### 암호화 저장 방식 (권장)

```dart
// 저장할 때
final encryptedPassword = encrypt(originalPassword, encryptionKey);
await supabase.from('devices').update({
  'devicePassword': encryptedPassword
});

// 사용할 때
final encryptedPassword = device.devicePassword;
final originalPassword = decrypt(encryptedPassword, encryptionKey);
final passwordBytes = bleService.passwordStringToBytes(originalPassword);
await bleService.sendOpenCommand(passwordBytes);
```

- **DB 저장**: 비밀번호를 암호화(AES 등)하여 저장
- **사용 시**: 복호화하여 원본 비밀번호를 얻어 BLE 기기에 전송
- **장점**: 양방향 변환 가능, DB 유출 시에도 암호화 키 없이는 복호화 불가

---

## ✓ 홈 화면 콘텐츠 관리

### Table: `home_headers`

| Column     | Type        | Notes                                                            |
| ---------- | ----------- | ---------------------------------------------------------------- |
| id         | uuid        | **PK**                                                           |
| createdAt  | timestamptz | DEFAULT now()                                                    |
| headerText | text        | 홈 화면 상단 헤더 텍스트 (예: "주민이 추천하는 믿을 수 있는 곳") |

> **설명**:
>
> - 홈 화면 상단에 표시되는 동적 헤더 텍스트 관리
> - 관리자가 텍스트를 변경하면 모든 사용자에게 즉시 반영
> - `isActive` 필드 제거됨 - 단일 레코드로 관리

---

### Table: `home_sections`

| Column       | Type        | Notes                                                                                           |
| ------------ | ----------- | ----------------------------------------------------------------------------------------------- |
| id           | uuid        | **PK**                                                                                          |
| createdAt    | timestamptz | DEFAULT now()                                                                                   |
| sectionType  | text        | 섹션 타입: `AD_CATEGORY` \| `NOTIFICATION` \| `ANNOUNCEMENT` \| `EVENT`                         |
| orderIndex   | int4        | **UNIQUE** - 섹션 표시 순서 (작을수록 상단)                                                    |
| adCategoryId | uuid        | **FK** → `ad_categories.id` **ON DELETE CASCADE** (NULL 가능, AD_CATEGORY 타입일 때만 필수)    |
| iconUrl      | text        | **고정 섹션 전용** - 알림/공지사항/이벤트 섹션의 아이콘 URL (NULL 가능)                         |
| displayName  | text        | **사용하지 않음** - NULL로 유지 (고정 섹션은 기본값 "알림", "공지사항", "이벤트" 사용)          |
| isActive     | bool        | DEFAULT true - 활성화 여부                                                                      |

> **설명**:
>
> - 홈 화면 섹션의 순서와 구성 관리
> - 광고 카테고리, 알림, 공지사항, 이벤트 섹션을 자유롭게 배치 가능
> - `orderIndex`로 섹션 순서 제어 (드래그&드롭)
>
> **섹션 타입**:
> - `AD_CATEGORY`: 광고 카테고리 섹션 (adCategoryId 필수, ad_categories.iconUrl 사용)
> - `NOTIFICATION`: 알림 섹션 (home_notifications 표시, iconUrl 변경 가능)
> - `ANNOUNCEMENT`: 공지사항 섹션 (announcements 표시, iconUrl 변경 가능)
> - `EVENT`: 이벤트 섹션 (isEvent = true인 광고 표시, iconUrl 변경 가능)
>
> **아이콘 사용 방식**:
> - **AD_CATEGORY**: `ad_categories.iconUrl` 사용 (home_sections.iconUrl은 NULL)
> - **고정 섹션** (NOTIFICATION, ANNOUNCEMENT, EVENT): `home_sections.iconUrl` 사용
> - 저장 경로: `advertisements/sections/icons/{section-id}.png`
>
> **제약조건**:
> - `CHECK (sectionType IN ('AD_CATEGORY', 'NOTIFICATION', 'ANNOUNCEMENT', 'EVENT'))`
> - `UNIQUE (orderIndex)`: 순서 중복 불가
> - **데이터 일관성 체크** (`check_section_data_consistency`):
>   ```sql
>   CHECK (
>     -- AD_CATEGORY: adCategoryId 필수, iconUrl/displayName은 NULL
>     (sectionType = 'AD_CATEGORY'
>      AND iconUrl IS NULL
>      AND displayName IS NULL
>      AND adCategoryId IS NOT NULL)
>     OR
>     -- 고정 섹션: adCategoryId는 NULL (iconUrl/displayName은 선택)
>     (sectionType != 'AD_CATEGORY'
>      AND adCategoryId IS NULL)
>   )
>   ```
>
> **사용 예시**:
> ```sql
> -- 홈 화면 섹션 순서 설정
> INSERT INTO home_sections (sectionType, orderIndex, adCategoryId) VALUES
>   ('AD_CATEGORY', 1, 'pilates-id'),      -- 필라테스 광고
>   ('NOTIFICATION', 2, null),             -- 알림 섹션
>   ('AD_CATEGORY', 3, 'academy-id'),      -- 학원 광고
>   ('ANNOUNCEMENT', 4, null),             -- 공지사항 섹션
>   ('EVENT', 5, null),                    -- 이벤트 섹션
>   ('AD_CATEGORY', 6, 'realestate-id');   -- 부동산 광고
> ```

---

### Table: `home_notifications`

| Column     | Type        | Notes                                    |
| ---------- | ----------- | ---------------------------------------- |
| id         | uuid        | **PK**                                   |
| createdAt  | timestamptz | DEFAULT now()                            |
| title      | text        | 알림 제목 (NULL 가능)                    |
| content    | text        | 알림 내용                                |
| imageUrl   | text        | 이미지 URL (Supabase Storage, NULL 가능) |
| linkUrl    | text        | 클릭 시 이동할 URL (NULL 가능)           |
| orderIndex | int4        | 표시 순서 (작을수록 상단)                |

> **설명**:
>
> - **전국 공통 알림** - 모든 사용자에게 동일하게 표시
> - 지역 필터링 없음 (아파트 공지, 앱 업데이트 안내 등)
> - 이미지 중심 콘텐츠 (제목/내용은 선택사항)
> - **주의**: 기존 시스템이므로 수정 금지

---

### Table: `announcements`

| Column     | Type        | Notes                                    |
| ---------- | ----------- | ---------------------------------------- |
| id         | uuid        | **PK**                                   |
| createdAt  | timestamptz | DEFAULT now()                            |
| title      | text        | 공지사항 제목 (NULL 가능)                |
| content    | text        | 공지사항 내용 (NULL 가능)                |
| imageUrl   | text        | 이미지 URL (Supabase Storage, NULL 가능) |
| linkUrl    | text        | 클릭 시 이동할 URL (NULL 가능)           |
| orderIndex | int4        | 표시 순서 (작을수록 상단)                |
| isActive   | bool        | DEFAULT true - 활성화 여부               |

> **설명**:
>
> - 공지사항 관리 (home_notifications와 동일한 구조)
> - home_sections에서 ANNOUNCEMENT 타입으로 표시
> - 여러 개 등록 가능하지만 보통 소수만 사용


---

## ✓ 광고 시스템 테이블

### Table: `advertisers` (광고 업체 정보)

| Column                | Type        | Notes                                           |
| --------------------- | ----------- | ----------------------------------------------- |
| id                    | uuid        | **PK**                                          |
| createdAt             | timestamptz | DEFAULT now()                                   |
| businessName          | text        | 상호명                                          |
| representativeName    | text        | 대표자명                                        |
| email                 | text        | 이메일 (NULL 가능)                              |
| contactPhoneNumber    | text        | 광고주 연락처 (관리용, 비공개)                  |
| displayPhoneNumber    | text        | 광고 표시용 전화번호 (앱에서 보여질 공개 번호, NULL 가능) |
| address               | text        | 영업점 주소 (실제 위치)                         |
| businessRegistration  | text        | 사업자등록증 이미지 URL (NULL 가능)             |
| logo                  | text        | 로고 이미지 URL (NULL 가능)                     |
| representativeImage   | text        | 대표 이미지 URL (NULL 가능)                     |
| contractDocument      | text        | 계약서 이미지 URL (NULL 가능)                   |
| contractMemo          | text        | 계약 메모 (NULL 가능)                           |
| searchTags            | text[]      | 검색용 태그 배열 (자동 생성) - 지역, 아파트, 상호명 조합 |
| createdBy             | uuid        | **FK** → `user.id` - 등록한 매니저              |

> **설명**:
>
> - 광고주/업체의 **기본 정보 및 계약 정보** 관리
> - 매니저가 영업 후 등록
> - 하나의 업체가 여러 광고 등록 가능 (현재는 1:1, 향후 1:N 확장 가능)
> - 광고별 세부 정보(소개내용, 활성화 여부 등)는 `advertisements` 테이블에서 관리
>
> **전화번호 필드 설명**:
>
> - `contactPhoneNumber` (필수): 광고주 연락처 - 관리자만 볼 수 있는 내부 연락용 번호
> - `displayPhoneNumber` (선택): 광고 표시용 전화번호 - 앱에서 사용자에게 보여지는 공개 번호
> - 두 필드 모두 휴대폰(010) 및 유선전화(02, 031 등) 형식 지원
> - 자동 포맷팅: 입력 시 하이픈(-) 자동 추가 (예: 01012345678 → 010-1234-5678)
>
> **검색 태그 (`searchTags`) 자동 생성**:
>
> - 광고 등록/수정 시 자동으로 생성되는 검색용 태그 배열
> - GIN 인덱스로 빠른 배열 검색 지원
> - **생성 규칙**:
>   - 기본: 상호명, 상호명(공백제거), 개별 키워드
>   - **REGION 광고**: `{지역}_{상호명}`, `{지역}_{키워드}` 형식
>   - **NEIGHBORHOOD 광고**: `{아파트명}_{상호명}`, `{아파트명}_{키워드}`, `{지역}_{상호명}` 형식
>
> **검색 예시**:
> ```
> 상호명: "울단지 필라테스"
> REGION 광고: 서울 관악구
> NEIGHBORHOOD 광고: 동부아파트, 래미안아파트
>
> 생성되는 태그:
> - "울단지 필라테스", "울단지필라테스", "울단지", "필라테스"
> - "서울_울단지 필라테스", "서울_울단지", "서울_필라테스"
> - "관악구_울단지 필라테스", "관악구_울단지", "관악구_필라테스"
> - "동부아파트_울단지 필라테스", "동부아파트_울단지", "동부아파트_필라테스"
> - "래미안아파트_울단지 필라테스", "래미안아파트_울단지", "래미안아파트_필라테스"
>
> 검색 가능:
> ✓ "서울_필라테스" → 서울 지역 모든 필라테스 검색
> ✓ "동부아파트_필라테스" → 동부아파트에 광고 등록한 필라테스 검색
> ✓ "관악구_울단지" → 관악구 울단지 검색
> ✓ "필라테스" → 모든 필라테스 검색
> ```
>
> **제약조건**:
>
> - `createdBy` **FK** → `user.id` **ON DELETE SET NULL**

---

### Table: `ad_categories` (광고 카테고리)

| Column             | Type        | Notes                                   |
| ------------------ | ----------- | --------------------------------------- |
| id                 | uuid        | **PK**                                  |
| createdAt          | timestamptz | DEFAULT now()                           |
| categoryName       | text        | 카테고리 이름 (예: 필라테스, 영어학원) |
| iconUrl            | text        | 카테고리 아이콘 URL (NULL 가능)         |
| weekdayEnabled     | bool        | 평일 노출 여부 (DEFAULT true)           |
| weekdayStartTime   | time        | 평일 시작 시간 (NULL = 제한 없음)       |
| weekdayEndTime     | time        | 평일 종료 시간 (NULL = 제한 없음)       |
| weekendEnabled     | bool        | 주말 노출 여부 (DEFAULT true)           |
| weekendStartTime   | time        | 주말 시작 시간 (NULL = 제한 없음)       |
| weekendEndTime     | time        | 주말 종료 시간 (NULL = 제한 없음)       |
| isActive           | bool        | DEFAULT true - 활성화 여부              |

> **설명**:
>
> - 광고 카테고리별 노출 시간 제어
> - 평일/주말 각각 다른 시간 설정 가능
> - 카테고리 전체가 시간대별로 노출/숨김
>
> **시간 제어 예시**:
>
> ```sql
> -- 평일 9시~18시, 주말 10시~17시 노출
> INSERT INTO ad_categories (
>   categoryName,
>   weekdayEnabled, weekdayStartTime, weekdayEndTime,
>   weekendEnabled, weekendStartTime, weekendEndTime
> ) VALUES (
>   '필라테스',
>   true, '09:00', '18:00',
>   true, '10:00', '17:00'
> );
>
> -- 평일만 노출, 주말 숨김
> INSERT INTO ad_categories (
>   categoryName,
>   weekdayEnabled, weekdayStartTime, weekdayEndTime,
>   weekendEnabled
> ) VALUES (
>   '학원',
>   true, '09:00', '18:00',
>   false
> );
> ```

---

### Table: `advertisements` (광고)

| Column        | Type        | Notes                                                         |
| ------------- | ----------- | ------------------------------------------------------------- |
| id            | uuid        | **PK**                                                        |
| createdAt     | timestamptz | DEFAULT now()                                                 |
| advertiserId  | uuid        | **FK** → `advertisers.id` **ON DELETE CASCADE**               |
| categoryId    | uuid        | **FK** → `ad_categories.id` **ON DELETE SET NULL**            |
| adType        | text        | `NEIGHBORHOOD` \| `REGION` - 동네 광고 or 지역 광고           |
| title         | text        | 광고 제목                                                     |
| imageUrl      | text        | 광고 이미지 URL                                               |
| description   | text        | 소개내용 (광고별 세부 설명) (NULL 가능)                       |
| linkUrl       | text        | 클릭 시 이동할 URL (NULL 가능)                                |
| startDate     | timestamptz | 광고 게시 시작일                                              |
| endDate       | timestamptz | 광고 게시 종료일                                              |
| createdBy     | uuid        | **FK** → `user.id` - 등록한 매니저                            |
| isActive      | bool        | DEFAULT false - 활성화 여부 (수동 활성화 필요)                |

> **설명**:
>
> - 광고주가 원하는 홍보 범위에 따라 타입 결정
> - **동네 광고**: 특정 아파트만 타겟팅 (`advertisement_apartments`로 연결)
> - **지역 광고**: 여러 지역 타겟팅 (`advertisement_regions`로 연결)
> - 광고별로 다른 소개내용(`description`) 설정 가능
>
> **광고 상태 관리**:
>
> - **4가지 상태**: pending (대기중), scheduled (예정), active (진행중), ended (종료됨)
> - `isActive = false`: **대기중** - 관리자가 수동으로 활성화 필요
> - `isActive = true` + `NOW() < startDate`: **예정** - 시작일 전
> - `isActive = true` + `NOW() BETWEEN startDate AND endDate`: **진행중** - 노출 중
> - `isActive = false` (자동 비활성화): **종료됨**
>
> **자동 비활성화** (pg_cron):
>
> - 매일 오전 1시에 실행
> - `endDate < NOW()` → `isActive = false` 자동 설정
>
> **광고 등록 예시 (1:1 등록)**:
>
> ```sql
> -- Step 1: 광고주 등록 (기본 정보 + 계약 정보)
> INSERT INTO advertisers (
>   businessName, representativeName, email, phoneNumber,
>   landlineNumber, address, logo, contractDocument, contractMemo, createdBy
> ) VALUES (
>   '울단지 필라테스', '김대표', 'pilates@example.com', '010-1234-5678',
>   '02-1234-5678', '서울 관악구 신림동 123', 'logo.png',
>   'contract.pdf', '1년 계약', 'manager-id'
> ) RETURNING id; -- advertiser-id 획득
>
> -- Step 2: 광고 등록 (광고별 세부 정보)
> INSERT INTO advertisements (
>   advertiserId, categoryId, adType, title, imageUrl,
>   description, linkUrl, startDate, endDate, createdBy
> ) VALUES (
>   'advertiser-id', 'pilates-category-id', 'NEIGHBORHOOD',
>   '필라테스 신규 회원 모집', 'ad-image.jpg',
>   '관악구 최고의 필라테스 센터! 신규 회원 50% 할인',
>   'https://pilates.example.com',
>   '2024-06-01', '2024-06-30', 'manager-id'
> ) RETURNING id; -- ad-id 획득
>
> -- Step 3: 광고 노출 범위 설정
> -- 동네 광고인 경우: advertisement_apartments에 아파트 연결
> INSERT INTO advertisement_apartments (advertisementId, apartmentId) VALUES
>   ('ad-id', 'apt-A-id'),
>   ('ad-id', 'apt-B-id');
>
> -- 지역 광고인 경우: advertisement_regions에 지역 연결
> INSERT INTO advertisement_regions (advertisementId, regionSido, regionSigungu) VALUES
>   ('ad-id', '서울', '관악구');
> ```
>
> **제약조건**:
>
> - `CHECK (adType IN ('NEIGHBORHOOD', 'REGION'))`
> - **ON DELETE CASCADE**: 광고주 삭제 시 광고도 삭제
> - **ON DELETE SET NULL**: 카테고리 삭제 시 광고는 유지하되 카테고리만 NULL

---

### Table: `advertisement_apartments` (광고-아파트 연결)

| Column          | Type        | Notes                                            |
| --------------- | ----------- | ------------------------------------------------ |
| id              | uuid        | **PK**                                           |
| advertisementId | uuid        | **FK** → `advertisements.id` **ON DELETE CASCADE** |
| apartmentId     | uuid        | **FK** → `apartments.id` **ON DELETE CASCADE**     |
| createdAt       | timestamptz | DEFAULT now()                                    |

> **설명**:
>
> - 동네 광고(`adType = 'NEIGHBORHOOD'`)와 아파트를 연결
> - 다대다 관계: 하나의 광고가 여러 아파트에 노출 가능
>
> **제약조건**:
>
> - `UNIQUE (advertisementId, apartmentId)`: 중복 방지
> - **ON DELETE CASCADE**: 광고 삭제 시 연결도 삭제, 아파트 삭제 시 연결도 삭제

---

### Table: `advertisement_regions` (광고-지역 연결)

| Column          | Type        | Notes                                              |
| --------------- | ----------- | -------------------------------------------------- |
| id              | uuid        | **PK**                                             |
| advertisementId | uuid        | **FK** → `advertisements.id` **ON DELETE CASCADE** |
| regionSido      | text        | 시/도 (예: 서울, 경기) - 필수                      |
| regionSigungu   | text        | 시/군/구 (예: 관악구, 수원시) (NULL 가능)          |
| regionDong      | text        | 읍/면/동 (예: 신림동, 봉천동) (NULL 가능)          |
| createdAt       | timestamptz | DEFAULT now()                                      |

> **설명**:
>
> - 지역 광고(`adType = 'REGION'`)와 지역을 연결
> - 다대다 관계: 하나의 광고가 여러 지역에 노출 가능
> - 시/도는 필수, 시/군/구와 동은 선택적으로 좁은 범위 지정 가능
>
> **제약조건**:
>
> - `UNIQUE (advertisementId, regionSido, regionSigungu, regionDong)`: 중복 방지
> - **ON DELETE CASCADE**: 광고 삭제 시 연결도 삭제
>
> **사용 예시**:
>
> ```sql
> -- 서울 전체에 광고 노출
> INSERT INTO advertisement_regions (advertisementId, regionSido) VALUES
>   ('ad-id', '서울');
>
> -- 서울 관악구와 동작구에 광고 노출
> INSERT INTO advertisement_regions (advertisementId, regionSido, regionSigungu) VALUES
>   ('ad-id', '서울', '관악구'),
>   ('ad-id', '서울', '동작구');
>
> -- 서울 관악구 신림동에만 광고 노출
> INSERT INTO advertisement_regions (advertisementId, regionSido, regionSigungu, regionDong) VALUES
>   ('ad-id', '서울', '관악구', '신림동');
> ```

---

### Table: `manager_profiles` (매니저 추가 정보)

| Column               | Type        | Notes                                       |
| -------------------- | ----------- | ------------------------------------------- |
| id                   | uuid        | **PK**                                      |
| userId               | uuid        | **FK** → `user.id` **ON DELETE CASCADE**    |
| businessRegistration | text        | 사업자등록증 URL (선택)                     |
| address              | text        | 주소 (NULL 가능)                            |
| memo                 | text        | 메모 (NULL 가능)                            |
| createdAt            | timestamptz | DEFAULT now()                               |

> **설명**:
>
> - 매니저의 추가 정보 저장
> - `user` 테이블과 1:1 관계
>
> **제약조건**:
>
> - `UNIQUE (userId)`: 한 유저당 하나의 프로필
> - **ON DELETE CASCADE**: 유저 삭제 시 프로필도 삭제

---

### Table: `manager_apartments` (매니저-아파트 연결)

| Column      | Type        | Notes                                        |
| ----------- | ----------- | -------------------------------------------- |
| id          | uuid        | **PK**                                       |
| managerId   | uuid        | **FK** → `user.id` **ON DELETE CASCADE**     |
| apartmentId | uuid        | **FK** → `apartments.id` **ON DELETE CASCADE** |
| createdAt   | timestamptz | DEFAULT now() - 아파트 등록일                |

> **설명**:
>
> - 매니저가 영업해서 등록한 아파트 목록
> - 매니저는 자기가 등록한 아파트만 관리 가능
> - 다대다 관계: 한 매니저가 여러 아파트, 한 아파트에 여러 매니저 가능
>
> **제약조건**:
>
> - `UNIQUE (managerId, apartmentId)`: 중복 방지
> - **ON DELETE CASCADE**: 매니저 삭제 시 연결 삭제, 아파트 삭제 시 연결 삭제

---

## ✓ 광고 시스템 관계 다이어그램

```
user.id (MANAGER role)
  ├─< manager_profiles.userId (1:1)
  ├─< manager_apartments.managerId (매니저가 관리하는 아파트)
  ├─< advertisers.createdBy (매니저가 등록한 업체)
  └─< advertisements.createdBy (매니저가 등록한 광고)

advertisers.id
  └─< advertisements.advertiserId (업체의 광고)

ad_categories.id
  └─< advertisements.categoryId (카테고리별 광고)

advertisements.id
  ├─< advertisement_apartments.advertisementId (동네 광고)
  │    └─> apartments.id (동네 광고가 노출될 아파트)
  └─< advertisement_regions.advertisementId (지역 광고)
       └─> 지역 정보 (regionSido, regionSigungu, regionDong)

apartments.id
  ├─< manager_apartments.apartmentId
  └─< advertisement_apartments.apartmentId
```

---

## ✓ 광고 조회 로직 (RLS)

### 매니저: 자기가 등록한 광고만 조회

```sql
-- advertisements 테이블 RLS
CREATE POLICY "Managers view own ads"
ON advertisements FOR SELECT
USING (createdBy = auth.uid());

-- advertisers 테이블 RLS
CREATE POLICY "Managers view own advertisers"
ON advertisers FOR SELECT
USING (createdBy = auth.uid());
```

### 일반 사용자: 자기 지역/아파트 광고 조회

```sql
CREATE POLICY "Users view relevant ads"
ON advertisements FOR SELECT
USING (
  isActive = true
  AND NOW() BETWEEN startDate AND endDate
  AND (
    -- 지역 광고 (advertisement_regions 테이블 사용)
    (
      adType = 'REGION' AND EXISTS (
        SELECT 1 FROM advertisement_regions ar
        WHERE ar.advertisementId = advertisements.id
          AND (
            -- 시/도 매칭
            ar.regionSido = (SELECT regionSido FROM "user" WHERE id = auth.uid())
            -- 시/군/구 매칭 (NULL이면 모든 시/군/구 포함)
            AND (ar.regionSigungu IS NULL OR ar.regionSigungu = (SELECT regionSigungu FROM "user" WHERE id = auth.uid()))
            -- 동 매칭 (NULL이면 모든 동 포함)
            AND (ar.regionDong IS NULL OR ar.regionDong = (SELECT regionDong FROM "user" WHERE id = auth.uid()))
          )
      )
    )
    OR
    -- 동네 광고
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

> **지역 광고 매칭 로직**:
>
> - `regionSido = '서울'`: 서울에 사는 모든 사용자에게 노출
> - `regionSido = '서울', regionSigungu = '관악구'`: 서울 관악구에 사는 사용자에게만 노출
> - `regionSido = '서울', regionSigungu = '관악구', regionDong = '신림동'`: 서울 관악구 신림동에 사는 사용자에게만 노출
> - NULL 값은 "제한 없음"을 의미 (예: regionSigungu가 NULL이면 해당 시/도의 모든 시/군/구 포함)

---

## ✓ 추가: 다이얼로그 메시지 관리 테이블

### Table: `dialog_messages`

| Column      | Type        | Notes                                                  |
| ----------- | ----------- | ------------------------------------------------------ |
| id          | uuid        | **PK**                                                 |
| messageKey  | text        | **UNIQUE** - 메시지 식별자 (예: `door_opened_success`) |
| title       | text        | 다이얼로그 제목 (기본값: '')                           |
| content     | text        | 다이얼로그 내용 (NULL 가능)                            |
| description | text        | 메시지 설명 (NULL 가능)                                |
| createdAt   | timestamptz | DEFAULT now()                                          |


> **설명**:
>
> - 앱 전역에서 사용되는 다이얼로그 메시지를 동적으로 관리
> - 관리자가 메시지를 수정하면 모든 사용자에게 즉시 반영
> - 하드코딩된 문구를 DB로 이관하여 유연한 운영 가능
>
> **사용 예시**:
>
> ```sql
> -- 초기 데이터
> INSERT INTO dialog_messages (messageKey, title, content) VALUES
>   ('door_opened_success', '문이 열렸습니다!', '''울단지''가 무료로 제공해\n드리는 서비스 입니다.\n편히 사용하세요'),
>   ('door_open_failed', '문열기 실패', '다시 시도해주세요'),
>   ('bluetooth_required', '블루투스 권한 필요', '설정에서 블루투스 권한을 허용해주세요');
> ```
>
> **Flutter 사용 예시**:
>
> ```dart
> // 메시지 조회
> final message = await supabase
>   .from('dialog_messages')
>   .select()
>   .eq('messageKey', 'door_opened_success')
>   .single();
>
> // 다이얼로그 표시
> CustomDialog.show(
>   context: context,
>   title: message['title'],
>   content: message['content'],
> );
> ```
>
> **제약조건**:
>
> - `UNIQUE (messageKey)`: 메시지 키는 중복 불가

---

## ✓ 추가: 전화번호 인증 테이블

### Table: `phone_verifications`

| Column            | Type        | Notes                                       |
| ----------------- | ----------- | ------------------------------------------- |
| id                | uuid        | **PK**                                      |
| phone_number      | text        | 인증할 전화번호                             |
| verification_code | text        | 인증 코드                                   |
| created_at        | timestamptz | 생성 시간 (DEFAULT now())                   |
| expires_at        | timestamptz | 만료 시간 (DEFAULT now() + 3분)             |
| verified          | boolean     | 인증 완료 여부 (DEFAULT false)              |
| attempts          | integer     | 인증 시도 횟수 (DEFAULT 0)                  |

> **설명**:
>
> - 전화번호 인증 프로세스 관리
> - 인증 코드는 3분 후 자동 만료
> - 인증 시도 횟수 추적으로 무차별 대입 공격 방지 가능
>
> **사용 예시**:
>
> ```dart
> // 인증 코드 생성 및 저장
> final code = generateRandomCode(6); // 6자리 랜덤 코드
> await supabase.from('phone_verifications').insert({
>   'phone_number': phoneNumber,
>   'verification_code': code,
> });
>
> // 인증 코드 확인
> final verification = await supabase
>   .from('phone_verifications')
>   .select()
>   .eq('phone_number', phoneNumber)
>   .eq('verification_code', inputCode)
>   .eq('verified', false)
>   .gt('expires_at', DateTime.now().toIso8601String())
>   .single();
>
> if (verification != null) {
>   // 인증 성공 - verified를 true로 업데이트
>   await supabase.from('phone_verifications')
>     .update({'verified': true})
>     .eq('id', verification['id']);
> }
> ```

---

## ✓ 성능 최적화 인덱스

### 광고 시스템 인덱스

| 인덱스명                                  | 테이블                    | 컬럼                                       | 설명                                 |
| ----------------------------------------- | ------------------------- | ------------------------------------------ | ------------------------------------ |
| idx_advertisements_active_dates_partial   | advertisements            | startDate, endDate (WHERE isActive = true) | **활성 광고 날짜 범위 조회 (핵심, Partial)** |
| idx_advertisements_category_active        | advertisements            | categoryId, isActive                       | **카테고리별 광고 조회 (핵심)**      |
| idx_advertisements_category_id            | advertisements            | categoryId                                 | 카테고리별 광고 조회                 |
| idx_advertisements_ad_type                | advertisements            | adType                                     | 광고 타입별 조회                     |
| idx_advertisements_dates                  | advertisements            | startDate, endDate                         | 광고 날짜 범위 조회                  |
| idx_advertisements_created_by             | advertisements            | createdBy                                  | 매니저별 광고 조회                   |
| idx_advertisers_created_by                | advertisers               | createdBy                                  | 매니저별 광고 업체 조회              |
| idx_ad_apts_ad_id                         | advertisement_apartments  | advertisementId                            | 광고-아파트 연결 조회                |
| idx_ad_regions_ad_id                      | advertisement_regions     | advertisementId                            | **광고-지역 연결 조회 (핵심)**       |
| idx_ad_regions_region                     | advertisement_regions     | regionSido, regionSigungu, regionDong      | **지역별 광고 필터링 (핵심)**        |
| idx_ad_categories_order_active            | ad_categories             | orderIndex, isActive (WHERE isActive)      | 카테고리 정렬 조회 (Partial)         |

### 사용자 관련 인덱스

| 인덱스명                 | 테이블     | 컬럼                                | 설명                                   |
| ------------------------ | ---------- | ----------------------------------- | -------------------------------------- |
| idx_user_region          | user       | regionSido, regionSigungu, regionDong | **사용자 지역 기반 광고 필터링 (핵심)** |
| idx_user_apartment_id    | user       | apartmentId                         | 아파트별 사용자 조회                   |
| idx_user_phone_number    | user       | phoneNumber                         | 전화번호 중복 체크                     |

### 접근 권한 인덱스 (문 열기)

| 인덱스명                           | 테이블            | 컬럼                             | 설명                                     |
| ---------------------------------- | ----------------- | -------------------------------- | ---------------------------------------- |
| idx_user_line_access_user_active   | user_line_access  | userId, isActive (WHERE isActive) | **사용자별 활성 접근 권한 (핵심)**       |
| idx_user_line_access_line_id       | user_line_access  | lineId                           | 라인별 접근 권한 조회                    |
| idx_user_roles_user_id             | user_roles        | userId                           | 사용자별 역할 조회                       |
| idx_user_roles_role                | user_roles        | role                             | 역할별 사용자 조회                       |

### 아파트 구조 인덱스

| 인덱스명                              | 테이블                  | 컬럼         | 설명                 |
| ------------------------------------- | ----------------------- | ------------ | -------------------- |
| idx_apartments_name                   | apartments              | name         | 아파트명 검색        |
| idx_apartment_buildings_apartment_id  | apartment_buildings     | apartmentId  | 아파트별 동 조회     |
| idx_apartment_buildings_number        | apartment_buildings     | buildingNumber | 동 번호 검색         |
| idx_apartment_lines_building_id       | apartment_lines         | buildingId   | 동별 라인 조회       |
| idx_apartment_line_places_line_id     | apartment_line_places   | lineId       | 라인별 장소 조회     |

### 기기 관련 인덱스

| 인덱스명                   | 테이블   | 컬럼                          | 설명                         |
| -------------------------- | -------- | ----------------------------- | ---------------------------- |
| idx_devices_line_place_id  | devices  | linePlaceId                   | 장소별 기기 조회             |
| idx_devices_active         | devices  | isWorking (WHERE isWorking)   | 활성 기기 조회 (Partial)     |
| idx_devices_mac_address    | devices  | macAddress                    | **BLE MAC 주소 조회 (핵심)** |

### 매니저 관련 인덱스

| 인덱스명                          | 테이블              | 컬럼        | 설명                   |
| --------------------------------- | ------------------- | ----------- | ---------------------- |
| idx_manager_profiles_user_id      | manager_profiles    | userId      | 매니저 프로필 조회     |
| idx_manager_apts_manager_id       | manager_apartments  | managerId   | 매니저별 관리 아파트   |
| idx_manager_apts_apartment_id     | manager_apartments  | apartmentId | 아파트별 매니저 조회   |

### 관리자 권한 인덱스

| 인덱스명                        | 테이블        | 컬럼        | 설명                 |
| ------------------------------- | ------------- | ----------- | -------------------- |
| idx_admin_scopes_user_id        | admin_scopes  | userId      | 사용자별 관리 범위   |
| idx_admin_scopes_apartment_id   | admin_scopes  | apartmentId | 아파트별 관리자 조회 |

> **인덱스 타입**:
>
> - **Composite Index**: 여러 컬럼을 조합한 인덱스 (예: regionSido, regionSigungu, regionDong)
> - **Partial Index**: WHERE 조건이 있는 인덱스 - 특정 조건의 데이터만 인덱싱하여 크기 최적화
>
> **핵심 인덱스**:
>
> - `idx_user_region`: 광고 필터링의 핵심 - 사용자 지역 정보로 광고 조회
> - `idx_advertisements_active_dates_partial`: 활성 광고 날짜 범위 조회 (Partial Index로 최적화)
> - `idx_advertisements_category_active`: 카테고리별 활성 광고 조회
> - `idx_ad_regions_region`: 지역별 광고 필터링 (regionSido, regionSigungu, regionDong)
> - `idx_user_line_access_user_active`: 문 열기의 핵심 - 사용자 접근 권한 확인
> - `idx_devices_mac_address`: BLE 연결의 핵심 - MAC 주소로 기기 찾기

---

## Storage Bucket 폴더구조

### 1. **home-content** 버킷 (앱 전역 콘텐츠)

```
home-content/
└── notifications/ # 홈 화면 알림 이미지
    └── {notification-id}.jpg
```

> **용도**: 앱 전역에서 사용되는 콘텐츠 (홈 알림, 배너 등)

---

### 2. **advertisements** 버킷 (광고 시스템 전체)

```
advertisements/
├── categories/ # 광고 카테고리
│   └── icons/ # 카테고리 아이콘
│       └── {category-id}.png
│
├── sections/ # 홈 섹션 (고정 섹션)
│   └── icons/ # 고정 섹션 아이콘 (알림, 공지사항, 이벤트)
│       └── {section-id}.png
│
├── advertisers/ # 광고주 관련 파일
│   ├── logos/ # 광고주 로고
│   │   └── {advertiser-id}.png
│   ├── business-registrations/ # 사업자등록증
│   │   └── {advertiser-id}.jpg
│   ├── contracts/ # 계약서
│   │   └── {advertiser-id}.pdf
│   └── representative-images/ # 대표 이미지
│       └── {advertiser-id}.jpg
│
└── ads/ # 광고 이미지 (카테고리별 분류)
    ├── pilates/ # 필라테스 광고
    │   └── {ad-id}.jpg
    ├── academy/ # 학원 광고
    │   └── {ad-id}.jpg
    └── {category-name}/ # 기타 카테고리
        └── {ad-id}.jpg
```

> **용도**: 광고 시스템 관련 모든 파일 (카테고리, 광고주, 광고 이미지, 고정 섹션 아이콘)

---

### 3. **managers** 버킷 (매니저 관련)

```
managers/
└── business-registrations/ # 매니저 사업자등록증
    └── {manager-id}.jpg
```

> **용도**: 매니저 관련 파일 (사업자등록증 등)

---

## 업로드 규칙 요약

| 항목                   | 버킷              | 경로                                              |
| ---------------------- | ----------------- | ------------------------------------------------- |
| 홈 알림 이미지         | home-content      | `notifications/{notification-id}.jpg`             |
| 카테고리 아이콘        | advertisements    | `categories/icons/{category-id}.png`              |
| **고정 섹션 아이콘**   | advertisements    | `sections/icons/{section-id}.png`                 |
| 광고주 로고            | advertisements    | `advertisers/logos/{advertiser-id}.png`           |
| 광고주 사업자등록증    | advertisements    | `advertisers/business-registrations/{advertiser-id}.jpg` |
| 광고주 계약서          | advertisements    | `advertisers/contracts/{advertiser-id}.pdf`       |
| 광고주 대표 이미지     | advertisements    | `advertisers/representative-images/{advertiser-id}.jpg` |
| 광고 이미지            | advertisements    | `ads/{category-name}/{ad-id}.jpg`                 |
| 매니저 사업자등록증    | managers          | `business-registrations/{manager-id}.jpg`         |

---

## 버킷 권한 설정 (RLS)

### home-content
- **Public**: 모든 사용자 읽기 가능
- **Upload**: SUPER_ADMIN만 업로드 가능

### advertisements
- **Public**: 모든 사용자 읽기 가능
- **Upload**: SUPER_ADMIN, MANAGER 업로드 가능
- **Delete**: 본인이 생성한 파일만 삭제 가능

### managers
- **Public**: 인증된 사용자만 읽기 가능
- **Upload**: SUPER_ADMIN만 업로드 가능
- **Delete**: SUPER_ADMIN만 삭제 가능

---

## ✓ pg_cron 자동화 작업

### 1. 광고 자동 비활성화 (매일 오전 1시)

**Job 이름**: `deactivate-expired-ads`
**실행 주기**: `0 1 * * *` (매일 오전 1시)

**수행 작업**:
- 종료일이 지난 광고 자동 비활성화

```sql
-- Job 생성
SELECT cron.schedule(
  'deactivate-expired-ads',
  '0 1 * * *',
  $$
    -- endDate가 지난 광고 비활성화
    UPDATE advertisements
    SET "isActive" = false
    WHERE "isActive" = true
      AND "endDate" < NOW();
  $$
);
```

### 2. APP_USER 30일 미사용 비활성화 (매일 오전 1시 10분)

**Job 이름**: `deactivate-inactive-users`
**실행 주기**: `10 1 * * *` (매일 오전 1시 10분)

**수행 작업**: 아파트 등록 회원 중 30일 이상 미사용 시 비활성화 (관리자 제외)

### 3. 기기 상태 체크 (매일 오전 12시)

**Job 이름**: `check-device-status`
**실행 주기**: `0 0 * * *` (매일 오전 12시)

**수행 작업**: 48시간 이상 미사용 기기 점검 상태로 변경

```sql
-- 함수 정의
CREATE OR REPLACE FUNCTION check_device_status()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- 48시간 이상 사용되지 않은 기기를 고장으로 표시
  UPDATE devices
  SET "isWorking" = false
  WHERE "lastOpenedAt" < NOW() - INTERVAL '48 hours'
    AND "isWorking" = true;

  RAISE NOTICE '기기 상태 체크 완료 (48시간 기준)';
END;
$$;

-- Job 생성
SELECT cron.schedule(
  'check-device-status',
  '0 0 * * *',
  $$SELECT check_device_status();$$
);
```

### 4. 자동 승인 (매일 오전 6시)

**Job 이름**: `auto-approve-users`
**실행 주기**: `0 6 * * *` (매일 오전 6시)

**수행 작업**: 승인 대기 회원 자동 승인 (특정 조건 충족 시)

---

## ✓ Cron Job 관리

### Job 조회
```sql
SELECT * FROM cron.job ORDER BY jobid;
```

### Job 삭제
```sql
SELECT cron.unschedule('job-name');
```

### Job 비활성화/활성화
```sql
-- 비활성화
UPDATE cron.job SET active = false WHERE jobname = 'job-name';

-- 활성화
UPDATE cron.job SET active = true WHERE jobname = 'job-name';
```
