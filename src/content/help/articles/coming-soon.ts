import { HelpArticle } from '../types';

export const COMING_SOON_ARTICLES: HelpArticle[] = [
  {
    slug: 'loyalty-and-rewards-coming-soon',
    title: 'Loyalty & Rewards Program (Coming Soon in Next Update)',
    description: 'Overview of the upcoming patron points calculation, customizable discount vouchers, and VIP membership tier capabilities.',
    category: 'coming-soon',
    keywords: ['loyalty', 'rewards', 'points', 'discounts', 'vouchers', 'tiers', 'coming soon', 'roadmap'],
    comingSoon: true,
    estimatedReadMinutes: 3,
    steps: [
      {
        number: 1,
        title: 'Status: Planned for Upcoming Release',
        instruction: 'The Loyalty & Rewards engine is currently moved to a "Coming Soon" status for the WSNexa V1 release to ensure focused operational excellence on order routing, waiter assistance, and payments.',
      },
      {
        number: 2,
        title: 'Upcoming Patron Points Earning',
        instruction: 'In the next update, restaurants will be able to award points automatically when guests complete table orders (e.g. 1 point per 100 LKR spent or flat points per dining visit).',
      },
      {
        number: 3,
        title: 'Upcoming Rewards & Voucher Redemptions',
        instruction: 'Venues will be able to create custom discount vouchers (e.g. 500 LKR off, 10% discount, or free beverages) that guests can redeem directly during table checkout.',
      },
      {
        number: 4,
        title: 'Architecture & Historical Data Intact',
        instruction: 'All underlying database schemas, tier models, and historical order snapshot records remain completely preserved and ready for immediate activation.',
      },
    ],
    notes: [
      'No point balances are deducted or earned during the V1 release period.',
    ],
    relatedArticles: ['welcome-to-wsnexa', 'setting-up-your-business'],
    directAction: {
      label: 'View Loyalty Roadmap Page',
      href: '/dashboard/loyalty',
    },
  },
];
