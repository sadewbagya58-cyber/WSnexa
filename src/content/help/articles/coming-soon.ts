import { HelpArticle } from '../types';

export const COMING_SOON_ARTICLES: HelpArticle[] = [
  {
    slug: 'loyalty-and-rewards-coming-soon',
    title: 'Loyalty & Rewards Program (Coming Soon in Next Update)',
    titleSiEn: 'Loyalty & Rewards වැඩසටහන (ඉදිරි සංස්කරණයෙන් බලාපොරොත්තු වන්න)',
    description: 'Overview of the upcoming patron points calculation, customizable discount vouchers, and VIP membership tier capabilities.',
    descriptionSiEn: 'ඉදිරි සංස්කරණයේදී එක්වන Customer Points, Discount Vouchers සහ VIP Loyalty වැඩසටහන් පිළිබඳ මූලික විස්තරය.',
    category: 'coming-soon',
    keywords: ['loyalty', 'rewards', 'points', 'discounts', 'vouchers', 'tiers', 'coming soon', 'roadmap'],
    comingSoon: true,
    estimatedReadMinutes: 3,
    steps: [
      {
        number: 1,
        title: 'Status: Planned for Upcoming Release',
        titleSiEn: 'තත්ත්වය: ඉදිරි සංස්කරණය සඳහා සැලසුම් කර ඇත',
        instruction: 'The Loyalty & Rewards engine is currently scheduled for the next update to ensure focused operational excellence on order routing, waiter assistance, and payments.',
        instructionSiEn: 'Order Routing, Waiter Assistance සහ Payments වල උපරිම ක්‍රියාකාරීත්වය තහවුරු කිරීමෙන් පසු Loyalty & Rewards engine එක ඉදිරි සංස්කරණයෙන් නිකුත් කෙරේ.',
      },
      {
        number: 2,
        title: 'Upcoming Patron Points Earning',
        titleSiEn: 'පාරිභෝගිකයින් සඳහා Points එකතු කිරීම',
        instruction: 'In the next update, restaurants will be able to award points automatically when guests complete table orders (e.g. 1 point per 100 LKR spent or flat points per dining visit).',
        instructionSiEn: 'ඉදිරියේදී පාරිභෝගිකයා order එකක් සම්පූර්ණ කළ විට වියදම් කළ මුදල අනුව points ස්වයංක්‍රීයව හිමිවන පරිදි සකස් කළ හැක.',
      },
      {
        number: 3,
        title: 'Upcoming Rewards & Voucher Redemptions',
        titleSiEn: 'Rewards සහ Discount Vouchers ලබාදීම',
        instruction: 'Venues will be able to create custom discount vouchers (e.g. 500 LKR off, 10% discount, or free beverages) that guests can redeem directly during table checkout.',
        instructionSiEn: 'පාරිභෝගිකයින්ට Checkout හිදී භාවිතා කළ හැකි Discount Vouchers හෝ විශේෂ දීමනා ලබාදීමේ හැකියාව හිමිවේ.',
      },
      {
        number: 4,
        title: 'Architecture & Historical Data Intact',
        titleSiEn: 'දත්ත සහ තාක්ෂණික පදනම සුරක්ෂිතව ඇත',
        instruction: 'All underlying database schemas, tier models, and historical order snapshot records remain completely preserved and ready for immediate activation.',
        instructionSiEn: 'මීට අදාළ සියලුම database schemas සහ දත්ත සුරක්ෂිතව පවතින අතර ඉදිරි update එකෙන් සක්‍රිය වනු ඇත.',
      },
    ],
    notes: [
      'No point balances are deducted or earned during the V1 release period.',
    ],
    notesSiEn: [
      'V1 නිකුතුව තුළදී points කැපීමක් හෝ එකතු වීමක් සිදු නොවේ.',
    ],
    relatedArticles: ['what-is-wsnexa', 'complete-business-setup'],
    directAction: {
      label: 'View Loyalty Roadmap Page',
      labelSiEn: 'Loyalty Roadmap පිටුව බලන්න',
      href: '/dashboard/loyalty',
    },
  },
];

