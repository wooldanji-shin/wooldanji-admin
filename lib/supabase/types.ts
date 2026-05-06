// Database 타입 정의 — DB 스키마 기반 수동 유지
export interface Database {
  public: {
    Tables: {
      user: {
        Row: {
          id: string;
          createdAt: string;
          email: string;
          name: string | null;
          address: string | null;
          detailAddress: string | null;
          premium: boolean;
          birthDay: string | null;
          premiumExpiryDate: string | null;
          confirmImageUrl: string | null;
          shareUserCount: number;
          recommendCode: string | null;
          openDoorCount: number | null;
          rssLevel: number;
          approvalStatus: string;
          registerMethod: string | null;
          registerMethods: string[];
          registrationType: string;
          apartmentId: string | null;
          buildingNumber: number | null;
          unit: number | null;
          termsAgreed: boolean;
          privacyAgreed: boolean;
          marketingAgreed: boolean;
          phoneNumber: string;
          lastAccessedAt: string | null;
          regionSido: string | null;
          regionSigungu: string | null;
          regionDong: string | null;
          overlayPermissionGranted: boolean | null;
          platform: string | null;
          fcmToken: string[] | null;
          suspensionReason: string | null;
        };
        Insert: {
          id: string;
          createdAt?: string;
          email: string;
          name?: string | null;
          address?: string | null;
          detailAddress?: string | null;
          premium?: boolean;
          birthDay?: string | null;
          premiumExpiryDate?: string | null;
          confirmImageUrl?: string | null;
          shareUserCount?: number;
          recommendCode?: string | null;
          openDoorCount?: number | null;
          rssLevel?: number;
          approvalStatus?: string;
          registerMethod?: string | null;
          registerMethods?: string[];
          registrationType: string;
          apartmentId?: string | null;
          buildingNumber?: number | null;
          unit?: number | null;
          termsAgreed?: boolean;
          privacyAgreed?: boolean;
          marketingAgreed?: boolean;
          phoneNumber: string;
          regionSido?: string | null;
          regionSigungu?: string | null;
          regionDong?: string | null;
          suspensionReason?: string | null;
        };
        Update: {
          id?: string;
          createdAt?: string;
          email?: string;
          name?: string | null;
          address?: string | null;
          detailAddress?: string | null;
          premium?: boolean;
          birthDay?: string | null;
          premiumExpiryDate?: string | null;
          confirmImageUrl?: string | null;
          shareUserCount?: number;
          recommendCode?: string | null;
          openDoorCount?: number | null;
          rssLevel?: number;
          approvalStatus?: string;
          registerMethod?: string | null;
          registerMethods?: string[];
          registrationType?: string;
          apartmentId?: string | null;
          buildingNumber?: number | null;
          unit?: number | null;
          termsAgreed?: boolean;
          privacyAgreed?: boolean;
          marketingAgreed?: boolean;
          phoneNumber?: string;
          regionSido?: string | null;
          regionSigungu?: string | null;
          regionDong?: string | null;
          suspensionReason?: string | null;
        };
      };
      user_roles: {
        Row: {
          id: string;
          userId: string;
          role: string;
          createdAt: string;
        };
        Insert: {
          id?: string;
          userId: string;
          role: string;
          createdAt?: string;
        };
        Update: {
          id?: string;
          userId?: string;
          role?: string;
          createdAt?: string;
        };
      };
      apartments: {
        Row: {
          id: string;
          name: string;
          address: string | null;
          createdAt: string;
        };
        Insert: {
          id?: string;
          name: string;
          address?: string | null;
          createdAt?: string;
        };
        Update: {
          id?: string;
          name?: string;
          address?: string | null;
          createdAt?: string;
        };
      };
      apartment_buildings: {
        Row: {
          id: string;
          createdAt: string;
          buildingNumber: number;
          apartmentId: string;
        };
        Insert: {
          id?: string;
          createdAt?: string;
          buildingNumber: number;
          apartmentId: string;
        };
        Update: {
          id?: string;
          createdAt?: string;
          buildingNumber?: number;
          apartmentId?: string;
        };
      };
      apartment_lines: {
        Row: {
          id: string;
          createdAt: string;
          line: number[];
          buildingId: string;
        };
        Insert: {
          id?: string;
          createdAt?: string;
          line: number[];
          buildingId: string;
        };
        Update: {
          id?: string;
          createdAt?: string;
          line?: number[];
          buildingId?: string;
        };
      };
      apartment_line_places: {
        Row: {
          id: string;
          lineId: string;
          createdAt: string;
          placeName: string;
        };
        Insert: {
          id?: string;
          lineId: string;
          createdAt?: string;
          placeName: string;
        };
        Update: {
          id?: string;
          lineId?: string;
          createdAt?: string;
          placeName?: string;
        };
      };
      devices: {
        Row: {
          id: string;
          createdAt: string;
          linePlaceId: string;
          macAddress: string;
          iosMacAddress: string | null;
          devicePassword: string;
        };
        Insert: {
          id?: string;
          createdAt?: string;
          linePlaceId: string;
          macAddress: string;
          iosMacAddress?: string | null;
          devicePassword: string;
        };
        Update: {
          id?: string;
          createdAt?: string;
          linePlaceId?: string;
          macAddress?: string;
          iosMacAddress?: string | null;
          devicePassword?: string;
        };
      };
    };
  };
}

// 조인된 데이터 타입
export type UserWithRole = Database['public']['Tables']['user']['Row'] & {
  user_roles?: Database['public']['Tables']['user_roles']['Row'][];
};

export type UserWithApartment = Database['public']['Tables']['user']['Row'] & {
  apartments?: Database['public']['Tables']['apartments']['Row'] | null;
  apartment_buildings?: Database['public']['Tables']['apartment_buildings']['Row'] | null;
};

// partner_users 조인 포함
export type UserFullDetails = Database['public']['Tables']['user']['Row'] & {
  user_roles?: Database['public']['Tables']['user_roles']['Row'][];
  apartments?: (Database['public']['Tables']['apartments']['Row'] & { address: string | null }) | null;
  apartment_buildings?: Database['public']['Tables']['apartment_buildings']['Row'] | null;
  // partner_users 조인 — Supabase 1:N 조인은 배열로 반환. 파트너 여부 표시에 사용
  partner_users?: { id: string }[];
};
