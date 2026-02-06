import { useQuery } from '@tanstack/react-query';

import { getMyProfile } from '@/src/features/profile/api/profileApi';

export function useProfile() {
  return useQuery({
    queryKey: ['me'],
    queryFn: getMyProfile,
  });
}
