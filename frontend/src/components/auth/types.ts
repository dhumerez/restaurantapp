export type AuthVariant = 'dark' | 'light';
export type RegistrationMode = 'pending-approval' | 'self-serve' | 'disabled';

export interface DemoCredential {
  label: string;
  email: string;
  password: string;
}

export interface AuthPageProps {
  appName: string;
  tagline?: string;
  logo?: React.ReactNode;
  registrationMode: RegistrationMode;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister?: (name: string, email: string, password: string) => Promise<void>;
  defaultTab?: 'login' | 'register';
  variant?: AuthVariant;
  demoCredentials?: DemoCredential[];
  forgotPasswordHref?: string;
}
