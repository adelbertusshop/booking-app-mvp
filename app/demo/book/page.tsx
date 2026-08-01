'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { bookingSchema, BookingFormData } from '@/lib/schemas/booking';

export default function BookingPage() {
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      date: '',
      time: '',
    },
  });

  const selectedDate = watch('date');
  const selectedTime = watch('time');

  // Pobieraj wolne sloty po zmianie daty
  useEffect(() => {
    if (!selectedDate) return;

    async function fetchSlots() {
      setLoadingSlots(true);
      setValue('time', ''); // Reset wybranej godziny po zmianie daty

      try {
        const res = await fetch(`/api/appointments/available-slots?date=${selectedDate}&provider_id=1`);
        const data = await res.json();

        if (res.ok) {
          setAvailableSlots(data.slots || []);
        } else {
          setAvailableSlots([]);
        }
      } catch (err) {
        console.error('Błąd pobierania slotów:', err);
      } finally {
        setLoadingSlots(false);
      }
    }

    fetchSlots();
  }, [selectedDate, setValue]);

  const onSubmit = async (data: BookingFormData) => {
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/appointments/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const resData = await res.json();

      if (!res.ok) {
        throw new Error(resData.error || 'Wystąpił błąd podczas rezerwacji.');
      }

      setMessage({ type: 'success', text: 'Rezerwacja udana!' });
      setAvailableSlots((prev) => prev.filter((slot) => slot !== data.time));
      reset();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '450px', margin: '40px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h2>Formularz Rezerwacji</h2>

      {message && (
        <div style={{ padding: '10px', marginBottom: '15px', borderRadius: '4px', backgroundColor: message.type === 'success' ? '#d4edda' : '#f8d7da', color: message.type === 'success' ? '#155724' : '#721c24' }}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <label style={{ display: 'block' }}>Imię:</label>
          <input {...register('firstName')} style={{ width: '100%', padding: '8px' }} />
          {errors.firstName && <span style={{ color: '#d9534f', fontSize: '12px' }}>{errors.firstName.message}</span>}
        </div>

        <div>
          <label style={{ display: 'block' }}>Nazwisko:</label>
          <input {...register('lastName')} style={{ width: '100%', padding: '8px' }} />
          {errors.lastName && <span style={{ color: '#d9534f', fontSize: '12px' }}>{errors.lastName.message}</span>}
        </div>

        <div>
          <label style={{ display: 'block' }}>Adres e-mail:</label>
          <input type="email" {...register('email')} style={{ width: '100%', padding: '8px' }} />
          {errors.email && <span style={{ color: '#d9534f', fontSize: '12px' }}>{errors.email.message}</span>}
        </div>

        <div>
          <label style={{ display: 'block' }}>Numer telefonu:</label>
          <input type="tel" {...register('phone')} style={{ width: '100%', padding: '8px' }} />
          {errors.phone && <span style={{ color: '#d9534f', fontSize: '12px' }}>{errors.phone.message}</span>}
        </div>

        <div>
          <label style={{ display: 'block' }}>Data wizyty:</label>
          <input type="date" {...register('date')} style={{ width: '100%', padding: '8px' }} />
          {errors.date && <span style={{ color: '#d9534f', fontSize: '12px' }}>{errors.date.message}</span>}
        </div>

        {selectedDate && (
          <div>
            <label style={{ display: 'block', marginBottom: '6px' }}>Wybierz godzinę:</label>
            {loadingSlots ? (
              <p style={{ fontSize: '14px', color: '#666' }}>Sprawdzanie wolnych terminów...</p>
            ) : availableSlots.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {availableSlots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setValue('time', slot, { shouldValidate: true })}
                    style={{
                      padding: '8px',
                      borderRadius: '4px',
                      border: '1px solid #0070f3',
                      backgroundColor: selectedTime === slot ? '#0070f3' : '#fff',
                      color: selectedTime === slot ? '#fff' : '#0070f3',
                      cursor: 'pointer',
                    }}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '14px', color: '#d9534f' }}>Brak wolnych terminów w wybranym dniu.</p>
            )}
            {errors.time && <span style={{ color: '#d9534f', fontSize: '12px', display: 'block', marginTop: '4px' }}>{errors.time.message}</span>}
          </div>
        )}

        <button type="submit" disabled={loading} style={{ padding: '10px', backgroundColor: '#0070f3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '10px' }}>
          {loading ? 'Rezerwowanie...' : 'Zarezerwuj wizytę'}
        </button>
      </form>
    </div>
  );
}