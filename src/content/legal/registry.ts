import { LegalDocumentMetadata } from './types';

export const OFFICIAL_BUSINESS_INFO = {
  brand: 'WSNexa',
  tagline: 'Smart Hospitality. Simplified.',
  supportEmail: 'wsnexaofficial@gmail.com',
  phone: '0761434289',
  address: 'Panawewa, Bingiriya, Sri Lanka',
  legalNotice:
    'WSNexa platform policies and technical documentation are prepared to support operational transparency and applicable data protection principles under Sri Lankan law. These documents are pre-commercial drafts and must be reviewed by qualified Sri Lankan legal counsel prior to formal commercial execution.',
} as const;

export const LEGAL_DOCUMENTS: LegalDocumentMetadata[] = [
  // ─────────────────────────────────────────────────────────────────────────────
  // 1. TERMS & CONDITIONS
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'terms',
    slug: 'terms',
    title: 'Terms & Conditions',
    shortTitle: 'Terms of Service',
    version: '1.0',
    effectiveDate: 'March 18, 2025',
    lastUpdatedDate: 'September 10, 2026',
    status: 'under_review',
    requiresLegalReview: true,
    summary:
      'Standard Software-as-a-Service terms governing the access and operational use of WSNexa hospitality software, accounts, roles, subscriptions, and acceptable conduct.',
    href: '/legal/terms',
    sections: [
      {
        id: 'acceptance',
        title: '1. Acceptance of Terms & Pre-Commercial Status',
        paragraphs: [
          'These Terms and Conditions ("Terms") constitute a legally binding agreement between you ("Customer", "Business Owner", or "User") and WSNexa ("WSNexa", "we", "us", or "our"), regarding your access to and use of the WSNexa software-as-a-service platform, mobile web services, APIs, and associated applications.',
          'By registering an account, configuring a hospitality venue, accessing our dashboard, scanning QR table codes, or using any part of the service, you agree to be bound by these Terms. If you are entering into these Terms on behalf of a hospitality business, entity, or branch, you represent that you possess the requisite authority to bind such entity.',
          'Notice of Pre-Commercial Review: WSNexa is currently provided for evaluation, Android APK testing, and structured pilot deployments. Formal commercial rollout is subject to legal qualification by licensed counsel under the laws of Sri Lanka.',
        ],
      },
      {
        id: 'eligibility-account',
        title: '2. Eligibility & Account Security',
        paragraphs: [
          'To register an account or manage a business venue on WSNexa, you must be at least 18 years of age and legally competent to enter into contracts under applicable law.',
          'Account Registration: You agree to provide accurate, current, and complete business information during registration and to promptly update your profile if operational details change.',
          'Credential Confidentiality: You are responsible for safeguarding your login credentials and ensuring that authorized personnel maintain password hygiene. You must notify WSNexa Support immediately at wsnexaofficial@gmail.com upon discovering any unauthorized account activity.',
        ],
      },
      {
        id: 'roles-permissions',
        title: '3. Business Accounts & Role-Based Access Control',
        paragraphs: [
          'WSNexa operates an organizational hierarchy with granular Role-Based Access Control (RBAC). Business accounts may invite staff members and assign specific operational roles:',
        ],
        bulletPoints: [
          'Business Owner: Ultimate administrative authority over business entity, subscriptions, branch creation, billing, and organizational structure.',
          'Branch Manager: Operational control over designated branch outlets, service areas, tables, menu publishing, and localized staff shifts.',
          'Cashier: Authority to review bill settlements, process customer payments, issue validated refunds, and manage POS cash registers.',
          'Kitchen Staff (KDS): Operational access to active kitchen ticket queues, recipe preparations, and preparation stage markers.',
          'Waitstaff: Authority to create dine-in table orders, submit add-on items, and request order modifications on behalf of seated guests.',
        ],
      },
      {
        id: 'service-description',
        title: '4. SaaS Service Description & Operations',
        paragraphs: [
          'WSNexa provides multi-tenant hospitality management software engineered for restaurants, cafes, hotels, resorts, villas, and food service venues.',
          'Core features include digital QR menu browsing, dine-in table ordering, waiter ordering interfaces, Kitchen Display System (KDS) feeds, cashier settlement, recipe Bill of Materials (BOM) inventory consumption, guest loyalty programs, and executive analytics.',
          'Service Availability: WSNexa exercises reasonable commercial diligence to maintain high platform availability. However, we do not warrant continuous, uninterrupted, or fault-free availability. Planned maintenance, infrastructure upgrades, or carrier network interruptions may temporarily affect service access.',
        ],
      },
      {
        id: 'acceptable-use',
        title: '5. Acceptable Use & Prohibited Conduct',
        paragraphs: [
          'You agree to use WSNexa strictly for legitimate hospitality venue operations in full compliance with applicable laws.',
          'You shall not:',
        ],
        bulletPoints: [
          'Attempt to bypass PostgreSQL Row-Level Security (RLS), tenant isolation boundaries, or API authentication controls.',
          'Conduct unauthorized vulnerability scanning, automated scraping, denial-of-service attacks, or stress testing without prior written authorization.',
          'Generate fraudulent dining orders, tamper with table QR tokens, or submit falsified payment settlement references.',
          'Upload malicious software, virus payloads, or unauthorized media to WSNexa storage infrastructure.',
          'Use the platform for money laundering, fraudulent merchant schemes, or transactions involving illegal contraband.',
        ],
      },
      {
        id: 'intellectual-property',
        title: '6. Intellectual Property & Data Ownership',
        paragraphs: [
          'WSNexa Ownership: All rights, title, and interest in and to the WSNexa software, user interfaces, branding, software algorithms, and system architecture remain the exclusive property of WSNexa.',
          'Customer Data Ownership: The Customer retains all rights, ownership, and intellectual property in their proprietary menu content, product photography, business trademarks, customer lists, and financial records processed through the platform.',
          'License to Host: The Customer grants WSNexa a non-exclusive, worldwide, royalty-free license to host, display, and process Customer Data solely for the operational delivery and security of the SaaS services.',
        ],
      },
      {
        id: 'subscriptions-billing',
        title: '7. Subscriptions, Fees & Billing',
        paragraphs: [
          'Subscription fees are denominated in Sri Lankan Rupees (LKR). Indicative monthly plan tiers (Starter, Growth, or Enterprise) reflect current pre-commercial evaluation and pilot configurations.',
          'WSNexa has not activated a production online payment gateway. During current evaluation and pilot phases, billing arrangements and subscription activations are coordinated directly via approved settlement or pilot billing agreements. Technical integrations for Sri Lankan payment gateways are under active development for future commercial activation. Failure to maintain agreed subscription terms may result in account suspension after a reasonable grace period.',
          'Detailed billing terms, upgrade policies, and draft fee schedules are governed by our Subscription & Billing Policy.',
        ],
      },
      {
        id: 'liability-disclaimers',
        title: '8. Disclaimers & Limitation of Liability',
        paragraphs: [
          'WSNexa is provided on an "AS IS" and "AS AVAILABLE" basis. To the maximum extent permitted by Sri Lankan law, WSNexa disclaims all warranties, express or implied, including merchantability, fitness for a particular purpose, and non-infringement.',
          'WSNexa does not warrant uninterrupted operational continuity, complete immunity from data corruption, continuous availability without scheduled maintenance, or that hardware peripherals (such as thermal receipt printers or kitchen display monitors) will remain perpetually compatible.',
          'Under no circumstances shall WSNexa be liable for any indirect, incidental, consequential, special, or punitive damages, including loss of business profits, customer food disputes, or operational downtime.',
        ],
      },
      {
        id: 'dispute-governing-law',
        title: '9. Dispute Resolution & Governing Law',
        paragraphs: [
          'These Terms shall be governed by, construed, and enforced in accordance with the laws of the Democratic Socialist Republic of Sri Lanka.',
          'Any dispute, controversy, or claim arising out of or relating to these Terms or the breach thereof shall first be submitted to good-faith mutual negotiation between the parties. If unresolved within thirty (30) business days, the dispute shall be subject to the exclusive jurisdiction of the competent courts of Sri Lanka.',
        ],
      },
      {
        id: 'contact-notices',
        title: '10. Contact & Legal Inquiries',
        paragraphs: [
          'Official inquiries, formal legal notices, or policy clarifications should be directed to:',
          'WSNexa Legal & Support: wsnexaofficial@gmail.com | Phone: 0761434289 | Address: Panawewa, Bingiriya, Sri Lanka.',
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. PRIVACY POLICY
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'privacy',
    slug: 'privacy',
    title: 'Privacy Policy',
    shortTitle: 'Privacy Policy',
    version: '1.0',
    effectiveDate: 'March 18, 2025',
    lastUpdatedDate: 'September 10, 2026',
    status: 'under_review',
    requiresLegalReview: true,
    summary:
      'Detailed overview of personal data collection, processing operations, multi-tenant controller/processor responsibilities, retention practices, and data subject rights under Sri Lankan data protection law.',
    href: '/legal/privacy',
    sections: [
      {
        id: 'intro-controller-model',
        title: '1. Introduction & Multi-Tenant Data Controller Model',
        paragraphs: [
          'WSNexa ("we", "us", or "our") respects the privacy and confidentiality of all individuals who interact with our hospitality software platform. This Privacy Policy details how we process, store, and safeguard personal information in connection with our services.',
          'Legal Framework: WSNexa is designed to support applicable data protection obligations under the Personal Data Protection Act No. 9 of 2022 (PDPA) and the Personal Data Protection (Amendment) Act No. 22 of 2025 of Sri Lanka (operational from 18 March 2025).',
          'Crucial Distinction: Data Controller vs. Data Processor:',
        ],
        bulletPoints: [
          'WSNexa as Data Controller: We act as the Data Controller for direct account registration details, business owner profiles, billing accounts, technical server access logs, and communications directed to WSNexa Support.',
          'Hospitality Venue as Data Controller (WSNexa as Data Processor): When a hospitality venue (restaurant, hotel, cafe) operates WSNexa to manage customer dining, table reservations, QR orders, guest phone numbers, loyalty points, or kitchen orders, the individual venue is the primary Data Controller. WSNexa acts as a SaaS Data Processor providing the digital infrastructure on behalf of the venue.',
        ],
      },
      {
        id: 'data-categories',
        title: '2. Categories of Personal Data Collected',
        paragraphs: [
          'We collect only the minimum personal information necessary to deliver, secure, and operate the platform:',
        ],
        bulletPoints: [
          'Business & Owner Information: Full name, business email address, contact phone number, registered venue name, physical address, operating currency, and timezone.',
          'Staff Member Information: Name, work email, contact phone, branch assignment, system role (Owner, Manager, Cashier, Kitchen, Waiter), and operational action timestamps.',
          'Dining Guest / Customer Information: Optional guest name, phone number (for SMS/order status updates or loyalty programs), table seating association, ordered items, dietary notes, and payment preference.',
          'Operational & Transactional Data: Live order tickets, item modifiers, kitchen preparation timestamps, cashier settlements, payment transaction identifiers, and inventory stock usage.',
          'Technical & Session Information: Strictly necessary authentication tokens, active business/branch selector cookies, IP addresses recorded in server traffic logs, and browser user-agent headers for session security.',
        ],
      },
      {
        id: 'legal-basis',
        title: '3. Legal Basis for Processing',
        paragraphs: [
          'Under the Sri Lanka Personal Data Protection Act No. 9 of 2022, we process personal data under the following lawful bases:',
        ],
        bulletPoints: [
          'Performance of a Contract: Processing is required to deliver SaaS capabilities, fulfill order lifecycles, and process subscription transactions.',
          'Legitimate Operational Interests: Maintaining platform security, preventing dining fraud, enforcing tenant isolation, and debugging system errors.',
          'Statutory & Legal Obligations: Maintaining financial and tax audit records as required under Sri Lankan revenue and commercial laws.',
          'Consent: Where a dining guest voluntarily joins a venue loyalty reward program or opts into promotional SMS communications.',
        ],
      },
      {
        id: 'access-isolation',
        title: '4. Data Access Controls & Tenant Isolation',
        paragraphs: [
          'Multi-Tenant Row-Level Security (RLS): All customer and operational data is strictly segregated at the database layer using PostgreSQL Row-Level Security. No hospitality venue or authorized user can access, query, or view data belonging to another tenant.',
          'Role-Based Authorization: Inside each tenant workspace, access to sensitive features (such as financial settlement, cashier balances, staff invitations, and raw audit logs) is strictly restricted based on verified system roles.',
        ],
      },
      {
        id: 'subprocessors',
        title: '5. Subprocessors & Third-Party Integrations',
        paragraphs: [
          'We do not sell, rent, or monetize personal data to third parties. We engage only reputable infrastructure subprocessors necessary for operational delivery:',
        ],
        bulletPoints: [
          'Cloud Database & Auth Infrastructure: Supabase (managed PostgreSQL database, secure user authentication, and encrypted file storage).',
          'Direct Billing & Settlement Processing: During the current pre-commercial phase, subscription and pilot transactions are processed directly without an active third-party payment gateway. Technical integrations with Sri Lankan payment service providers remain in development for future activation, at which point applicable processing terms will be updated.',
          'No Advertising Trackers: WSNexa does NOT embed advertising pixels, social media trackers, or third-party behavioral analytics scripts.',
        ],
      },
      {
        id: 'retention-deletion',
        title: '6. Data Retention & Erasure Principles',
        paragraphs: [
          'Data Minimization: We retain personal information only for as long as is necessary to fulfill operational, contractual, and statutory accounting purposes.',
          'Account Data: Retained while the business subscription remains active. Account owners may request permanent deletion as described in our Data & Account Deletion Policy.',
          'Guest Dining Data: Temporary QR guest session tokens expire automatically. Completed order history and settlement logs are retained in accordance with the venue’s operational policies and statutory tax audit obligations.',
        ],
      },
      {
        id: 'data-subject-rights',
        title: '7. Data Subject Rights Under Sri Lankan Law',
        paragraphs: [
          'Under Part II of the Sri Lanka Personal Data Protection Act No. 9 of 2022, data subjects possess the following statutory rights:',
        ],
        bulletPoints: [
          'Right of Access: You have the right to request confirmation and a summary of personal data held about you.',
          'Right to Rectification: You may request the correction of inaccurate or incomplete personal information.',
          'Right to Erasure / Deletion: You may request the deletion of personal data subject to legal, tax, or fraud-prevention retention exceptions.',
          'Right to Withdraw Consent: Where processing relies on consent, you may withdraw your consent at any time without affecting prior lawful processing.',
          'Exercising Rights: Direct your request to wsnexaofficial@gmail.com with your name, account details, and the nature of your request.',
        ],
      },
      {
        id: 'contact-privacy',
        title: '8. Privacy Inquiries & Contact',
        paragraphs: [
          'For privacy questions, data subject access requests, or regulatory communications regarding our data handling practices, please contact:',
          'WSNexa Privacy & Data Protection Desk: wsnexaofficial@gmail.com | Phone: 0761434289 | Address: Panawewa, Bingiriya, Sri Lanka.',
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. COOKIE POLICY
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'cookies',
    slug: 'cookies',
    title: 'Cookie & Storage Policy',
    shortTitle: 'Cookie Policy',
    version: '1.0',
    effectiveDate: 'March 18, 2025',
    lastUpdatedDate: 'September 10, 2026',
    status: 'under_review',
    requiresLegalReview: true,
    summary:
      'Clear, honest disclosure of cookies, local storage, and session tokens utilized by WSNexa strictly for essential authentication and operational context.',
    href: '/legal/cookies',
    sections: [
      {
        id: 'what-are-cookies',
        title: '1. What Are Cookies and Local Storage?',
        paragraphs: [
          'Cookies are small text files placed on your device by your web browser when visiting a website. Local storage and session storage are standard browser technologies that allow web applications to store functional data locally on your device.',
          'Our Privacy-First Commitment: WSNexa does NOT use third-party tracking cookies, advertising trackers, or behavioral profiling cookies. We use only strictly necessary and functional storage mechanisms required for platform operation.',
        ],
      },
      {
        id: 'strictly-necessary',
        title: '2. Strictly Necessary Cookies',
        paragraphs: [
          'These cookies are essential for the operation of WSNexa. Without these cookies, authenticated dashboard navigation and secure ordering cannot function:',
        ],
        bulletPoints: [
          'sb-*-auth-token: Supabase secure session cookie containing encrypted JWT authentication tokens to verify your login session.',
          'wsnexa_active_business: Stores the unique identifier of the currently selected business workspace for multi-tenant users.',
          'wsnexa_active_branch: Stores the active branch location ID selected within your business dashboard.',
          'wsnexa_qrs_{branchId}: Secure dining session cookie identifying an active dine-in table QR ordering visit.',
        ],
      },
      {
        id: 'functional-storage',
        title: '3. Functional & Intent Cookies',
        paragraphs: [
          'These cookies preserve user intent across navigation steps to ensure a smooth guest and staff experience:',
        ],
        bulletPoints: [
          'wsnexa_claim_intent: Temporarily stores an unauthenticated guest order ID so the order can be associated with their profile upon login or registration.',
          'wsnexa_favorite_intent: Stores a customer favorite menu item intent prior to completing authentication.',
        ],
      },
      {
        id: 'local-storage',
        title: '4. Browser Local Storage & Caching',
        paragraphs: [
          'We use standard browser local storage for temporary client-side data cache:',
        ],
        bulletPoints: [
          'wsnexa_cart_{venue}_{table}: Caches items added to a dining cart so that seated guests do not lose their selections on accidental page reload.',
          'kitchen_sound_preference: Remembers whether the kitchen display audio alert tone is enabled or muted.',
        ],
      },
      {
        id: 'managing-cookies',
        title: '5. Managing and Disabling Cookies',
        paragraphs: [
          'Most web browsers allow you to manage cookie settings through their preferences menu. However, because all cookies used by WSNexa are strictly necessary for core functionality, disabling cookies will prevent you from logging into the platform or submitting dine-in orders.',
          'For inquiries regarding our storage practices, contact wsnexaofficial@gmail.com.',
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. ACCEPTABLE USE POLICY
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'acceptable-use',
    slug: 'acceptable-use',
    title: 'Acceptable Use Policy',
    shortTitle: 'Acceptable Use',
    version: '1.0',
    effectiveDate: 'March 18, 2025',
    lastUpdatedDate: 'September 10, 2026',
    status: 'under_review',
    requiresLegalReview: true,
    summary:
      'Standards of conduct governing acceptable operational usage, anti-fraud standards, system security protections, and prohibited activities across WSNexa.',
    href: '/legal/acceptable-use',
    sections: [
      {
        id: 'purpose',
        title: '1. Purpose & Applicability',
        paragraphs: [
          'This Acceptable Use Policy ("AUP") defines the rules and standards of behavior that apply to all users, hospitality venues, staff members, and dining guests accessing WSNexa.',
          'By using our services, you agree to comply with this AUP. Violations may result in immediate suspension or termination of access.',
        ],
      },
      {
        id: 'prohibited-activities',
        title: '2. Prohibited Activities',
        paragraphs: [
          'You agree not to engage in or facilitate any of the following prohibited actions:',
        ],
        bulletPoints: [
          'Security Bypass: Attempting to circumvent PostgreSQL Row-Level Security, multi-tenant isolation, API authentication tokens, or role-based permission boundaries.',
          'Malicious Attacks: Deploying viruses, ransomware, Trojan horses, automated scrapers, web spiders, or participating in denial-of-service (DoS/DDoS) attacks against WSNexa infrastructure.',
          'Ordering Fraud & Spam: Generating fake QR table scans, spamming order queues, tampering with dining table security PINs, or spoofing GPS geofencing coordinates.',
          'Payment Abuse: Submitting forged payment settlement references, executing chargeback fraud, or misrepresenting financial transaction statuses.',
          'Credential Sharing: Disclosing or sharing administrative passwords, PINs, or API keys with unauthorized third parties.',
          'Unlawful Content: Uploading menu content, imagery, or communications that violate third-party copyright, contain hate speech, or facilitate illegal goods or contraband.',
        ],
      },
      {
        id: 'investigation-enforcement',
        title: '3. Investigation, Suspension & Enforcement',
        paragraphs: [
          'WSNexa reserves the right to monitor system logs and audit trails to detect anomalous activity, fraud, or violations of this policy.',
          'Upon discovering a suspected breach, WSNexa may take appropriate remedial actions, including issuing operational warnings, temporary feature restriction, immediate account suspension, or permanent termination.',
          'We cooperate with lawful law enforcement requests and regulatory authorities in Sri Lanka regarding verified fraudulent or illegal activities.',
        ],
      },
      {
        id: 'reporting-violations',
        title: '4. Reporting Violations',
        paragraphs: [
          'If you discover any violation of this Acceptable Use Policy or suspect abuse of the platform, please report it immediately to wsnexaofficial@gmail.com.',
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. SUBSCRIPTION & BILLING POLICY
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'subscription-billing',
    slug: 'subscription-billing',
    title: 'Subscription & Billing Policy',
    shortTitle: 'Subscription & Billing',
    version: '1.0',
    effectiveDate: 'March 18, 2025',
    lastUpdatedDate: 'September 10, 2026',
    status: 'under_review',
    requiresLegalReview: true,
    summary:
      'Pre-commercial billing terms, indicative plan configurations in LKR, payment processing status, renewal policies, and account suspension terms.',
    href: '/legal/subscription-billing',
    sections: [
      {
        id: 'overview',
        title: '1. SaaS Billing Overview',
        paragraphs: [
          'WSNexa operates on a software-as-a-service subscription model. Business accounts select a subscription tier based on their operational scale, branch count, staff capacity, and dining volume.',
          'All subscription fees are denominated and charged in Sri Lankan Rupees (LKR).',
        ],
      },
      {
        id: 'plan-tiers',
        title: '2. Indicative Subscription Tiers (Pre-Commercial)',
        paragraphs: [
          'WSNexa provides the following indicative monthly subscription configurations as implemented in our current software engine for evaluation and pilot deployments (commercial rates subject to final confirmation prior to formal commercial release):',
        ],
        bulletPoints: [
          'Starter Tier (Indicative): LKR 4,499 (4499) / month. Designed for 1 branch outlet, up to 10 active staff accounts, 50 dining tables, 250 menu items, and 3 custom operational roles.',
          'Growth Tier (Indicative): LKR 8,999 (8999) / month. Designed for up to 3 branch outlets, 40 active staff accounts, 200 dining tables, 1,000 menu items, and 15 custom operational roles.',
          'Enterprise Tier (Indicative): Custom base LKR 24,999 (24999) / month. Designed for 5 branch outlets and 75 active staff accounts. Additional branches are billed at LKR 3,000 / month each, and additional staff blocks of 25 accounts are billed at LKR 2,000 / month.',
        ],
      },
      {
        id: 'payment-methods',
        title: '3. Payment Processing Status & Direct Settlement',
        paragraphs: [
          'Production Payment Gateway Status: WSNexa has not yet activated a production online payment gateway. All online payment gateway integrations are currently in pre-commercial development and are not active for automated self-service card or mobile wallet processing.',
          'Pilot & Evaluation Billing: During current pilot and evaluation phases, subscription billing and account activations are coordinated directly between WSNexa and the Business Owner via approved direct settlement or manual invoicing arrangements.',
          'Future Gateway Integrations: Technical adapters for major Sri Lankan payment methods (including local card networks, Dialog Genie / eZ Cash, and direct bank transfer processors) are engineered in the platform and will be activated upon formal commercial release.',
        ],
      },
      {
        id: 'billing-cycles-receipts',
        title: '4. Billing Cycles & Electronic Receipts',
        paragraphs: [
          'Subscriptions are billed monthly in advance starting on the date of activation. Upon successful transaction settlement, an electronic invoice and payment confirmation are recorded in your Dashboard Settings under Billing & Subscription.',
          'Taxes: Subscription fees are exclusive of any applicable government taxes, levies, or VAT unless explicitly stated. The Business Owner is responsible for applicable local tax compliance.',
        ],
      },
      {
        id: 'upgrades-downgrades',
        title: '5. Plan Upgrades & Downgrades',
        paragraphs: [
          'Upgrades: You may upgrade your plan at any time. Higher operational limits take effect immediately upon settlement of the upgrade payment.',
          'Downgrades: Downgrade requests take effect at the conclusion of the current prepaid monthly billing cycle, provided your operational resource usage (branches, staff, tables) conforms to the lower tier limits.',
        ],
      },
      {
        id: 'failed-payments',
        title: '6. Failed Payments & Grace Period',
        paragraphs: [
          'If a subscription renewal payment fails, WSNexa provides a seven (7) day grace period during which operational access continues uninterrupted.',
          'If payment remains uncompleted after the grace period, administrative access to the venue dashboard may be temporarily suspended until billing is resolved. Dining guest menus remain viewable in read-only mode during initial suspension to prevent customer disruption.',
        ],
      },
      {
        id: 'billing-support',
        title: '7. Billing Disputes & Inquiries',
        paragraphs: [
          'For billing questions, tax receipt requests, or payment discrepancies, contact our billing team at wsnexaofficial@gmail.com.',
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. REFUND & CANCELLATION POLICY
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'refund-cancellation',
    slug: 'refund-cancellation',
    title: 'Refund & Cancellation Policy',
    shortTitle: 'Refund & Cancellation',
    version: '1.0',
    effectiveDate: 'March 18, 2025',
    lastUpdatedDate: 'September 10, 2026',
    status: 'under_review',
    requiresLegalReview: true,
    summary:
      'Clear, dual-tier policy separating WSNexa SaaS subscription refunds from independent hospitality venue end-customer dining order cancellations and refunds.',
    href: '/legal/refund-cancellation',
    sections: [
      {
        id: 'dual-tier-notice',
        title: '1. Important Dual-Tier Structure Notice',
        paragraphs: [
          'This policy governs two distinct legal and operational relationships that must not be confused:',
          'Tier A: WSNexa SaaS Subscription Cancellations & Refunds (governing the contract between WSNexa and the Business Owner for software licensing).',
          'Tier B: Venue Customer Order Cancellations & Refunds (governing the commercial contract between an individual dining guest and the hospitality venue for prepared food and beverages).',
        ],
      },
      {
        id: 'tier-a-saas',
        title: '2. Tier A — WSNexa SaaS Subscription Cancellations & Refunds',
        paragraphs: [
          'Subscription Cancellation: Business Owners may cancel their WSNexa SaaS subscription at any time via Dashboard Settings → Billing & Subscription. Upon cancellation, your service remains active through the conclusion of the current paid billing period.',
          'Pilot Evaluation Period: For new business accounts during the pre-commercial evaluation phase, if the platform fails to deliver core operational functionality as specified, a full refund of the initial subscription may be requested in writing within seven (7) calendar days of initial activation.',
          'Non-Refundable Fees: Except for the initial evaluation period or as mandated by Sri Lankan consumer law, prepaid monthly subscription fees are non-refundable once the billing cycle has commenced.',
        ],
      },
      {
        id: 'tier-b-guest-orders',
        title: '3. Tier B — Hospitality Venue Customer Order Cancellations & Refunds',
        paragraphs: [
          'Independent Merchant Relationship: WSNexa provides technical software tools enabling restaurants to receive, process, and manage dining orders. WSNexa is not a restaurant, does not prepare food, and is not a party to the food sale contract between the dining guest and the venue.',
          'Venue Cancellation Policies: Each venue defines its own customer order cancellation policy within WSNexa Order Security Settings from six technical options:',
        ],
        bulletPoints: [
          'Disabled: Customer cancellation is entirely prohibited; guests must speak to a waiter.',
          'Before Confirmation: Cancellation permitted only while the order is pending staff review.',
          'Within Time Limit: Cancellation permitted within a configured grace window (e.g. 2 minutes).',
          'Before Preparation: Cancellation permitted until the kitchen staff actively marks preparation started.',
          'During Preparation: Cancellation permitted during cooking, with potential food waste accounting.',
          'Until Ready: Cancellation permitted until food is marked ready for service.',
        ],
      },
      {
        id: 'tier-b-refund-mechanics',
        title: '4. Venue Refund Processing Mechanics',
        paragraphs: [
          'WSNexa Order Cancellation Engine Invariants:',
          '1. Unprepared Orders: When an order is cancelled prior to kitchen preparation, inventory stock is automatically returned to active branch stock.',
          '2. In-Preparation Orders: When an order is cancelled while cooking, the system records kitchen food waste with ingredient cost attribution.',
          '3. Cashier POS Settlement: If an order was paid prior to cancellation, the WSNexa Cashier Settlement Modal calculates the authoritative refundable balance and records an audit-logged refund transaction.',
          'Consumer Notice: Whether a dining guest receives a cash, card, or wallet refund for cancelled food items is determined by the individual venue’s policy, payment state, and the Sri Lanka Consumer Affairs Authority Act No. 9 of 2003.',
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. DATA & ACCOUNT DELETION POLICY
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'data-deletion',
    slug: 'data-deletion',
    title: 'Data & Account Deletion Policy',
    shortTitle: 'Data Deletion',
    version: '1.0',
    effectiveDate: 'March 18, 2025',
    lastUpdatedDate: 'September 10, 2026',
    status: 'under_review',
    requiresLegalReview: true,
    summary:
      'Procedures and timelines for business account owners and dining guests to request account deactivation, personal data erasure, and handling of statutory retention exceptions.',
    href: '/legal/data-deletion',
    sections: [
      {
        id: 'overview',
        title: '1. Overview & Deletion Principles',
        paragraphs: [
          'WSNexa is committed to supporting data subject rights and transparency regarding data erasure under the Personal Data Protection Act No. 9 of 2022 of Sri Lanka.',
          'This policy outlines how business account owners, staff members, and dining guests can request account deactivation or the permanent erasure of their personal information.',
        ],
      },
      {
        id: 'deactivation-vs-deletion',
        title: '2. Account Deactivation vs. Permanent Erasure',
        paragraphs: [
          'Account Deactivation: Temporarily revokes login access, halts customer-facing QR menu discovery, and freezes billing while preserving historical records for potential reactivation.',
          'Permanent Deletion: Irreversibly purges business configuration, branch outlets, dining area layouts, menu items, product photos, and staff memberships from our active databases.',
        ],
      },
      {
        id: 'business-deletion-steps',
        title: '3. How Business Owners Request Account Deletion',
        paragraphs: [
          'To request the permanent deletion of a business account:',
          '1. Submit a written deletion request to wsnexaofficial@gmail.com from the primary email address registered as the Business Owner.',
          '2. Verification: Our security team will conduct mandatory identity verification to ensure the request originates from the authorized owner.',
          '3. Settlement: Ensure all outstanding subscription invoices or merchant disputes are settled.',
          '4. Execution: Upon verification, active databases will purge the business workspace within fourteen (14) business days.',
        ],
      },
      {
        id: 'statutory-exceptions',
        title: '4. Statutory Retention Exceptions',
        paragraphs: [
          'Under Sri Lankan revenue, commercial, and financial accounting laws, certain transaction records cannot be immediately erased:',
        ],
        bulletPoints: [
          'Financial & Tax Audit Logs: Completed invoice records, payment receipt references, and statutory tax calculations must be retained for required statutory audit periods.',
          'Dispute & Fraud Records: Logs relating to active payment chargebacks, fraud investigations, or legal proceedings are preserved until formal case closure.',
          'Backup Archival Rotation: Encrypted disaster-recovery database backups rotate and purge on a rolling 30-to-90 day lifecycle.',
        ],
      },
      {
        id: 'guest-deletion',
        title: '5. Dining Guest / Customer Data Deletion',
        paragraphs: [
          'Unregistered Guests: Dine-in guests who place orders via table QR code without creating an account leave no persistent customer profile. Session cookies expire automatically.',
          'Registered Diners: Customers who created a guest account or enrolled in a venue loyalty program may request deletion of their profile, phone number, and loyalty balance by emailing wsnexaofficial@gmail.com or contacting the venue directly.',
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. SECURITY & RESPONSIBLE DISCLOSURE
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'security',
    slug: 'security',
    title: 'Security & Responsible Disclosure Policy',
    shortTitle: 'Security & Disclosure',
    version: '1.0',
    effectiveDate: 'March 18, 2025',
    lastUpdatedDate: 'September 10, 2026',
    status: 'under_review',
    requiresLegalReview: true,
    summary:
      'Architecture principles of multi-tenant security, Row-Level Security isolation, RBAC, and clear guidelines for ethical security researchers reporting vulnerabilities.',
    href: '/legal/security',
    sections: [
      {
        id: 'architecture-principles',
        title: '1. Security Architecture Principles',
        paragraphs: [
          'WSNexa implements defense-in-depth security principles engineered to protect hospitality operations, sensitive customer data, and financial transactions.',
          'We do not make misleading claims of "100% security" or "zero risk"; rather, we maintain rigorous technical controls to detect, mitigate, and resolve vulnerabilities.',
        ],
      },
      {
        id: 'technical-safeguards',
        title: '2. Technical & Organizational Safeguards',
        paragraphs: [
          'Our platform incorporates the following verified technical safeguards:',
        ],
        bulletPoints: [
          'Multi-Tenant PostgreSQL Row-Level Security (RLS): Database policies enforce strict tenant boundaries. Queries cannot access rows outside the verified tenant context.',
          'Role-Based Access Control (RBAC): Least-privilege role permissions ensure staff members only access capabilities required for their duties (e.g. kitchen staff cannot view cashier balances).',
          'Encryption in Transit: All web and API traffic is encrypted using modern TLS 1.3 / HTTPS encryption.',
          'Anti-Fraud Controls: Dining orders support physical GPS geofencing validation and dining table security PINs to prevent remote order tampering.',
          'Realtime Audit Logging: High-impact actions (refunds, cancellations, role modifications, branch creations) generate immutable audit records.',
        ],
      },
      {
        id: 'responsible-disclosure',
        title: '3. Responsible Disclosure Guidelines for Researchers',
        paragraphs: [
          'We welcome reports from ethical security researchers who discover vulnerabilities in WSNexa services. We ask that researchers observe the following rules:',
        ],
        bulletPoints: [
          'Do not access, modify, or download data belonging to other hospitality businesses or customers.',
          'Do not conduct denial-of-service (DoS/DDoS) attacks, automated stress testing, or disruption of active kitchen/cashier operations.',
          'Do not execute destructive attacks or alter database records.',
          'Give WSNexa reasonable time (at least 30 business days) to remediate the vulnerability before public disclosure.',
        ],
      },
      {
        id: 'how-to-report',
        title: '4. How to Submit a Vulnerability Report',
        paragraphs: [
          'Submit security vulnerability reports to wsnexaofficial@gmail.com or via our dedicated Security Report Form at /security/report.',
          'Include the following details:',
        ],
        bulletPoints: [
          'Clear vulnerability summary and severity assessment (Low, Medium, High, Critical).',
          'Exact URL, API endpoint, or component affected.',
          'Step-by-step reproduction instructions and proof of concept.',
          'Screenshots or sanitized log extracts demonstrating the issue.',
        ],
      },
      {
        id: 'our-commitment',
        title: '5. Our Commitment to Researchers',
        paragraphs: [
          'WSNexa commits to acknowledging valid security reports within forty-eight (48) business hours, providing status updates during investigation, and not pursuing legal action against researchers acting in good-faith compliance with this policy.',
        ],
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Registry Query Utilities
// ─────────────────────────────────────────────────────────────────────────────

export function getAllLegalDocuments(): LegalDocumentMetadata[] {
  return LEGAL_DOCUMENTS;
}

export function getLegalDocumentBySlug(slug: string): LegalDocumentMetadata | undefined {
  return LEGAL_DOCUMENTS.find((doc) => doc.slug === slug || doc.id === slug);
}
