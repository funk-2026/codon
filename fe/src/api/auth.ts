import { apiFetch } from './client';

/** POST /api/v1/auth/otp/send */
export function sendOTP(phoneNumber: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/auth/otp/send', {
    method: 'POST',
    body: JSON.stringify({ phone_number: `+91${phoneNumber}` }),
  });
}

export type VerifyOTPResponse = {
  access_token: string;
  user: {
    id: string;
    phone_number: string;
    role: 'student' | 'teacher' | 'admin';
    name: string;
    kyc_status: string;
  };
};

/** POST /api/v1/auth/otp/verify */
export function verifyOTP(
  phoneNumber: string,
  otpCode: string,
  deviceId: string,
  deviceInfo: string,
): Promise<VerifyOTPResponse> {
  return apiFetch<VerifyOTPResponse>('/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify({
      phone_number: `+91${phoneNumber}`,
      otp_code: otpCode,
      device_id: deviceId,
      device_info: deviceInfo,
    }),
  });
}

