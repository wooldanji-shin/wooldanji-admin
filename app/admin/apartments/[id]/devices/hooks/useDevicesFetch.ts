import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import type {
  SupabaseClient,
  Device,
  ApartmentDetails,
  AdminScope,
  UseDevicesFetchReturn,
} from '../types';

function formatApartmentData(raw: any): ApartmentDetails {
  return {
    id: raw.id,
    name: raw.name,
    buildings: (raw.apartment_buildings || []).map((b: any) => ({
      id: b.id,
      buildingNumber: b.buildingNumber,
      lines: (b.apartment_lines || []).map((l: any) => ({
        id: l.id,
        line: l.line,
        places: l.apartment_line_places || [],
      })),
    })),
  };
}

function collectLinePlaceIds(apartment: ApartmentDetails): string[] {
  const ids: string[] = [];
  apartment.buildings?.forEach((b) =>
    b.lines?.forEach((l) =>
      l.places?.forEach((p) => ids.push(p.id)),
    ),
  );
  return ids;
}

const DEVICE_SELECT_QUERY = `
  *,
  apartment_line_places (
    id,
    placeName,
    apartment_lines (
      id,
      line,
      apartment_buildings (
        id,
        buildingNumber
      )
    )
  )
`;

export function useDevicesFetch(
  supabase: SupabaseClient,
  params: Promise<{ id: string }>,
): UseDevicesFetchReturn {
  const [apartmentId, setApartmentId] = useState<string>('');
  const [devices, setDevices] = useState<Device[]>([]);
  const [apartment, setApartment] = useState<ApartmentDetails | null>(null);
  const [adminScopes, setAdminScopes] = useState<AdminScope[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    params.then((p) => setApartmentId(p.id));
  }, [params]);

  const fetchData = useCallback(async (): Promise<void> => {
    if (!apartmentId) return;
    setLoading(true);

    try {
      // Auth & permission check
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요합니다.');

      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('userId', user.id);

      const userRoles = roles?.map((r) => r.role) || [];
      const isSuperAdmin = userRoles.includes('SUPER_ADMIN');
      const isManager = userRoles.includes('MANAGER');

      if (isManager && !isSuperAdmin) {
        const { data: managerApartments } = await supabase
          .from('manager_apartments')
          .select('apartmentId')
          .eq('managerId', user.id)
          .eq('apartmentId', apartmentId);

        if (!managerApartments || managerApartments.length === 0) {
          throw new Error('이 아파트에 대한 접근 권한이 없습니다.');
        }
      }

      // Fetch apartment structure
      const { data: apartmentData, error: apartmentError } = await supabase
        .from('apartments')
        .select(`
          id, name,
          apartment_buildings (
            id, buildingNumber,
            apartment_lines (
              id, line,
              apartment_line_places ( id, placeName )
            )
          )
        `)
        .eq('id', apartmentId)
        .single();

      if (apartmentError) throw apartmentError;
      if (!apartmentData) throw new Error('Apartment not found');

      const formatted = formatApartmentData(apartmentData);
      setApartment(formatted);

      // Fetch devices
      const linePlaceIds = collectLinePlaceIds(formatted);

      if (linePlaceIds.length === 0) {
        setDevices([]);
      } else {
        const { data, error } = await supabase
          .from('devices')
          .select(DEVICE_SELECT_QUERY)
          .in('linePlaceId', linePlaceIds)
          .order('createdAt', { ascending: false });

        if (error) throw error;
        setDevices((data as Device[]) || []);
      }

      // Fetch admin scopes
      const { data: scopesData, error: scopesError } = await supabase
        .from('admin_scopes')
        .select(`
          id, scopeLevel, apartmentId, buildingId, lineId,
          user:userId ( id, name, email, phoneNumber )
        `)
        .eq('apartmentId', apartmentId);

      if (scopesError) throw scopesError;
      setAdminScopes(scopesData || []);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      toast.error('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [apartmentId, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { apartmentId, apartment, devices, setDevices, adminScopes, loading, fetchData };
}

export { DEVICE_SELECT_QUERY };
