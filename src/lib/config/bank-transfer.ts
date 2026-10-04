/**
 * WSNexa Official Bank Transfer Configuration
 *
 * Configurable bank account details for manual subscription transfers in Sri Lanka.
 *
 * OPERATIONAL & SECURITY POLICY:
 * - isConfigured: boolean gate. Must remain FALSE until corporate/business account
 *   suitability and authorization have been formally confirmed.
 * - When isConfigured is false, account details are NOT exposed to customers or UI,
 *   and manual submission is disallowed. Instead, direct settlement assistance
 *   is routed to official support channels.
 */

export interface WSNexaBankDetails {
  isConfigured: boolean;
  supportEmail: string;
  supportPhone: string;
  unconfiguredMessage: string;
  bankName?: string;
  branchName?: string;
  accountName?: string;
  accountNumber?: string;
  swiftCode?: string;
  instructions: string[];
}

export function getWSNexaBankDetails(): WSNexaBankDetails {
  // Gating flag: Strictly FALSE until corporate business authorization is confirmed.
  const isConfigured = false;

  const supportEmail = 'wsnexaofficial@gmail.com';
  const supportPhone = '0761434289';

  // Centrally configured bank account details (held in configuration; hidden from UI while unconfigured)
  const bankName = "People's Bank";
  const branchName = 'Bingiriya Branch';
  const accountName = 'W.Swarnalatha';
  const accountNumber = '172200270058302';
  const swiftCode = undefined;

  const unconfiguredMessage =
    'Direct bank-transfer subscription payments are currently undergoing formal bank onboarding. To arrange subscription activation or manual settlement, please contact our support team at wsnexaofficial@gmail.com or 0761434289.';

  return {
    isConfigured,
    supportEmail,
    supportPhone,
    unconfiguredMessage,
    // Bank details are strictly undefined when not configured to prevent accidental leakage
    bankName: isConfigured ? bankName : undefined,
    branchName: isConfigured ? branchName : undefined,
    accountName: isConfigured ? accountName : undefined,
    accountNumber: isConfigured ? accountNumber : undefined,
    swiftCode: isConfigured ? swiftCode : undefined,
    instructions: isConfigured
      ? [
          'Transfer the exact subscription amount in LKR via online banking, mobile app, or branch CDM/counter deposit.',
          'Enter the Payment Intent Reference (#SUB-...) as your transfer narration or deposit slip remark.',
          'Take a clear screenshot or photo of the bank transaction receipt / slip.',
          'Upload the receipt and submit your Bank Transaction Reference Number below.',
          'Our team verifies deposits against official bank records within 1–4 business hours.',
        ]
      : [],
  };
}
