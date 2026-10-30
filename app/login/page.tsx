import { Center, Stack, Text, Title } from '@mantine/core';
import { LoginForm } from '@/components/login-form';

export default function LoginPage() {
  return (
    <Center mih='100vh' p='md' bg='var(--app-bg-muted)'>
      <Stack w='100%' maw={448} gap='xl'>
        <Stack gap={4} ta='center'>
          <Title order={1}>Wooldanji</Title>
          <Text c='dimmed'>관리자 시스템에 오신 것을 환영합니다</Text>
        </Stack>
        <LoginForm />
      </Stack>
    </Center>
  );
}
