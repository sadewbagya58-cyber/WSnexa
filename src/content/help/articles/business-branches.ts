import { HelpArticle } from '../types';

export const BUSINESS_BRANCHES_ARTICLES: HelpArticle[] = [
  {
    slug: 'add-manage-branches',
    title: 'How to Add and Manage Branch Outlets',
    titleSiEn: 'Branch Outlets එකතු කිරීම සහ කළමනාකරණය කරන්නේ කෙසේද?',
    description: 'Learn how to configure your primary branch, add multiple restaurant locations, and switch active branch contexts.',
    descriptionSiEn: 'ඔබගේ ප්‍රධාන Branch එක සැකසීම, අමතර Branches එකතු කිරීම සහ active branch මාරු කරන ආකාරය.',
    category: 'business-branches',
    keywords: ['branches', 'outlets', 'locations', 'multiple branches', 'switch branch'],
    contextRoutes: ['/dashboard/branches'],
    estimatedReadMinutes: 3,
    steps: [
      {
        number: 1,
        title: 'Navigate to Branch Outlets',
        titleSiEn: 'Branch Outlets වෙත යන්න',
        instruction: 'Go to Settings → Branch Outlets (/dashboard/branches).',
        instructionSiEn: 'Dashboard sidebar එකෙන් Settings → Branch Outlets (/dashboard/branches) වෙත යන්න.',
      },
      {
        number: 2,
        title: 'Review or Add a Branch',
        titleSiEn: 'Branch එකක් එක් කරන්න හෝ Edit කරන්න',
        instruction: 'Click "+ Add Branch" to add a new outlet or click "Edit" on an existing branch to update its name, address, phone number, and tax settings.',
        instructionSiEn: '+ Add Branch click කර නව branch එකක් එක් කරන්න, හෝ පවතින branch එකක Edit click කර නම, ලිපිනය, phone number සහ tax විස්තර යාවත්කාලීන කරන්න.',
      },
      {
        number: 3,
        title: 'Switch Active Branch Context',
        titleSiEn: 'Active Branch මාරු කිරීම',
        instruction: 'Use the top-left branch selector dropdown in the navigation header to switch your active branch workspace at any time.',
        instructionSiEn: 'Navigation header හි ඇති Branch Selector dropdown එක මඟින් ඔබට අවශ්‍ය ඕනෑම අවස්ථාවක active branch එක මාරු කරගත හැක.',
      },
    ],
    notes: [
      'Each branch maintains its own isolated Service Areas, Tables, QR Codes, and Order Queues.',
    ],
    notesSiEn: [
      'සෑම Branch එකකටම වෙන් වූ Service Areas, Tables, QR Codes සහ Order Queues පවතී.',
    ],
    relatedArticles: ['operating-hours-and-modes', 'create-service-areas'],

    directAction: {
      label: 'Open Branch Outlets',
      labelSiEn: 'Branch Outlets වෙත යන්න',
      href: '/dashboard/branches',
    },
  },
  {
    slug: 'operating-hours-and-modes',
    title: 'Configuring Operating Hours & Branch Settings',
    titleSiEn: 'Operating Hours සහ Branch Settings සැකසීම',
    description: 'Set daily opening and closing hours, delivery/dine-in modes, and branch contact information.',
    descriptionSiEn: 'දෛනික විවෘත සහ වසා තබන වේලාවන්, Dine-in සහ Takeaway විකල්ප සකස් කරගන්නා ආකාරය.',
    category: 'business-branches',
    keywords: ['operating hours', 'schedule', 'opening hours', 'branch settings'],
    contextRoutes: ['/dashboard/branches'],
    estimatedReadMinutes: 3,
    steps: [
      {
        number: 1,
        title: 'Select Branch Settings',
        titleSiEn: 'Branch Settings තෝරන්න',
        instruction: 'Go to Settings → Branch Outlets and click Edit on your target branch.',
        instructionSiEn: 'Settings → Branch Outlets වෙත ගොස් අදාළ branch එකෙහි Edit click කරන්න.',
      },
      {
        number: 2,
        title: 'Configure Daily Schedule',
        titleSiEn: 'දෛනික කාලසටහන සකසන්න',
        instruction: 'Specify opening and closing hours for each day of the week. Toggle days off if your venue is closed.',
        instructionSiEn: 'සතියේ සෑම දිනකටම Open සහ Close වන වේලාවන් ඇතුළත් කරන්න. වසා තබන දින සඳහා toggle switch එක off කරන්න.',
      },
      {
        number: 3,
        title: 'Save Changes',
        titleSiEn: 'වෙනස්කම් Save කරන්න',
        instruction: 'Click Save Branch Settings to apply your schedule.',
        instructionSiEn: 'Save Branch Settings click කර කාලසටහන සක්‍රිය කරන්න.',
      },
    ],
    relatedArticles: ['add-manage-branches', 'complete-business-setup'],
    directAction: {
      label: 'Manage Branches',
      labelSiEn: 'Branches කළමනාකරණය',
      href: '/dashboard/branches',
    },
  },
];
