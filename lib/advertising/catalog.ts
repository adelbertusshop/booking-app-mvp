export type AdvertisingClientType = 'salon_w_aplikacji' | 'firma_zewnetrzna';
export type AdvertisingDurationDays = 7 | 30 | 90;
export type AdvertisingPlacement = 'salon_catalog' | 'lumar_pages';
export type AdvertisingPlacementSlot = 'salon_listing' | 'featured_profile' | 'in_app_banner' | 'home_screen_banner' | 'sponsored_carousel';

export type AdvertisingPackageId =
  | 'listing_highlight'
  | 'featured_profile'
  | 'in_app_banner'
  | 'home_screen_banner'
  | 'sponsored_carousel';

export interface AdvertisingPackage {
  id: AdvertisingPackageId;
  name: string;
  description: string;
  placement: AdvertisingPlacement;
  placementLabel: string;
  placementSlot: AdvertisingPlacementSlot;
  features: string[];
  pricesNetPln: Record<AdvertisingClientType, Record<AdvertisingDurationDays, number>>;
}

export const ADVERTISING_DURATIONS: AdvertisingDurationDays[] = [7, 30, 90];

export const ADVERTISING_CLIENT_TYPES: {
  id: AdvertisingClientType;
  label: string;
  description: string;
}[] = [
  {
    id: 'salon_w_aplikacji',
    label: 'Salon w LUMAR',
    description: 'Masz konto salonu lub profil salonu w aplikacji.',
  },
  {
    id: 'firma_zewnetrzna',
    label: 'Firma zewnętrzna',
    description: 'Reklamujesz firmę, która nie posiada konta salonu w LUMAR.',
  },
];

/**
 * Single source of truth for advertising package prices.
 * All values are NET PLN exactly as approved by the product owner.
 * Do not add VAT here; tax calculation must use the configured billing system.
 */
export const ADVERTISING_PACKAGES: AdvertisingPackage[] = [
  {
    id: 'listing_highlight',
    name: 'Wyróżnienie na liście salonów / firm',
    description: 'Wyższa pozycja na liście oraz wyróżnienie profilu.',
    placement: 'salon_catalog',
    placementLabel: 'Lista salonów / firm',
    placementSlot: 'salon_listing',
    features: ['Wyższa pozycja na liście', 'Wyróżnienie profilu', 'Oznaczenie „Reklama”'],
    pricesNetPln: {
      salon_w_aplikacji: { 7: 49, 30: 149, 90: 349 },
      firma_zewnetrzna: { 7: 99, 30: 299, 90: 699 },
    },
  },
  {
    id: 'featured_profile',
    name: 'Wyróżniony profil + badge „Polecany”',
    description: 'Badge „Polecany” i wyróżniony profil.',
    placement: 'salon_catalog',
    placementLabel: 'Profil salonu / firmy',
    placementSlot: 'featured_profile',
    features: ['Wyróżniony profil', 'Badge „Polecany”', 'Oznaczenie „Reklama”'],
    pricesNetPln: {
      salon_w_aplikacji: { 7: 59, 30: 169, 90: 399 },
      firma_zewnetrzna: { 7: 119, 30: 349, 90: 799 },
    },
  },
  {
    id: 'in_app_banner',
    name: 'Baner w aplikacji',
    description: 'Baner graficzny w wybranej sekcji aplikacji.',
    placement: 'lumar_pages',
    placementLabel: 'Wybrana sekcja aplikacji',
    placementSlot: 'in_app_banner',
    features: ['Baner graficzny', 'Wybór obsługiwanej sekcji', 'Oznaczenie „Reklama”'],
    pricesNetPln: {
      salon_w_aplikacji: { 7: 129, 30: 349, 90: 799 },
      firma_zewnetrzna: { 7: 219, 30: 599, 90: 1299 },
    },
  },
  {
    id: 'home_screen_banner',
    name: 'Baner na ekranie głównym',
    description: 'Baner na ekranie startowym aplikacji.',
    placement: 'lumar_pages',
    placementLabel: 'Ekran główny',
    placementSlot: 'home_screen_banner',
    features: ['Widoczne miejsce na ekranie startowym', 'Baner graficzny', 'Oznaczenie „Reklama”'],
    pricesNetPln: {
      salon_w_aplikacji: { 7: 199, 30: 599, 90: 1399 },
      firma_zewnetrzna: { 7: 349, 30: 999, 90: 2199 },
    },
  },
  {
    id: 'sponsored_carousel',
    name: 'Karuzela / post sponsorowany',
    description: 'Sponsorowany post lub karuzela w aplikacji.',
    placement: 'lumar_pages',
    placementLabel: 'Karuzela / treści sponsorowane',
    placementSlot: 'sponsored_carousel',
    features: ['Post sponsorowany lub karuzela', 'Oznaczenie „Reklama”', 'Emisja przez wybrany okres'],
    pricesNetPln: {
      salon_w_aplikacji: { 7: 89, 30: 229, 90: 549 },
      firma_zewnetrzna: { 7: 149, 30: 399, 90: 899 },
    },
  },
];

export function getAdvertisingPackage(id: string): AdvertisingPackage | undefined {
  return ADVERTISING_PACKAGES.find((item) => item.id === id);
}

export function getAdvertisingNetPrice(
  packageId: AdvertisingPackageId,
  clientType: AdvertisingClientType,
  durationDays: AdvertisingDurationDays,
): number {
  const selectedPackage = getAdvertisingPackage(packageId);
  if (!selectedPackage) throw new Error('Nieznany pakiet reklamowy.');

  return selectedPackage.pricesNetPln[clientType][durationDays];
}

export function formatNetPrice(pricePln: number): string {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    maximumFractionDigits: 2,
  }).format(pricePln);
}
