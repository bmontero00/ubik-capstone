'use client';

import React, { useState } from 'react';
import { 
  MapPin, 
  Search, 
  SlidersHorizontal, 
  Calendar, 
  Compass, 
  ShieldCheck,
  PlusCircle
} from 'lucide-react';

interface DashboardViewProps {
  user: {
    id?: string;
    name: string;
    email: string;
    role?: string;
  };
}

export default function DashboardView({ user }: DashboardViewProps) {
  const [distanceRadius, setDistanceRadius] = useState(5);
  const [searchTerm, setSearchTerm] = useState('');

  // Datos simulados de eventos locales (se conectarán con NestJS/PostGIS en el Sprint 2)
  const mockEvents = [
    {
      id: '1',
      title: 'Feria Costumbrista y Gastronómica Barrial',
      organizer: 'Junta de Vecinos Parque Almagro',
      distance: '1.2 km',
      category: 'cultural',
      date: 'Sábado 18 de Octubre, 16:00',
      price: '$0 (Gratuito)',
      isFree: true,
    },
    {
      id: '2',
      title: 'Concierto Acústico Bandas Emergentes',
      organizer: 'Colectivo Cultural Alameda',
      distance: '3.4 km',
      category: 'música',
      date: 'Viernes 24 de Octubre, 20:00',
      price: '$5.000',
      isFree: false,
    },
    {
      id: '3',
      title: 'Taller Comunitario de Huertos Urbanos',
      organizer: 'Eco Santiago Centro',
      distance: '4.8 km',
      category: 'talleres',
      date: 'Domingo 26 de Octubre, 10:30',
      price: '$0 (Gratuito)',
      isFree: true,
    }
  ];

  return (