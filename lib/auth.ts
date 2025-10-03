
export interface User {
  id: string;
  email: string;
  name: string;
}

// Simple in-memory auth for demo (replace with real auth later)
const DEMO_USER = {
  email: 'admin@example.com',
  password: 'admin123',
  id: '1',
  name: '관리자',
};

export async function login(
  email: string,
  password: string
): Promise<User | null> {
  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 500));

  if (email === DEMO_USER.email && password === DEMO_USER.password) {
    return {
      id: DEMO_USER.id,
      email: DEMO_USER.email,
      name: DEMO_USER.name,
    };
  }

  return null;
}

export async function logout(): Promise<void> {
  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 300));
}

export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;

  const stored = localStorage.getItem('admin_user');
  return stored ? JSON.parse(stored) : null;
}

export function storeUser(user: User): void {
  localStorage.setItem('admin_user', JSON.stringify(user));
}

export function clearStoredUser(): void {
  localStorage.removeItem('admin_user');
}
