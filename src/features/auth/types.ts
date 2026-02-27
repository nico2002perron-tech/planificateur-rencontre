import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: 'admin' | 'advisor';
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'advisor';
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: 'admin' | 'advisor';
  }
}
