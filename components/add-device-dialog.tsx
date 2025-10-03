'use client';

import type React from 'react';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus } from 'lucide-react';

export function AddDeviceDialog() {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    address: '',
    apartmentName: '',
    dong: '',
    households: '',
    installLocation: '',
    entranceDoorNumber: '',
    doorPassword: '',
    macAddress: '',
    line: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[v0] Form submitted:', formData);
    // Here you would handle the actual submission
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      <DialogTrigger asChild>
        <Button className='bg-primary text-primary-foreground hover:bg-primary/90 gap-2'>
          <Plus className='h-4 w-4' />
          기기 추가
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-[600px] max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>새 기기 등록</DialogTitle>
          <DialogDescription>
            아파트 기기 정보를 입력해주세요.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className='grid gap-4 py-4'>
            <div className='grid gap-2'>
              <Label htmlFor='address'>주소</Label>
              <Input
                id='address'
                placeholder='서울시 강남구 테헤란로 123'
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                required
              />
            </div>
            <div className='grid gap-2'>
              <Label htmlFor='apartmentName'>아파트명</Label>
              <Input
                id='apartmentName'
                placeholder='강남타워'
                value={formData.apartmentName}
                onChange={(e) =>
                  setFormData({ ...formData, apartmentName: e.target.value })
                }
                required
              />
            </div>
            <div className='grid grid-cols-2 gap-4'>
              <div className='grid gap-2'>
                <Label htmlFor='dong'>동</Label>
                <Input
                  id='dong'
                  placeholder='101'
                  value={formData.dong}
                  onChange={(e) =>
                    setFormData({ ...formData, dong: e.target.value })
                  }
                  required
                />
              </div>
              <div className='grid gap-2'>
                <Label htmlFor='households'>세대수</Label>
                <Input
                  id='households'
                  type='number'
                  placeholder='150'
                  value={formData.households}
                  onChange={(e) =>
                    setFormData({ ...formData, households: e.target.value })
                  }
                  required
                />
              </div>
            </div>
            <div className='grid gap-2'>
              <Label htmlFor='installLocation'>설치장소</Label>
              <Input
                id='installLocation'
                placeholder='1층 로비'
                value={formData.installLocation}
                onChange={(e) =>
                  setFormData({ ...formData, installLocation: e.target.value })
                }
                required
              />
            </div>
            <div className='grid gap-2'>
              <Label htmlFor='entranceDoorNumber'>공동현관문 번호</Label>
              <Input
                id='entranceDoorNumber'
                placeholder='A-001'
                value={formData.entranceDoorNumber}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    entranceDoorNumber: e.target.value,
                  })
                }
                required
              />
            </div>
            <div className='grid gap-2'>
              <Label htmlFor='doorPassword'>출입문 장치 비밀번호</Label>
              <Input
                id='doorPassword'
                placeholder='1234'
                value={formData.doorPassword}
                onChange={(e) =>
                  setFormData({ ...formData, doorPassword: e.target.value })
                }
                required
              />
            </div>
            <div className='grid gap-2'>
              <Label htmlFor='macAddress'>MAC 주소</Label>
              <Input
                id='macAddress'
                placeholder='00:1B:44:11:3A:B7'
                value={formData.macAddress}
                onChange={(e) =>
                  setFormData({ ...formData, macAddress: e.target.value })
                }
                required
              />
            </div>
            <div className='grid gap-2'>
              <Label htmlFor='line'>라인</Label>
              <Select
                value={formData.line}
                onValueChange={(value:any) =>
                  setFormData({ ...formData, line: value })
                }
              >
                <SelectTrigger id='line'>
                  <SelectValue placeholder='라인 선택' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='12'>12 라인</SelectItem>
                  <SelectItem value='34'>34 라인</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => setOpen(false)}
            >
              취소
            </Button>
            <Button type='submit'>등록</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
