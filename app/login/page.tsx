import { LoginForm } from '@/components/login-form';

export default function LoginPage() {
  return (
    <div className='min-h-screen flex items-center justify-center bg-background p-4'>
      <div className='w-full max-w-md'>
        <div className='text-center mb-8'>
          <h1 className='text-3xl font-bold text-foreground mb-2'>
            Wooldanji
          </h1>
          <p className='text-muted-foreground'>
            관리자 시스템에 오신 것을 환영합니다
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
