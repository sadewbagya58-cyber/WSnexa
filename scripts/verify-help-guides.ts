/**
 * WSNexa — Phase 37 UX Recovery Step 3
 * Help & Guides Bilingual Engine Verification Suite
 */

import {
  getAllCategories,
  getAllArticles,
  getArticleBySlug,
  getArticlesByCategory,
  getPopularArticles,
  getTroubleshootingArticles,
  getRecommendedArticles,
  getArticlesForRoute,
  searchHelpArticles,
} from '../src/content/help/registry';
import {
  isValidHelpLanguage,
  resolveLocalizedText,
  resolveLocalizedArray,
  DEFAULT_HELP_LANGUAGE,
  HELP_LANGUAGE_STORAGE_KEY,
} from '../src/lib/help/help-language';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAILED: ${message}`);
  }
}

async function runHelpVerification() {
  console.log('\n======================================================');
  console.log('  WSNexa Phase 37 Step 3: Help & Guides Verification');
  console.log('======================================================\n');

  // 1. Language Resolution & Types
  console.log('--- 1. Language Utilities & Hydration Safety ---');
  assert(DEFAULT_HELP_LANGUAGE === 'en', 'Default Help language is "en"');
  assert(HELP_LANGUAGE_STORAGE_KEY === 'wsnexa_help_language', 'Storage key matches "wsnexa_help_language"');
  assert(isValidHelpLanguage('en') === true, 'isValidHelpLanguage accepts "en"');
  assert(isValidHelpLanguage('si-en') === true, 'isValidHelpLanguage accepts "si-en"');
  assert(isValidHelpLanguage('fr') === false, 'isValidHelpLanguage rejects invalid languages');
  assert(isValidHelpLanguage(null) === false, 'isValidHelpLanguage rejects null');
  assert(isValidHelpLanguage(undefined) === false, 'isValidHelpLanguage rejects undefined');

  assert(
    resolveLocalizedText('en', 'English Title', 'සිංහල මාතෘකාව') === 'English Title',
    'resolveLocalizedText returns English text when language is "en"'
  );
  assert(
    resolveLocalizedText('si-en', 'English Title', 'සිංහල මාතෘකාව') === 'සිංහල මාතෘකාව',
    'resolveLocalizedText returns Sinhala+English text when language is "si-en"'
  );
  assert(
    resolveLocalizedText('si-en', 'English Title', '') === 'English Title',
    'resolveLocalizedText gracefully falls back to English when siEn text is empty'
  );
  assert(
    resolveLocalizedText('si-en', 'English Title', undefined) === 'English Title',
    'resolveLocalizedText gracefully falls back to English when siEn text is undefined'
  );

  const testEnArr = ['Note 1', 'Note 2'];
  const testSiArr = ['සටහන 1', 'සටහන 2'];
  assert(
    resolveLocalizedArray('en', testEnArr, testSiArr)[0] === 'Note 1',
    'resolveLocalizedArray returns English array for "en"'
  );
  assert(
    resolveLocalizedArray('si-en', testEnArr, testSiArr)[0] === 'සටහන 1',
    'resolveLocalizedArray returns Sinhala+English array for "si-en"'
  );

  // 2. Categories Verification
  console.log('\n--- 2. Help Categories Verification ---');
  const categories = getAllCategories();
  assert(categories.length >= 10, `Found ${categories.length} categories (>= 10 expected)`);

  for (const cat of categories) {
    assert(Boolean(cat.id && cat.id.length > 0), `Category has valid ID: ${cat.id}`);
    assert(Boolean(cat.title && cat.title.length > 0), `Category ${cat.id} has English title`);
    assert(Boolean(cat.titleSiEn && cat.titleSiEn.length > 0), `Category ${cat.id} has Sinhala+English title`);
    assert(Boolean(cat.description && cat.description.length > 0), `Category ${cat.id} has English description`);
    assert(Boolean(cat.descriptionSiEn && cat.descriptionSiEn.length > 0), `Category ${cat.id} has Sinhala+English description`);
    assert(Boolean(cat.icon && cat.icon.length > 0), `Category ${cat.id} has icon`);
  }

  // 3. Articles Collection & Coverage Verification
  console.log('\n--- 3. Help Articles Coverage & Structure ---');
  const articles = getAllArticles();
  assert(articles.length >= 25, `Found ${articles.length} total help articles`);

  const uniqueSlugs = new Set<string>();
  let totalStepsCount = 0;
  let bilingualTitlesCount = 0;
  let bilingualDescriptionsCount = 0;
  let bilingualStepsCount = 0;

  for (const article of articles) {
    assert(!uniqueSlugs.has(article.slug), `Article slug is unique: ${article.slug}`);
    uniqueSlugs.add(article.slug);

    assert(Boolean(article.title), `Article "${article.slug}" has English title`);
    if (article.titleSiEn) bilingualTitlesCount++;
    if (article.descriptionSiEn) bilingualDescriptionsCount++;

    assert(article.steps && article.steps.length >= 2, `Article "${article.slug}" has >= 2 steps (has ${article.steps?.length})`);

    for (const step of article.steps) {
      totalStepsCount++;
      assert(step.number > 0, `Step ${step.number} of "${article.slug}" has valid number`);
      assert(Boolean(step.title), `Step ${step.number} of "${article.slug}" has title`);
      assert(Boolean(step.instruction), `Step ${step.number} of "${article.slug}" has instruction`);
      if (step.titleSiEn && step.instructionSiEn) {
        bilingualStepsCount++;
      }
    }

    if (article.directAction) {
      assert(
        article.directAction.href.startsWith('/dashboard') || article.directAction.href.startsWith('/m'),
        `Article "${article.slug}" directAction points to valid path: ${article.directAction.href}`
      );
    }
  }

  assert(
    bilingualTitlesCount >= 25,
    `Bilingual Sinhala+English titles coverage: ${bilingualTitlesCount}/${articles.length}`
  );
  assert(
    bilingualDescriptionsCount >= 25,
    `Bilingual Sinhala+English descriptions coverage: ${bilingualDescriptionsCount}/${articles.length}`
  );
  assert(
    bilingualStepsCount >= 50,
    `Bilingual Sinhala+English steps coverage: ${bilingualStepsCount}/${totalStepsCount}`
  );

  // 4. Product Rule: UI Terms Preservation in Sinhala + English Mix
  console.log('\n--- 4. UI Terms Preservation Rule Audit ---');
  const criticalUITerms = [
    'Service Areas',
    'Dining Tables',
    'QR Codes',
    'Menu',
    'Categories',
    'Kitchen',
    'Waiter',
    'Cashier',
    'POS',
    'Order Security',
    'Payment Methods',
    'Business Setup',
  ];

  let foundUITermsCount = 0;
  const allSiEnText = articles
    .map((a) => `${a.titleSiEn || ''} ${a.descriptionSiEn || ''} ${(a.steps || []).map((s) => `${s.titleSiEn || ''} ${s.instructionSiEn || ''}`).join(' ')}`)
    .join(' ');

  for (const term of criticalUITerms) {
    const includes = allSiEnText.includes(term);
    assert(includes, `Sinhala+English Mix preserves exact English UI term: "${term}"`);
    if (includes) foundUITermsCount++;
  }
  assert(foundUITermsCount === criticalUITerms.length, 'All critical English UI terms preserved intact');

  // 5. Slug Alias Resolution
  console.log('\n--- 5. Slug Alias Resolution ---');
  const legacyAliases = [
    { alias: 'understanding-order-security-levels', canonical: 'order-security-overview' },
    { alias: 'setting-up-public-venue-profile', canonical: 'publishing-your-venue-profile' },
    { alias: 'creating-menu-categories', canonical: 'create-categories' },
    { alias: 'welcome-to-wsnexa', canonical: 'what-is-wsnexa' },
    { alias: 'setting-up-your-business', canonical: 'complete-business-setup' },
  ];

  for (const item of legacyAliases) {
    const resolved = getArticleBySlug(item.alias);
    assert(
      Boolean(resolved && resolved.slug === item.canonical),
      `Alias "${item.alias}" cleanly resolves to canonical "${item.canonical}"`
    );
  }

  // 6. Search Engine Bilingual Queries
  console.log('\n--- 6. Search Engine Bilingual Queries ---');
  const testQueries = [
    { q: 'QR codes', minResults: 1 },
    { q: 'Kitchen Queue', minResults: 1 },
    { q: 'Cashier POS', minResults: 1 },
    { q: 'Table PIN', minResults: 1 },
    { q: 'පිසීම', minResults: 1 }, // Sinhala query
    { q: 'වේටර්', minResults: 1 }, // Sinhala query
    { q: 'ගැටළු', minResults: 1 }, // Sinhala query
    { q: 'Inventory', minResults: 1 },
  ];

  for (const t of testQueries) {
    const res = searchHelpArticles(t.q);
    assert(
      res.length >= t.minResults,
      `Search for "${t.q}" returned ${res.length} matching guides (>= ${t.minResults} expected)`
    );
  }

  // 7. Route-Aware & Role-Aware Recommendations
  console.log('\n--- 7. Route-Aware & Role Recommendations ---');
  const tableRouteArticles = getArticlesForRoute('/dashboard/tables');
  assert(
    tableRouteArticles.length >= 1,
    `Route /dashboard/tables matched ${tableRouteArticles.length} guides`
  );

  const waiterGuides = getRecommendedArticles('waiter');
  assert(waiterGuides.length >= 2, `Waiter role returned ${waiterGuides.length} tailored guides`);
  assert(
    waiterGuides.some((g) => g.slug.includes('waiter')),
    'Waiter recommendations include waiter-specific guides'
  );

  const kitchenGuides = getRecommendedArticles('kitchen_staff');
  assert(kitchenGuides.length >= 2, `Kitchen role returned ${kitchenGuides.length} tailored guides`);
  assert(
    kitchenGuides.some((g) => g.slug.includes('kitchen')),
    'Kitchen recommendations include kitchen-specific guides'
  );

  const cashierGuides = getRecommendedArticles('cashier');
  assert(cashierGuides.length >= 2, `Cashier role returned ${cashierGuides.length} tailored guides`);
  assert(
    cashierGuides.some((g) => g.slug.includes('cashier') || g.slug.includes('payment')),
    'Cashier recommendations include cashier & payment guides'
  );

  // 8. Troubleshooting Structure
  console.log('\n--- 8. Troubleshooting Articles Diagnostics ---');
  const troubleArticles = getTroubleshootingArticles();
  assert(troubleArticles.length >= 5, `Found ${troubleArticles.length} troubleshooting guides`);
  for (const ta of troubleArticles) {
    assert(ta.troubleshooting === true, `Article "${ta.slug}" is flagged as troubleshooting`);
  }

  // 9. Forbidden Readiness Overclaims Audit
  console.log('\n--- 9. Forbidden Readiness Overclaims Audit ---');
  const forbiddenPhrases = [
    'ready for live ordering',
    'get your restaurant ready for live ordering',
    'Every business must finish these 6 steps to accept orders',
    'ready to accept customers',
  ];

  for (const article of articles) {
    const fullArticleContent = [
      article.title,
      article.titleSiEn || '',
      article.description,
      article.descriptionSiEn || '',
      ...(article.steps || []).map((s) => `${s.title} ${s.instruction} ${s.titleSiEn || ''} ${s.instructionSiEn || ''}`),
      ...(article.notes || []),
      ...(article.notesSiEn || []),
    ].join(' ');

    for (const phrase of forbiddenPhrases) {
      assert(
        !fullArticleContent.toLowerCase().includes(phrase.toLowerCase()),
        `Article "${article.slug}" does NOT contain forbidden overclaim: "${phrase}"`
      );
    }
  }

  // 10. Guest Assistance & Critical Button Labels Integrity
  console.log('\n--- 10. Workflow & UI Button Labels Integrity ---');
  const assistanceArticle = getArticleBySlug('guest-assistance-calls');
  assert(Boolean(assistanceArticle), 'Article "guest-assistance-calls" exists in registry');
  if (assistanceArticle) {
    const assistanceText = JSON.stringify(assistanceArticle);
    assert(
      !assistanceText.includes('Acknowledge" to clear the notification'),
      'Assistance guide does NOT use obsolete "Acknowledge" dismissal claim'
    );
    assert(
      !assistanceText.includes('audio chime and see a flashing table badge'),
      'Assistance guide does NOT use unsupported audio chime / flashing badge claims'
    );
    assert(
      assistanceText.includes('Accept Request ⚡') || assistanceText.includes('Mark Completed ✓'),
      'Assistance guide uses stateful Accept Request / Mark Completed actions'
    );
  }

  // 11. Route & Related Article Integrity
  console.log('\n--- 11. Route & Related Article Slug Integrity ---');
  for (const article of articles) {
    if (article.directAction) {
      assert(
        article.directAction.href.startsWith('/dashboard') ||
          article.directAction.href.startsWith('/customer') ||
          article.directAction.href.startsWith('/venues') ||
          article.directAction.href.startsWith('/m'),
        `Article "${article.slug}" has valid directAction.href (${article.directAction.href})`
      );
      assert(
        Boolean(article.directAction.label && article.directAction.labelSiEn),
        `Article "${article.slug}" has bilingual directAction labels`
      );
    }

    if (article.relatedArticles && article.relatedArticles.length > 0) {
      for (const relatedSlug of article.relatedArticles) {
        const relatedArticle = getArticleBySlug(relatedSlug);
        assert(
          Boolean(relatedArticle),
          `Article "${article.slug}" related article slug "${relatedSlug}" cleanly resolves`
        );
      }
    }
  }

  // 12. Bilingual Completeness
  console.log('\n--- 12. Bilingual Completeness Audit ---');
  let missingBilingualCount = 0;
  for (const article of articles) {
    if (!article.titleSiEn || !article.descriptionSiEn) {
      missingBilingualCount++;
      console.error(`  ✗ Article missing titleSiEn/descriptionSiEn: ${article.slug}`);
    }
  }
  assert(missingBilingualCount === 0, `All ${articles.length} articles have bilingual titles and descriptions`);

  console.log('\n======================================================');
  console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runHelpVerification().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});

