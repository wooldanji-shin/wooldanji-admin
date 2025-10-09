
# Database Schema (ERD → Markdown)

> 본 문서는 제공된 ERD 스크린샷을 기반으로 작성한 **컬럼 요약 + 관계(외래키) 개요**입니다.  
> 실제 제약(UNIQUE/CHECK/RLS 등)은 운영 시점에 맞춰 추가하세요.

---

## Table: `user`
| Column            | Type        | Notes |
|-------------------|-------------|-------|
| id                | uuid        | **PK**, = `auth.users.id` |
| createdAt         | timestamptz |       |
| email             | text        |       |
| name              | text        |       |
| address           | text        |       |
| detailAddress     | text        |       |
| hasAccessControl  | bool        |       |
| premium           | bool        |       |
| birthDay          | text        | (날짜 타입으로 변경 고려) |
| premiumExpiryDate | timestamptz |       |
| confirmImageUrl   | text        |       |
| shareUserCount    | int4        |       |
| recommendCode     | text        |       |
| openDoorCount     | int4        |       |
| rssLevel          | int4        |       |
| approvalStatus    | text        |       |
| registerMethod    | text        |       |
| registrationType  | text        | `GENERAL` \| `APARTMENT` - 일반회원 vs 아파트 등록회원 |
| apartmentId       | uuid        | **FK** → `apartments.id` **ON DELETE SET NULL** (APARTMENT 타입인 경우 필수, GENERAL인 경우 NULL) |
| buildingNumber    | int4        | 동 번호 (예: 101, 102) |
| unit              | int4        | 호수 (예: 1023, 1034) - 끝 한자리로 라인 매칭 |
| termsAgreed       | bool        |       |
| privacyAgreed     | bool        |       |
| marketingAgreed   | bool        |       |
| phoneNumber       | text        |       |

> **호수-라인 매칭 규칙**: `unit % 10`으로 끝 한자리 추출
> - 끝자리 1 또는 2 → 12라인 (예: 1001, 1002, 1011, 1012, 1021, 1022)
> - 끝자리 3 또는 4 → 34라인 (예: 1003, 1004, 1013, 1014, 1023, 1024)
> - 끝자리 5 또는 6 → 56라인 (예: 1005, 1006, 1015, 1016, 1025, 1026)
> - 끝자리 7 또는 8 → 78라인 (예: 1007, 1008, 1017, 1018, 1027, 1028)
> - 끝자리 9 또는 0 → 90라인 (예: 1009, 1010, 1019, 1020, 1029, 1030)
>
> **제약조건**:
> - `CHECK (registrationType IN ('GENERAL', 'APARTMENT'))`
> - `CHECK (registrationType = 'APARTMENT' AND apartmentId IS NOT NULL AND buildingNumber IS NOT NULL AND unit IS NOT NULL)` 또는 `registrationType = 'GENERAL'`

---

## Table: `user_roles`
| Column    | Type        | Notes |
|-----------|-------------|-------|
| id        | uuid        | **PK** |
| userId    | uuid        | **FK** → `user.id` **ON DELETE CASCADE** |
| role      | text        | 예: `APP_USER` / `APT_ADMIN` / `REGION_ADMIN` / `SUPER_ADMIN` |
| createdAt | timestamptz |       |

> **제약조건**:
> - `UNIQUE (userId, role)`
> - **ON DELETE CASCADE**: 사용자 삭제 시 역할도 함께 삭제

---

## Table: `admin_scopes`
| Column      | Type        | Notes |
|-------------|-------------|-------|
| id          | uuid        | **PK** |
| createdAt   | timestamptz |       |
| userId      | uuid        | **FK** → `user.id` **ON DELETE CASCADE** |
| apartmentId | uuid        | **FK** → `apartments.id` **ON DELETE CASCADE** (NULL 가능) |
| buildingId  | uuid        | **FK** → `apartment_buildings.id` **ON DELETE CASCADE** (NULL 가능) |
| lineId      | uuid        | **FK** → `apartment_lines.id` **ON DELETE CASCADE** (NULL 가능) |
| scopeLevel | text        | `APARTMENT` \| `BUILDING` \| `LINE` *(필요 시 `REGION`/`LINE_PLACE` 등 확장)* |

> **제약조건**:
> - `CHECK (scopeLevel IN ('APARTMENT', 'BUILDING', 'LINE'))`
> - `CHECK` (scopeLevel에 따라 필수 FK NOT NULL)
> - `UNIQUE (userId, scopeLevel, apartmentId, buildingId, lineId)`
> - **ON DELETE CASCADE**: 사용자나 관리 대상(아파트/동/라인) 삭제 시 관리 권한도 함께 삭제

---

## Table: `apartments`
| Column    | Type        | Notes |
|-----------|-------------|-------|
| id        | uuid        | **PK** |
| name      | text        |       |
| address   | text        |       |
| createdAt | timestamptz |       |

---

## Table: `apartment_buildings`
| Column        | Type        | Notes |
|---------------|-------------|-------|
| id            | uuid        | **PK** |
| createdAt     | timestamptz |       |
| buildingNumber| int4        | 예: 101, 102 |
| apartmentId   | uuid        | **FK** → `apartments.id` **ON DELETE CASCADE** |
| householdsCount | int4      | 동의 총 세대수 |

> **제약조건**:
> - `UNIQUE (apartmentId, buildingNumber)`
> - **ON DELETE CASCADE**: 아파트 삭제 시 해당 동들도 함께 삭제

---

## Table: `apartment_lines`
| Column    | Type        | Notes |
|-----------|-------------|-------|
| id        | uuid        | **PK** |
| createdAt | timestamptz |       |
| line      | int4        | 예: 12, 34, 56, 78, 90 |
| buildingId| uuid        | **FK** → `apartment_buildings.id` **ON DELETE CASCADE** |

> **제약조건**:
> - `UNIQUE (buildingId, line)`
> - **ON DELETE CASCADE**: 동 삭제 시 해당 라인들도 함께 삭제

---

## Table: `apartment_line_places`
| Column    | Type        | Notes |
|-----------|-------------|-------|
| id        | uuid        | **PK** |
| lineId    | uuid        | **FK** → `apartment_lines.id` **ON DELETE CASCADE** |
| createdAt | timestamptz |       |
| placeName | text        | 예: 'B1 전기실', '1F 엘리베이터홀', '각 층 현관문' |

> **제약조건**:
> - `UNIQUE (lineId, placeName)` 또는 층 기준 유니크
> - **ON DELETE CASCADE**: 라인 삭제 시 해당 장소들도 함께 삭제
> - 권장: `floor_label`, `place_type` 추가 고려

---

## Table: `devices`
| Column      | Type        | Notes |
|-------------|-------------|-------|
| id          | uuid        | **PK** |
| created_at  | timestamptz |       |
| linePlaceId | uuid        | **FK** → `apartment_line_places.id` **ON DELETE CASCADE** |
| macAddress  | text        | **UNIQUE** 권장 |
| devicePassword | text     | **권장:** 해시 저장(`password_hash`) |

> **제약조건**:
> - `UNIQUE (macAddress)`
> - **ON DELETE CASCADE**: 장소 삭제 시 해당 기기들도 함께 삭제

---

## Table: `user_line_access`
| Column      | Type        | Notes |
|-------------|-------------|-------|
| id          | uuid        | **PK** |
| userId      | uuid        | **FK** → `user.id` **ON DELETE CASCADE** (제약명: `fk_user_line_access_user`) |
| lineId      | uuid        | **FK** → `apartment_lines.id` **ON DELETE CASCADE** |
| accessType  | text        | `OWNER` \| `SHARED` \| `TEMPORARY` |
| grantedBy   | uuid        | **FK** → `user.id` **ON DELETE SET NULL** (제약명: `fk_user_line_access_granted_by`) |
| expiresAt   | timestamptz | 만료 시간 (OWNER/SHARED는 NULL, TEMPORARY는 특정 시간) |
| createdAt   | timestamptz | DEFAULT now() |
| isActive    | bool        | DEFAULT true - 수동 비활성화 가능 |
 
> **접근 유형**:
> - `OWNER`: 실제 거주자 (영구 접근)
> - `SHARED`: 공유 사용자 - 같은 호수의 가족/동거인 (최대 5명)
> - `TEMPORARY`: 일회성 초대 (택배, 방문객 등)
>
> **제약조건**:
> - `UNIQUE (userId, lineId)`
> - `CHECK (accessType IN ('OWNER', 'SHARED', 'TEMPORARY'))`
> - 애플리케이션 레벨에서 같은 호수(apartmentId + buildingNumber + unit 조합) 최대 5명 제한
>
> **외래키 삭제 규칙**:
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
-- 1023호 → unit % 10 = 3 → 끝자리 3이므로 34라인
INSERT INTO user_line_access (userId, lineId, accessType, grantedBy)
SELECT
  '신규유저UUID',
  (SELECT id FROM apartment_lines WHERE buildingId = '101동UUID' AND line = 34),
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
    apartment_line_places!inner(
      lineId,
      placeName
    )
  ''')
  .eq('apartment_line_places.lineId', access['lineId']);

// 3. macAddress와 devicePassword로 실제 하드웨어 통신
for (final device in devices) {
  await connectToDevice(
    macAddress: device['macAddress'],
    password: device['devicePassword'],
  );
}
```

---


