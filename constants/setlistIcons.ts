import {
  ListMusic,
  Music,
  Mic,
  Guitar,
  Drum,
  Piano,
  Headphones,
  Radio,
  Star,
  Flame,
  Zap,
  Heart,
  PartyPopper,
  Calendar,
  MapPin,
  Moon,
  Sun,
  Coffee,
  Beer,
  Church,
  Tent,
  Home,
  type LucideIcon
} from 'lucide-react';

/** Icônes proposées pour une setlist (valeur stockée dans `setlists.icon`). */
export const SETLIST_ICONS: { name: string; label: string; Icon: LucideIcon }[] = [
  { name: 'list-music', label: 'Liste', Icon: ListMusic },
  { name: 'music', label: 'Musique', Icon: Music },
  { name: 'mic', label: 'Micro', Icon: Mic },
  { name: 'guitar', label: 'Guitare', Icon: Guitar },
  { name: 'drum', label: 'Batterie', Icon: Drum },
  { name: 'piano', label: 'Piano', Icon: Piano },
  { name: 'headphones', label: 'Casque', Icon: Headphones },
  { name: 'radio', label: 'Radio', Icon: Radio },
  { name: 'star', label: 'Étoile', Icon: Star },
  { name: 'flame', label: 'Flamme', Icon: Flame },
  { name: 'zap', label: 'Éclair', Icon: Zap },
  { name: 'heart', label: 'Cœur', Icon: Heart },
  { name: 'party', label: 'Fête', Icon: PartyPopper },
  { name: 'calendar', label: 'Agenda', Icon: Calendar },
  { name: 'map-pin', label: 'Lieu', Icon: MapPin },
  { name: 'moon', label: 'Soirée', Icon: Moon },
  { name: 'sun', label: 'Journée', Icon: Sun },
  { name: 'coffee', label: 'Café', Icon: Coffee },
  { name: 'beer', label: 'Bar', Icon: Beer },
  { name: 'church', label: 'Église', Icon: Church },
  { name: 'tent', label: 'Festival', Icon: Tent },
  { name: 'home', label: 'Maison', Icon: Home }
];

export const DEFAULT_SETLIST_ICON = 'list-music';

export const getSetlistIcon = (name?: string | null): LucideIcon =>
  SETLIST_ICONS.find(i => i.name === name)?.Icon ?? ListMusic;
