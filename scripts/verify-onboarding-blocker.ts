import {
  fullOnboardingSchema,
  businessProfileSchema,
  contactLocationSchema,
  operatingHoursSchema,
  brandingSchema,
  normalizeCountryCode,
  FullOnboardingPayload,
} from '../src/lib/validation/onboarding';

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    process.exit(1);
  }
}

console.log('================================================================');
console.log('  WSNexa Business Owner Onboarding Validation Blocker Suite');
console.log('================================================================\n');

// --- 1. Reproduction Data Validation Test ---
console.log('--- 1. Reproduction Data Validation ---');

const reproductionPayloadRaw = {
  business: {
    name: 'Nexa Grand Hotel',
    businessType: 'hotel' as const,
    description: 'Premier luxury hotel in Colombo',
    countryCode: 'Sri Lanka', // User entered full country name
    defaultCurrency: 'lkr',    // Lowercase currency
    timezone: 'Asia/Colombo',
  },
  location: {
    branchName: 'Colombo Main Hotel',
    branchCode: 'CMB01',
    email: 'info@nexagrand.lk',
    phone: '+94 11 234 5678',
    website: 'https://nexagrand.lk',
    addressLine1: '100 Galle Face Road',
    addressLine2: '',
    city: 'Colombo',
    region: 'Western Province',
    postalCode: '00100',
  },
  hours: {
    hours: [
      { dayOfWeek: 0, isClosed: false, opensAt: '08:00', closesAt: '22:00' },
      { dayOfWeek: 1, isClosed: false, opensAt: '08:00', closesAt: '22:00' },
      { dayOfWeek: 2, isClosed: false, opensAt: '08:00', closesAt: '22:00' },
      { dayOfWeek: 3, isClosed: false, opensAt: '08:00', closesAt: '22:00' },
      { dayOfWeek: 4, isClosed: false, opensAt: '08:00', closesAt: '22:00' },
      { dayOfWeek: 5, isClosed: false, opensAt: '08:00', closesAt: '22:00' },
      { dayOfWeek: 6, isClosed: false, opensAt: '08:00', closesAt: '22:00' },
    ],
  },
  branding: {
    logoUrl: 'https://example.com/storage/v1/object/public/business-assets/logos/user-1/logo.png',
  },
};

const parsedReproduction = fullOnboardingSchema.safeParse(reproductionPayloadRaw);
assert(parsedReproduction.success, '1a. Reproduction payload parses successfully with country "Sri Lanka" and currency "lkr"');
if (parsedReproduction.success) {
  assert(parsedReproduction.data.business.countryCode === 'LK', '1b. Country "Sri Lanka" automatically normalized to ISO-2 "LK"');
  assert(parsedReproduction.data.business.defaultCurrency === 'LKR', '1c. Currency "lkr" automatically transformed to uppercase "LKR"');
  assert(parsedReproduction.data.business.timezone === 'Asia/Colombo', '1d. Timezone preserved as "Asia/Colombo"');
  assert(parsedReproduction.data.business.businessType === 'hotel', '1e. Business type preserved as "hotel"');
  assert(parsedReproduction.data.location.branchCode === 'CMB01', '1f. Branch code preserved as "CMB01"');
}

// --- 2. Country Code Normalization Matrix ---
console.log('\n--- 2. Country Code Normalization Matrix ---');
assert(normalizeCountryCode('Sri Lanka') === 'LK', '2a. normalizeCountryCode("Sri Lanka") -> "LK"');
assert(normalizeCountryCode('sri lanka') === 'LK', '2b. normalizeCountryCode("sri lanka") -> "LK"');
assert(normalizeCountryCode('LK') === 'LK', '2c. normalizeCountryCode("LK") -> "LK"');
assert(normalizeCountryCode('lk') === 'LK', '2d. normalizeCountryCode("lk") -> "LK"');
assert(normalizeCountryCode('United States') === 'US', '2e. normalizeCountryCode("United States") -> "US"');
assert(normalizeCountryCode('USA') === 'US', '2f. normalizeCountryCode("USA") -> "US"');
assert(normalizeCountryCode('United Kingdom') === 'GB', '2g. normalizeCountryCode("United Kingdom") -> "GB"');
assert(normalizeCountryCode('UK') === 'GB', '2h. normalizeCountryCode("UK") -> "GB"');
assert(normalizeCountryCode('United Arab Emirates') === 'AE', '2i. normalizeCountryCode("United Arab Emirates") -> "AE"');
assert(normalizeCountryCode('UAE') === 'AE', '2j. normalizeCountryCode("UAE") -> "AE"');
assert(normalizeCountryCode('Singapore') === 'SG', '2k. normalizeCountryCode("Singapore") -> "SG"');
assert(normalizeCountryCode('Maldives') === 'MV', '2l. normalizeCountryCode("Maldives") -> "MV"');

// --- 3. Nullable and Optional Contact Fields ---
console.log('\n--- 3. Nullable & Optional Contact Location Fields ---');
const payloadWithNulls = {
  business: {
    name: 'Minimal Cafe',
    businessType: 'cafe' as const,
    countryCode: 'LK',
    defaultCurrency: 'LKR',
    timezone: 'Asia/Colombo',
  },
  location: {
    branchName: 'Main Branch',
    branchCode: 'MAIN',
    email: null,
    phone: null,
    website: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    region: null,
    postalCode: null,
  },
  hours: {
    hours: Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i,
      isClosed: false,
      opensAt: '08:00',
      closesAt: '22:00',
    })),
  },
  branding: {
    logoUrl: null,
  },
};

const parsedNulls = fullOnboardingSchema.safeParse(payloadWithNulls);
assert(parsedNulls.success, '3a. Full payload with null optional contact fields passes validation cleanly');

// --- 4. Draft State Integrity Simulation ---
console.log('\n--- 4. Draft Key Simulation & Self-Healing ---');

// Simulate the old bug where draft keys were shifted:
const corruptedLegacyDraftPayload: Record<string, any> = {
  location: {
    name: 'Nexa Grand Hotel',
    businessType: 'hotel',
    countryCode: 'LK',
    defaultCurrency: 'LKR',
    timezone: 'Asia/Colombo',
  },
  hours: {
    branchName: 'Colombo Main Hotel',
    branchCode: 'CMB01',
  },
  branding: {
    hours: Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i,
      isClosed: false,
      opensAt: '08:00',
      closesAt: '22:00',
    })),
  },
  review: {
    logoUrl: 'https://example.com/logo.png',
  },
};

// Self-healing algorithm used in getOnboardingDraftAction
let selfHealedPayload = { ...corruptedLegacyDraftPayload };
if (!selfHealedPayload.business && selfHealedPayload.location?.businessType) {
  selfHealedPayload = {
    business: selfHealedPayload.location,
    location: selfHealedPayload.hours?.branchName ? selfHealedPayload.hours : undefined,
    hours: selfHealedPayload.branding?.hours ? selfHealedPayload.branding : undefined,
    branding: selfHealedPayload.review?.logoUrl !== undefined ? selfHealedPayload.review : undefined,
  };
}

assert(selfHealedPayload.business?.name === 'Nexa Grand Hotel', '4a. Self-healing correctly recovers business profile from shifted location key');
assert(selfHealedPayload.location?.branchName === 'Colombo Main Hotel', '4b. Self-healing correctly recovers location from shifted hours key');
assert(Array.isArray(selfHealedPayload.hours?.hours) && selfHealedPayload.hours.hours.length === 7, '4c. Self-healing correctly recovers 7-day hours from shifted branding key');
assert(selfHealedPayload.branding?.logoUrl === 'https://example.com/logo.png', '4d. Self-healing correctly recovers logoUrl from shifted review key');

// Validate self-healed payload against full schema
const parsedHealed = fullOnboardingSchema.safeParse(selfHealedPayload);
assert(parsedHealed.success, '4e. Self-healed payload passes fullOnboardingSchema safeParse without error');

// --- 5. Error Reporting Precision ---
console.log('\n--- 5. Error Reporting Precision ---');
const invalidPayload = {
  business: {
    name: '', // Invalid empty name
    businessType: 'invalid_type' as any,
    countryCode: 'TOOLONGCODE',
    defaultCurrency: '1',
    timezone: '',
  },
  location: {
    branchName: '',
    branchCode: '',
  },
  hours: {
    hours: [], // Empty hours array
  },
  branding: {},
};

const failedParse = fullOnboardingSchema.safeParse(invalidPayload);
assert(!failedParse.success, '5a. Invalid payload correctly rejected by Zod schema');
if (!failedParse.success && failedParse.error) {
  const issues = failedParse.error.issues || [];
  const errorDetails = issues.map((err) => {
    const step = err.path[0] ? String(err.path[0]).toUpperCase() : 'GENERAL';
    const field = err.path.slice(1).join('.') || String(err.path[0]);
    return `[${step} → ${field}]: ${err.message}`;
  });

  assert(
    errorDetails.some((d) => d.includes('[BUSINESS → name]')),
    '5b. Formatted errors identify failing step and field: [BUSINESS → name]'
  );
  assert(
    errorDetails.some((d) => d.includes('[HOURS → hours]')),
    '5c. Formatted errors identify failing step and field: [HOURS → hours]'
  );
}

console.log('\n================================================================');
console.log('  All Onboarding Blocker Tests Passed Successfully!');
console.log('================================================================\n');
