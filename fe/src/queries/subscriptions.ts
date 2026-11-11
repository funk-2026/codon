import { useQuery } from '@tanstack/react-query';
import { listPlans } from '@/src/api/subscriptions';
import { keys } from './keys';
import { useMe } from './profile';

export type Plan = {
  id: string;
  name: string;
  price: number;
  durationMonths: number;
  durationLabel: string;
  benefits: string[];
  /** The plan the student is subscribed to right now. */
  current?: boolean;
};

/** Subscription plans, with the student's current plan flagged. */
export function usePlans() {
  const me = useMe();
  const plans = useQuery({ queryKey: keys.plans, queryFn: listPlans, staleTime: 10 * 60_000 });
  const activePlanId = me.data?.active_subscription?.plan_id;
  const data: Plan[] | undefined = plans.data?.plans.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price_paise / 100,
    durationMonths: Math.round(p.duration_days / 30),
    durationLabel: `${Math.round(p.duration_days / 30)} months`,
    benefits: p.benefits || [],
    current: activePlanId === p.id,
  }));
  return {
    plans: data,
    kycRequired: me.data?.kyc_required ?? false,
    isPending: plans.isPending || me.isPending,
    isError: plans.isError || me.isError,
    refetch: () => void Promise.all([plans.refetch(), me.refetch()]),
  };
}

/** The raw plan list (checkout picks one by id). */
export const usePlanList = () => useQuery({ queryKey: keys.plans, queryFn: listPlans, staleTime: 10 * 60_000 });
