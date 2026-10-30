'use client';

import type React from 'react';

import { useState } from 'react';
import { Button, Group, Modal, Select, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
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
    <>
      <Button leftSection={<Plus size={16} />} onClick={() => setOpen(true)}>
        기기 추가
      </Button>
      <Modal opened={open} onClose={() => setOpen(false)} title='새 기기 등록' size={600}>
        <Text size='sm' c='dimmed' mb='md'>
          아파트 기기 정보를 입력해주세요.
        </Text>
        <form onSubmit={handleSubmit}>
          <Stack>
            <TextInput
              id='address'
              label='주소'
              placeholder='서울시 강남구 테헤란로 123'
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              required
            />
            <TextInput
              id='apartmentName'
              label='아파트명'
              placeholder='강남타워'
              value={formData.apartmentName}
              onChange={(e) =>
                setFormData({ ...formData, apartmentName: e.target.value })
              }
              required
            />
            <SimpleGrid cols={2}>
              <TextInput
                id='dong'
                label='동'
                placeholder='101'
                value={formData.dong}
                onChange={(e) =>
                  setFormData({ ...formData, dong: e.target.value })
                }
                required
              />
              <TextInput
                id='households'
                type='number'
                label='세대수'
                placeholder='150'
                value={formData.households}
                onChange={(e) =>
                  setFormData({ ...formData, households: e.target.value })
                }
                required
              />
            </SimpleGrid>
            <TextInput
              id='installLocation'
              label='설치장소'
              placeholder='1층 로비'
              value={formData.installLocation}
              onChange={(e) =>
                setFormData({ ...formData, installLocation: e.target.value })
              }
              required
            />
            <TextInput
              id='entranceDoorNumber'
              label='공동현관문 번호'
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
            <TextInput
              id='doorPassword'
              label='출입문 장치 비밀번호'
              placeholder='1234'
              value={formData.doorPassword}
              onChange={(e) =>
                setFormData({ ...formData, doorPassword: e.target.value })
              }
              required
            />
            <TextInput
              id='macAddress'
              label='MAC 주소'
              placeholder='00:1B:44:11:3A:B7'
              value={formData.macAddress}
              onChange={(e) =>
                setFormData({ ...formData, macAddress: e.target.value })
              }
              required
            />
            <Select
              id='line'
              label='라인'
              placeholder='라인 선택'
              value={formData.line || null}
              onChange={(value) => {
                if (value === null) return;
                setFormData({ ...formData, line: value });
              }}
              allowDeselect={false}
              data={[
                { value: '12', label: '12 라인' },
                { value: '34', label: '34 라인' },
              ]}
            />
          </Stack>
          <Group justify='flex-end' mt='xl'>
            <Button variant='default' onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button type='submit'>등록</Button>
          </Group>
        </form>
      </Modal>
    </>
  );
}
