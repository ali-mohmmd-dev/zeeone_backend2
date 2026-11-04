import { format } from 'date-fns';
import { enIN } from 'date-fns/locale';

export function formatDate(date: Date | string): string {
  return format(date, 'PPP', { locale: enIN });
}
