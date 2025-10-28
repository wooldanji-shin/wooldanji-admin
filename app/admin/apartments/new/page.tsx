'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, MapPin, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert';
import { createClient } from '@/lib/supabase/client';
import { parseMultipleLineRanges } from '@/lib/utils/line';

interface Building {
  id: string;
  number: string;
  householdsCount: number;
  lines: string; // 범위 또는 쉼표로 구분된 라인 번호 (예: "1~3, 4, 5~11")
}

export default function NewApartmentPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: 기본 정보
  const [apartmentName, setApartmentName] = useState('');
  const [address, setAddress] = useState('');

  // Step 2: 동 정보
  const [buildings, setBuildings] = useState<Building[]>([]);

  const handleAddressSearch = () => {
    // TODO: Daum 우편번호 API 연동
    new (window as any).daum.Postcode({
      oncomplete: function(data: any) {
        setAddress(data.roadAddress || data.jibunAddress);
      }
    }).open();
  };

  const addBuilding = () => {
    const newBuilding: Building = {
      id: Date.now().toString(),
      number: '',
      householdsCount: 0,
      lines: '',
    };
    setBuildings([...buildings, newBuilding]);
  };

  const removeBuilding = (id: string) => {
    setBuildings(buildings.filter(b => b.id !== id));
  };

  const updateBuilding = (id: string, field: keyof Building, value: any) => {
    setBuildings(buildings.map(b =>
      b.id === id ? { ...b, [field]: value } : b
    ));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // 1. apartments 테이블에 추가
      const { data: apartment, error: apartmentError } = await supabase
        .from('apartments')
        .insert({
          name: apartmentName,
          address: address,
        } as any)
        .select()
        .single();

      if (apartmentError) throw apartmentError;
      if (!apartment) throw new Error('Failed to create apartment');

      // 2. apartment_buildings 테이블에 동 정보 추가
      for (const building of buildings) {
        const { data: buildingData, error: buildingError } = await supabase
          .from('apartment_buildings')
          .insert({
            buildingNumber: parseInt(building.number),
            apartmentId: (apartment as any).id,
            householdsCount: building.householdsCount,
          } as any)
          .select()
          .single();

        if (buildingError) throw buildingError;
        if (!buildingData) throw new Error('Failed to create building');

        // 3. apartment_lines 테이블에 라인 정보 추가
        const lineRanges = parseMultipleLineRanges(building.lines);
        for (const lineRange of lineRanges) {
          const { error: lineError } = await supabase
            .from('apartment_lines')
            .insert({
              line: lineRange,
              buildingId: (buildingData as any).id,
            } as any);

          if (lineError) throw lineError;
        }
      }

      router.push('/admin/apartments');
    } catch (error) {
      console.error('Failed to create apartment:', error);
      alert('아파트 등록 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const isStep1Valid = apartmentName && address;
  const isStep2Valid = buildings.length > 0 && buildings.every(b =>
    b.number && b.householdsCount > 0 && b.lines.trim().length > 0
  );

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/admin/apartments')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          뒤로
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">새 아파트 등록</h1>
          <p className="text-muted-foreground mt-2">
            아파트 정보를 입력하여 새로운 아파트를 등록합니다
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center mb-8">
        <div className="flex items-center gap-8">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
              step >= 1 ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground'
            }`}>
              1
            </div>
            <span className="font-medium">기본 정보</span>
          </div>
          <div className="w-12 h-0.5 bg-muted" />
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
              step >= 2 ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground'
            }`}>
              2
            </div>
            <span className="font-medium">동/라인 정보</span>
          </div>
        </div>
      </div>

      {/* Step 1: 기본 정보 */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>
              <MapPin className="inline-block mr-2 h-5 w-5" />
              아파트 기본 정보
            </CardTitle>
            <CardDescription>
              아파트의 기본 정보를 입력해주세요
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">아파트명 *</Label>
              <Input
                id="name"
                placeholder="예: 동부아파트"
                value={apartmentName}
                onChange={(e) => setApartmentName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">주소 *</Label>
              <div className="flex gap-2">
                <Input
                  id="address"
                  placeholder="주소를 검색해주세요"
                  value={address}
                  readOnly
                />
                <Button type="button" onClick={handleAddressSearch}>
                  주소 검색
                </Button>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => setStep(2)}
                disabled={!isStep1Valid}
              >
                다음 단계
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: 동/라인 정보 */}
      {step === 2 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                <Building2 className="inline-block mr-2 h-5 w-5" />
                동/라인 정보
              </CardTitle>
              <CardDescription>
                아파트의 동 정보와 각 동의 라인을 설정해주세요
              </CardDescription>
            </CardHeader>
            <CardContent>
              {buildings.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    아직 등록된 동이 없습니다. '동 추가하기' 버튼을 클릭하여 동을 추가해주세요.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  {buildings.map((building, index) => (
                    <Card key={building.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-4">
                          <h3 className="text-lg font-semibold">동 {index + 1}</h3>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeBuilding(building.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="space-y-2">
                            <Label>동 번호 *</Label>
                            <Input
                              placeholder="예: 101"
                              value={building.number}
                              onChange={(e) => updateBuilding(building.id, 'number', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>세대수 *</Label>
                            <Input
                              type="number"
                              placeholder="예: 120"
                              value={building.householdsCount || ''}
                              onChange={(e) => updateBuilding(building.id, 'householdsCount', parseInt(e.target.value) || 0)}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>라인 번호 *</Label>
                          <Input
                            placeholder="예: 1~3, 4, 5~11"
                            value={building.lines}
                            onChange={(e) => {
                              // 숫자, 쉼표, 물결표, 하이픈, 공백만 허용
                              const value = e.target.value.replace(/[^0-9,~\-\s]/g, '');
                              updateBuilding(building.id, 'lines', value);
                            }}
                          />
                          <p className="text-xs text-muted-foreground">
                            범위는 물결표(~)로, 여러 개는 쉼표(,)로 구분하세요 (예: 1~3, 4, 5~11)
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Button onClick={addBuilding} className="w-full" variant="outline" size="lg">
            <Plus className="h-4 w-4 mr-2" />
            동 추가하기
          </Button>

          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setStep(1)}
            >
              이전 단계
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isStep2Valid || loading}
            >
              {loading ? '등록 중...' : '아파트 등록'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}