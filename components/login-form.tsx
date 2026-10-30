'use client';

import type React from 'react';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Paper, Stack, Text, TextInput, Title } from '@mantine/core';
import { login } from '@/lib/auth';
import { Lock, Mail } from 'lucide-react';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login(email, password);

      if (user) {
        router.push('/admin/apartments');
        router.refresh();
      } else {
        setError('이메일 또는 비밀번호가 올바르지 않습니다.');
      }
    } catch (err) {
      setError('로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper withBorder shadow="sm" radius="md" p="xl" w="100%" maw={448}>
      <Stack gap={4} mb="lg">
        <Title order={2}>관리자 로그인</Title>
        <Text c="dimmed">관리자 계정으로 로그인하세요</Text>
      </Stack>
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput
            id='email'
            type='email'
            label='이메일'
            placeholder='admin@example.com'
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            withAsterisk={false}
            leftSection={<Mail size={16} />}
          />

          <TextInput
            id='password'
            type='password'
            label='비밀번호'
            placeholder='••••••••'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            withAsterisk={false}
            leftSection={<Lock size={16} />}
          />

          {error && (
            <Alert color='red' variant='light'>
              {error}
            </Alert>
          )}

          <Button type='submit' fullWidth disabled={loading}>
            {loading ? '로그인 중...' : '로그인'}
          </Button>
        </Stack>
      </form>
    </Paper>
  );
}
