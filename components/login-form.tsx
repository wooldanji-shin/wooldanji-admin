'use client';

import type React from 'react';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { login, storeUser } from '@/lib/auth';
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
        storeUser(user);
        router.push('/admin/dashboard');
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
    <Card className='w-full max-w-md border-border/50'>
      <CardHeader className='space-y-1'>
        <CardTitle className='text-2xl font-bold text-foreground'>
          관리자 로그인
        </CardTitle>
        <CardDescription className='text-muted-foreground'>
          관리자 계정으로 로그인하세요
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit}
          className='space-y-4'
        >
          <div className='space-y-2'>
            <Label
              htmlFor='email'
              className='text-foreground'
            >
              이메일
            </Label>
            <div className='relative'>
              <Mail className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
              <Input
                id='email'
                type='email'
                placeholder='admin@example.com'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className='pl-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground'
              />
            </div>
          </div>

          <div className='space-y-2'>
            <Label
              htmlFor='password'
              className='text-foreground'
            >
              비밀번호
            </Label>
            <div className='relative'>
              <Lock className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
              <Input
                id='password'
                type='password'
                placeholder='••••••••'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className='pl-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground'
              />
            </div>
          </div>

          {error && (
            <div className='text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3'>
              {error}
            </div>
          )}

          <Button
            type='submit'
            className='w-full bg-primary text-primary-foreground hover:bg-primary/90'
            disabled={loading}
          >
            {loading ? '로그인 중...' : '로그인'}
          </Button>

          <div className='text-xs text-muted-foreground text-center mt-4'>
            데모: admin@example.com / admin123
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
