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
| approvalStatus    | text        | `pending` \| `approve` \| `inactive`                                                              |
| registerMethod    | text        |                                                                                                   |
| registrationType  | text        | `GENERAL` \| `APARTMENT` - 일반회원 vs 아파트 등록회원                                            |
| apartmentId       | uuid        | **FK** → `apartments.id` **ON DELETE SET NULL** (APARTMENT 타입인 경우 필수, GENERAL인 경우 NULL) |
| buildingNumber    | int4        | 동 번호 (예: 101, 102)                                                                            |
| unit              | int4        | 호수 (예: 1023, 1034) - `unit % 100`으로 라인 매칭                                                |
| termsAgreed       | bool        |                                                                                                   |
| privacyAgreed     | bool        |                                                                                                   |
| marketingAgreed   | bool        |                                                                                                   |
| phoneNumber       | text        |                                                                                                   |
| lastAccessedAt    | timestamptz | 마지막 출입 시간 (문 열림 성공 시 업데이트)                                                       |
| regionSido        | text        | ✓ 추가: 시/도 (예: 서울, 경기) - 다음 주소 검색 API 결과 저장                                     |
| regionSigungu     | text        | ✓ 추가: 시/군/구 (예: 관악구, 수원시) - 다음 주소 검색 API 결과 저장                              |
| regionDong        | text        | ✓ 추가: 읍/면/동 (예: 신림동, 봉천동) - 다음 주소 검색 API 결과 저장                              |

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
| role      | text        | 예: `APP_USER` / `APT_ADMIN` / `REGION_ADMIN` / `SUPER_ADMIN` |
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

| Column    | Type        | Notes  |
| --------- | ----------- | ------ |
| id        | uuid        | **PK** |
| name      | text        |        |
| address   | text        |        |
| createdAt | timestamptz |        |

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

## ✓ 추가: 홈 화면 콘텐츠 관리 테이블

### Table: `home_headers`

| Column     | Type        | Notes                                                            |
| ---------- | ----------- | ---------------------------------------------------------------- |
| id         | uuid        | **PK**                                                           |
| createdAt  | timestamptz | DEFAULT now()                                                    |
| headerText | text        | 홈 화면 상단 헤더 텍스트 (예: "주민이 추천하는 믿을 수 있는 곳") |
| orderIndex | int4        | 표시 순서 (작을수록 상단)                                        |
| isActive   | bool        | DEFAULT true - 활성화 여부                                       |

> **설명**:
>
> - 홈 화면 상단에 표시되는 동적 헤더 텍스트 관리
> - 관리자가 텍스트를 변경하면 모든 사용자에게 즉시 반영
> - `orderIndex`로 여러 헤더의 표시 순서 제어

---

### Table: `home_notifications`

| Column     | Type        | Notes                                    |
| ---------- | ----------- | ---------------------------------------- |
| id         | uuid        | **PK**                                   |
| createdAt  | timestamptz | DEFAULT now()                            |
| title      | text        | 알림 제목 (NULL 가능)                               |
| content    | text        | 알림 내용                     |
| imageUrl   | text        | 이미지 URL (Supabase Storage, NULL 가능) |
| linkUrl    | text        | 클릭 시 이동할 URL (NULL 가능)           |
| orderIndex | int4        | 표시 순서 (작을수록 상단)                |

> **설명**:
>
> - **전국 공통 알림** - 모든 사용자에게 동일하게 표시
> - 지역 필터링 없음 (아파트 공지, 앱 업데이트 안내 등)
> - 이미지 중심 콘텐츠 (제목/내용은 선택사항)

---

### Table: `home_categories`

| Column       | Type        | Notes                                      |
| ------------ | ----------- | ------------------------------------------ |
| id           | uuid        | **PK**                                     |
| createdAt    | timestamptz | DEFAULT now()                              |
| categoryName | text        | 카테고리 이름 (예: "집", "차", "반려동물") |
| iconUrl      | text        | 카테고리 아이콘 이미지 URL (NULL 가능)     |
| orderIndex   | int4        | 표시 순서 (작을수록 좌측/상단)             |
| isActive     | bool        | DEFAULT true - 활성화 여부                 |

> **설명**:
>
> - 홈 화면 카테고리 정의 (집, 차, 반려동물 등)
> - 관리자가 새로운 카테고리 추가/수정/삭제 가능
> - 각 카테고리는 여러 `home_category_items`를 가짐

---

### Table: `home_category_items`

| Column        | Type        | Notes                                               |
| ------------- | ----------- | --------------------------------------------------- |
| id            | uuid        | **PK**                                              |
| createdAt     | timestamptz | DEFAULT now()                                       |
| categoryId    | uuid        | **FK** → `home_categories.id` **ON DELETE CASCADE** |
| title         | text        | 아이템 제목 (NULL 가능)                             |
| content       | text        | 아이템 내용 (NULL 가능)                             |
| imageUrl      | text        | **이미지 URL** (Supabase Storage) - 주요 콘텐츠     |
| linkUrl       | text        | 클릭 시 이동할 URL (NULL 가능)                      |
| regionSido    | text        | **지역 필터: 시/도** (NULL = 전국)                  |
| regionSigungu | text        | **지역 필터: 시/군/구** (NULL = 상위 지역 전체)     |
| regionDong    | text        | **지역 필터: 읍/면/동** (NULL = 상위 지역 전체)     |
| orderIndex    | int4        | 카테고리 내 표시 순서 (작을수록 좌측/상단)          |
| isActive      | bool        | DEFAULT true - 활성화 여부                          |
| startDate     | timestamptz | 게시 시작 일시 (NULL = 즉시)                        |
| endDate       | timestamptz | 게시 종료 일시 (NULL = 무제한)                      |

> **✓ 추가: 지역별 광고 관리**:
>
> - **이미지 중심 콘텐츠** - 주로 광고 배너/카드 이미지
> - **지역 필터링**:
>   - `regionSido`, `regionSigungu`, `regionDong` 모두 NULL → **전국 공통** 콘텐츠
>   - `regionSido`만 설정 → 해당 시/도 전체 (예: "서울" → 서울 전체)
>   - `regionSido` + `regionSigungu` 설정 → 해당 시/군/구 (예: "서울" + "관악구" → 관악구 전체)
>   - 모두 설정 → 특정 읍/면/동만 (예: "서울" + "관악구" + "신림동" → 신림동만)
>
> **사용 예시**:
>
> ```sql
> -- 관리자가 "집" 카테고리에 신림동 전용 광고 4개 추가
> INSERT INTO home_category_items (categoryId, imageUrl, regionSido, regionSigungu, regionDong, ...)
> VALUES
>   ('집-category-id', 'ad1.jpg', '서울', '관악구', '신림동', ...),
>   ('집-category-id', 'ad2.jpg', '서울', '관악구', '신림동', ...),
>   ('집-category-id', 'ad3.jpg', '서울', '관악구', '신림동', ...),
>   ('집-category-id', 'ad4.jpg', '서울', '관악구', '신림동', ...);
>
> -- 결과: 신림동 거주 사용자만 이 4개 광고 표시
> ```
>
> **제약조건**:
>
> - `CHECK` (지역 필터 논리 일관성): `regionSigungu`가 있으면 `regionSido` 필수, `regionDong`이 있으면 `regionSigungu` 필수
> - **ON DELETE CASCADE**: 카테고리 삭제 시 해당 아이템도 함께 삭제

---

## ✓ 추가: 홈 콘텐츠 조회 로직

### 지역 필터링 쿼리 예시

```dart
// 사용자의 지역 정보로 카테고리 아이템 조회
final user = await supabase.auth.getUser();
final userProfile = await supabase
  .from('user')
  .select('regionSido, regionSigungu, regionDong')
  .eq('id', user.id)
  .single();

// 해당 카테고리의 아이템 조회 (지역 필터 적용)
final items = await supabase
  .from('home_category_items')
  .select('*')
  .eq('categoryId', categoryId)
  .eq('isActive', true)
  .or('startDate.is.null,startDate.lte.${DateTime.now().toIso8601String()}')
  .or('endDate.is.null,endDate.gte.${DateTime.now().toIso8601String()}')
  .or([
    'regionSido.is.null',  // 전국 공통
    'and(regionSido.eq.${userProfile['regionSido']},regionSigungu.is.null)',  // 시/도 매칭
    'and(regionSido.eq.${userProfile['regionSido']},regionSigungu.eq.${userProfile['regionSigungu']},regionDong.is.null)',  // 시/군/구 매칭
    'and(regionSido.eq.${userProfile['regionSido']},regionSigungu.eq.${userProfile['regionSigungu']},regionDong.eq.${userProfile['regionDong']})',  // 완전 매칭
  ].join(','))
  .order('orderIndex');
```

### 알림 조회 예시

```dart
// 전국 공통 알림 (지역 필터 없음)
final notifications = await supabase
  .from('home_notifications')
  .select('*')
  .eq('isActive', true)
  .or('startDate.is.null,startDate.lte.${DateTime.now().toIso8601String()}')
  .or('endDate.is.null,endDate.gte.${DateTime.now().toIso8601String()}')
  .order('orderIndex');
```

---

## ✓ 추가: 관계 다이어그램 업데이트

```
home_categories.id
  └─< home_category_items.categoryId

user.regionSido, regionSigungu, regionDong
  → (지역 필터링) → home_category_items 조회
```

## bukcet 폴더구조

home-content/
├── notifications/ # 알림 이미지
├── categories/ # 광고 이미지
│ ├── home/
│ ├── car/
│ └── pet/
└── icons/ # 카테고리 아이콘 (PNG)
