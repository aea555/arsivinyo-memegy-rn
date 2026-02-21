import { apiClient } from '@/src/shared/services/api/apiClient';
import { CompleteOnboardingRequest, OnboardingStatusResponse } from '@/src/shared/types/api';

export async function getOnboardingStatus() {
  const response = await apiClient.get<OnboardingStatusResponse>('/users/me/onboarding/status');
  return response.data;
}

export async function completeOnboarding(payload: CompleteOnboardingRequest) {
  const response = await apiClient.post<OnboardingStatusResponse>('/users/me/onboarding/complete', payload);
  return response.data;
}
