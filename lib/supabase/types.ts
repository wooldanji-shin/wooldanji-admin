export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      user: {
        Row: {
          address: string | null
          apartmentId: string | null
          approvalStatus: string
          birthDay: string | null
          buildingNumber: number | null
          confirmImageUrl: string | null
          createdAt: string
          detailAddress: string | null
          email: string
          fcmToken: string[] | null
          id: string
          lastAccessedAt: string | null
          marketingAgreed: boolean
          name: string
          openDoorCount: number
          overlayPermissionGranted: boolean | null
          phoneNumber: string
          platform: string | null
          premium: boolean | null
          premiumExpiryDate: string | null
          privacyAgreed: boolean
          recommendCode: string | null
          regionDong: string | null
          regionSido: string | null
          regionSigungu: string | null
          registerMethods: string[]
          registrationType: string
          rssLevel: number | null
          shareUserCount: number
          termsAgreed: boolean
          unit: number | null
        }
        Insert: {
          address?: string | null
          apartmentId?: string | null
          approvalStatus: string
          birthDay?: string | null
          buildingNumber?: number | null
          confirmImageUrl?: string | null
          createdAt?: string
          detailAddress?: string | null
          email: string
          fcmToken?: string[] | null
          id?: string
          lastAccessedAt?: string | null
          marketingAgreed: boolean
          name: string
          openDoorCount: number
          overlayPermissionGranted?: boolean | null
          phoneNumber: string
          platform?: string | null
          premium?: boolean | null
          premiumExpiryDate?: string | null
          privacyAgreed: boolean
          recommendCode?: string | null
          regionDong?: string | null
          regionSido?: string | null
          regionSigungu?: string | null
          registerMethods?: string[]
          registrationType: string
          rssLevel?: number | null
          shareUserCount: number
          termsAgreed: boolean
          unit?: number | null
        }
        Update: {
          address?: string | null
          apartmentId?: string | null
          approvalStatus?: string
          birthDay?: string | null
          buildingNumber?: number | null
          confirmImageUrl?: string | null
          createdAt?: string
          detailAddress?: string | null
          email?: string
          fcmToken?: string[] | null
          id?: string
          lastAccessedAt?: string | null
          marketingAgreed?: boolean
          name?: string
          openDoorCount?: number
          overlayPermissionGranted?: boolean | null
          phoneNumber?: string
          platform?: string | null
          premium?: boolean | null
          premiumExpiryDate?: string | null
          privacyAgreed?: boolean
          recommendCode?: string | null
          regionDong?: string | null
          regionSido?: string | null
          regionSigungu?: string | null
          registerMethods?: string[]
          registrationType?: string
          rssLevel?: number | null
          shareUserCount?: number
          termsAgreed?: boolean
          unit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_apartmentId_fkey"
            columns: ["apartmentId"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          createdAt: string
          id: string
          role: string
          userId: string | null
        }
        Insert: {
          createdAt?: string
          id?: string
          role: string
          userId?: string | null
        }
        Update: {
          createdAt?: string
          id?: string
          role?: string
          userId?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
      apartments: {
        Row: {
          address: string
          createdAt: string
          id: string
          name: string
        }
        Insert: {
          address: string
          createdAt?: string
          id?: string
          name: string
        }
        Update: {
          address?: string
          createdAt?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      apartment_buildings: {
        Row: {
          apartmentId: string
          buildingNumber: number
          createdAt: string
          householdsCount: number | null
          id: string
        }
        Insert: {
          apartmentId: string
          buildingNumber: number
          createdAt?: string
          householdsCount?: number | null
          id?: string
        }
        Update: {
          apartmentId?: string
          buildingNumber?: number
          createdAt?: string
          householdsCount?: number | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "apartment_buildings_apartmentId_fkey"
            columns: ["apartmentId"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
        ]
      }
      apartment_lines: {
        Row: {
          buildingId: string
          createdAt: string
          id: string
          line: number[]
        }
        Insert: {
          buildingId: string
          createdAt?: string
          id?: string
          line: number[]
        }
        Update: {
          buildingId?: string
          createdAt?: string
          id?: string
          line?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "apartment_lines_buildingId_fkey"
            columns: ["buildingId"]
            isOneToOne: false
            referencedRelation: "apartment_buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      apartment_line_places: {
        Row: {
          createdAt: string
          id: string
          lineId: string
          placeName: string | null
        }
        Insert: {
          createdAt?: string
          id?: string
          lineId: string
          placeName?: string | null
        }
        Update: {
          createdAt?: string
          id?: string
          lineId?: string
          placeName?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apartment_line_places_lineId_fkey"
            columns: ["lineId"]
            isOneToOne: false
            referencedRelation: "apartment_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          createdAt: string
          devicePassword: string
          id: string
          isWorking: boolean
          lastOpenedAt: string | null
          linePlaceId: string
          macAddress: string
        }
        Insert: {
          createdAt?: string
          devicePassword: string
          id?: string
          isWorking?: boolean
          lastOpenedAt?: string | null
          linePlaceId: string
          macAddress: string
        }
        Update: {
          createdAt?: string
          devicePassword?: string
          id?: string
          isWorking?: boolean
          lastOpenedAt?: string | null
          linePlaceId?: string
          macAddress?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_linePlaceId_fkey"
            columns: ["linePlaceId"]
            isOneToOne: false
            referencedRelation: "apartment_line_places"
            referencedColumns: ["id"]
          },
        ]
      }
    }
  }
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
