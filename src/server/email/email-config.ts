/**
 * Configuration for the WSNexa Email Notification System.
 */

export const PRIMARY_BUSINESS_NOTIFICATION_EMAIL = 'Wsnexaofficial@gmail.com';

export const DEFAULT_SENDER_NAME = 'WSNexa';
export const DEFAULT_SENDER_EMAIL = process.env.EMAIL_FROM || 'notifications@wsnexa.app';
export const DEFAULT_FROM_ADDRESS = `${DEFAULT_SENDER_NAME} <${DEFAULT_SENDER_EMAIL}>`;

export interface EmailProviderConfig {
  provider: 'resend' | 'smtp' | 'simulated';
  hasLiveCredentials: boolean;
  resendApiKey?: string;
  smtp?: {
    host: string;
    port: number;
    user: string;
    pass: string;
  };
}

export function getEmailProviderConfig(): EmailProviderConfig {
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  if (resendApiKey) {
    return {
      provider: 'resend',
      hasLiveCredentials: true,
      resendApiKey,
    };
  }

  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = (process.env.SMTP_PASSWORD || process.env.SMTP_PASS)?.trim();

  if (smtpHost && smtpUser && smtpPass) {
    return {
      provider: 'smtp',
      hasLiveCredentials: true,
      smtp: {
        host: smtpHost,
        port: smtpPort,
        user: smtpUser,
        pass: smtpPass,
      },
    };
  }

  // Graceful fallback for pre-commercial / test environments
  return {
    provider: 'simulated',
    hasLiveCredentials: false,
  };
}
