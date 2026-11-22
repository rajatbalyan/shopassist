import { Badge, type BadgeTone } from '@/components/badge';
import type { OrderStatus } from '@/types';

export const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: 'Placed',
  shipped: 'Shipped',
  delivered: 'Delivered',
};

const STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  placed: 'primary',
  shipped: 'warning',
  delivered: 'success',
};

export function StatusPill({ status }: { status: OrderStatus }) {
  return <Badge label={STATUS_LABEL[status]} tone={STATUS_TONE[status]} />;
}
