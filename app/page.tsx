'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/demo/book');
  }, [router]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh', 
      backgroundColor: '#000', 
      color: '#fff',
      fontFamily: 'sans-serif'
    }}>
      Przekierowywanie do systemu rezerwacji...
    </div>
  );
}