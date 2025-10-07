// Database 타입 정의
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
          hasAccessControl: boolean | null;
          premium: boolean | null;
          birthDay: string | null;
          premiumExpiryDate: string | null;
          confirmImageUrl: string | null;
          shareUserCount: number | null;
          recommendCode: string | null;
          openDoorCount: number | null;
          rssLevel: number | null;
          approvalStatus: 'pending' | 'approve' | null;
          registerMethod: string | null;
          registrationType: 'GENERAL' | 'APARTMENT' | null;
          apartmentId: string | null;
          buildingNumber: number | null;
          unit: number | null;
          termsAgreed: boolean | null;
          privacyAgreed: boolean | null;
          marketingAgreed: boolean | null;
          phoneNumber: string | null;
        };
        Insert: {
          id: string;
          createdAt?: string;
          email: string;
          name?: string | null;
          address?: string | null;
          detailAddress?: string | null;
          hasAccessControl?: boolean | null;
          premium?: boolean | null;
          birthDay?: string | null;
          premiumExpiryDate?: string | null;
          confirmImageUrl?: string | null;
          shareUserCount?: number | null;
          recommendCode?: string | null;
          openDoorCount?: number | null;
          rssLevel?: number | null;
          approvalStatus?: 'pending' | 'approved' | 'rejected' | null;
          registerMethod?: string | null;
          registrationType?: 'GENERAL' | 'APARTMENT' | null;
          apartmentId?: string | null;
          buildingNumber?: number | null;
          unit?: number | null;
          termsAgreed?: boolean | null;
          privacyAgreed?: boolean | null;
          marketingAgreed?: boolean | null;
          phoneNumber?: string | null;
        };
        Update: {
          id?: string;
          createdAt?: string;
          email?: string;
          name?: string | null;
          address?: string | null;
          detailAddress?: string | null;
          hasAccessControl?: boolean | null;
          premium?: boolean | null;
          birthDay?: string | null;
          premiumExpiryDate?: string | null;
          confirmImageUrl?: string | null;
          shareUserCount?: number | null;
          recommendCode?: string | null;
          openDoorCount?: number | null;
          rssLevel?: number | null;
          approvalStatus?: 'pending' | 'approved' | 'rejected' | null;
          registerMethod?: string | null;
          registrationType?: 'GENERAL' | 'APARTMENT' | null;
          apartmentId?: string | null;
          buildingNumber?: number | null;
          unit?: number | null;
          termsAgreed?: boolean | null;
          privacyAgreed?: boolean | null;
          marketingAgreed?: boolean | null;
          phoneNumber?: string | null;
        };
      };
      user_roles: {
        Row: {
          id: string;
          userId: string;
          role: 'APP_USER' | 'APT_ADMIN' | 'REGION_ADMIN' | 'SUPER_ADMIN';
          createdAt: string;
        };
        Insert: {
          id?: string;
          userId: string;
          role: 'APP_USER' | 'APT_ADMIN' | 'REGION_ADMIN' | 'SUPER_ADMIN';
          createdAt?: string;
        };
        Update: {
          id?: string;
          userId?: string;
          role?: 'APP_USER' | 'APT_ADMIN' | 'REGION_ADMIN' | 'SUPER_ADMIN';
          createdAt?: string;
        };
      };
      apartments: {
        Row: {
          id: string;
          name: string;
          address: string;
          createdAt: string;
        };
        Insert: {
          id?: string;
          name: string;
          address: string;
          createdAt?: string;
        };
        Update: {
          id?: string;
          name?: string;
          address?: string;
          createdAt?: string;
        };
      };
      apartment_buildings: {
        Row: {
          id: string;
          createdAt: string;
          buildingNumber: number;
          apartmentId: string;
          householdsCount: number;
        };
        Insert: {
          id?: string;
          createdAt?: string;
          buildingNumber: number;
          apartmentId: string;
          householdsCount: number;
        };
        Update: {
          id?: string;
          createdAt?: string;
          buildingNumber?: number;
          apartmentId?: string;
          householdsCount?: number;
        };
      };
      apartment_lines: {
        Row: {
          id: string;
          createdAt: string;
          line: number;
          buildingId: string;
        };
        Insert: {
          id?: string;
          createdAt?: string;
          line: number;
          buildingId: string;
        };
        Update: {
          id?: string;
          createdAt?: string;
          line?: number;
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
  apartments?: Database['public']['Tables']['apartments']['Row'];
  apartment_buildings?: Database['public']['Tables']['apartment_buildings']['Row'];
};

export type UserFullDetails = Database['public']['Tables']['user']['Row'] & {
  user_roles?: Database['public']['Tables']['user_roles']['Row'][];
  apartments?: Database['public']['Tables']['apartments']['Row'];
  apartment_buildings?: Database['public']['Tables']['apartment_buildings']['Row'];
};