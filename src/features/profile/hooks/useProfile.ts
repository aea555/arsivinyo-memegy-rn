import { useQuery } from '@tanstack/react-query';

import { getMyProfile } from '@/src/features/profile/api/profileApi';
import { queryClient } from '@/src/shared/services/api/queryClient';
import { UserDto } from '@/src/shared/types/api';
import { useAuthStore } from '@/src/store/authStore';

export function useProfile() {
  const cachedUser = useAuthStore((state) => state.user);
  const initialProfile =
    queryClient.getQueryData<UserDto>(['me']) ?? cachedUser ?? undefined;

  return useQuery({
    queryKey: ['me'],
    queryFn: getMyProfile,
    // Profile metadata changes infrequently; avoid noisy refetches on every page visit.
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    initialData: initialProfile,
  });
}
