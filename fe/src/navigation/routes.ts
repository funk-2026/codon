/**
 * Every in-app route in one place. Import these instead of typing path strings, so a
 * moved screen is a one-line change and typos fail at compile time.
 * Dynamic values go in `params`: router.push({ pathname: ROUTES.student.testResult, params: { id } })
 */
export const ROUTES = {
  auth: {
    courseSelection: '/course-selection',
    otpVerify: '/otp-verify',
    phoneEntry: '/phone-entry',
    previewMode: '/preview-mode',
    profileSetup: '/profile-setup',
    rolePicker: '/role-picker',
  },
  student: {
    aboutMmm: '/(student)/about-mmm',
    bookmarks: '/(student)/bookmarks',
    brainHackDetail: '/(student)/brain-hack-detail',
    brainHacks: '/(student)/brain-hacks',
    checkout: '/(student)/checkout',
    contentReader: '/(student)/content-reader',
    customBuilder: '/(student)/custom-builder',
    customTests: '/(student)/custom-tests',
    editProfile: '/(student)/edit-profile',
    flashcardStudy: '/(student)/flashcard-study',
    flashcards: '/(student)/flashcards',
    giveFeedback: '/(student)/give-feedback',
    home: '/(student)/(tabs)/home',
    kycStatus: '/(student)/kyc-status',
    kycSubmission: '/(student)/kyc-submission',
    learn: '/(student)/(tabs)/learn',
    learnHierarchy: '/(student)/learn-hierarchy',
    manageDevices: '/(student)/manage-devices',
    myReports: '/(student)/my-reports',
    notifications: '/(student)/notifications',
    paymentFailed: '/(student)/payment-failed',
    paymentSuccess: '/(student)/payment-success',
    practice: '/(student)/(tabs)/practice',
    practiceHierarchy: '/(student)/practice-hierarchy',
    profile: '/(student)/(tabs)/profile',
    progressDetail: '/(student)/progress-detail',
    settings: '/(student)/settings',
    subscriptionPlans: '/(student)/subscription-plans',
    support: '/(student)/(tabs)/support',
    testHistory: '/(student)/test-history',
    testPreStart: '/(student)/test-pre-start',
    testQuestion: '/(student)/test-question',
    testResult: '/(student)/test-result',
    testReview: '/(student)/test-review',
    videoPlayer: '/(student)/video-player',
    wellnessArticle: '/(student)/wellness-article',
    wellnessCategory: '/(student)/wellness-category',
  },
  teacher: {
    brainHackDetail: '/(teacher)/brain-hack-detail',
    completeness: '/(teacher)/completeness',
    content: '/(teacher)/(tabs)/content',
    contentPreview: '/(teacher)/content-preview',
    corrections: '/(teacher)/corrections',
    courseStructureManager: '/(teacher)/course-structure-manager',
    createBrainHack: '/(teacher)/create-brain-hack',
    createContent: '/(teacher)/create-content',
    createTest: '/(teacher)/create-test',
    csvImportReport: '/(teacher)/csv-import-report',
    csvUpload: '/(teacher)/csv-upload',
    flashcardDeck: '/(teacher)/flashcard-deck',
    flashcardDecks: '/(teacher)/flashcard-decks',
    giveFeedback: '/(teacher)/give-feedback',
    home: '/(teacher)/(tabs)/home',
    manageDevices: '/(teacher)/manage-devices',
    previewRun: '/(teacher)/preview-run',
    profile: '/(teacher)/(tabs)/profile',
    questionBank: '/(teacher)/question-bank',
    questionBuilder: '/(teacher)/question-builder',
    questionEditor: '/(teacher)/question-editor',
    quickTag: '/(teacher)/quick-tag',
    rejectedContentDetail: '/(teacher)/rejected-content-detail',
    reports: '/(teacher)/reports',
    upload: '/(teacher)/(tabs)/upload',
  },
  admin: {
    analyticsOverview: '/(admin)/analytics-overview',
    contentPreviewDetail: '/(admin)/content-preview-detail',
    contentQueue: '/(admin)/content-queue',
    correctionsQueue: '/(admin)/corrections-queue',
    courseStructure: '/(admin)/course-structure',
    customTestAdmin: '/(admin)/custom-test-admin',
    giveFeedback: '/(admin)/give-feedback',
    home: '/(admin)/(tabs)/home',
    kycQueue: '/(admin)/kyc-queue',
    kycReviewDetail: '/(admin)/kyc-review-detail',
    manageDevices: '/(admin)/manage-devices',
    manageSubjects: '/(admin)/manage-subjects',
    moderationTests: '/(admin)/moderation-tests',
    moderationVideosDocs: '/(admin)/moderation-videos-docs',
    paymentDetail: '/(admin)/payment-detail',
    payments: '/(admin)/(tabs)/payments',
    platformSettings: '/(admin)/platform-settings',
    profile: '/(admin)/(tabs)/profile',
    reportsQueue: '/(admin)/reports-queue',
    review: '/(admin)/(tabs)/review',
    subscriptionPlanEdit: '/(admin)/subscription-plan-edit',
    subscriptionPlanList: '/(admin)/subscription-plan-list',
    taxonomy: '/(admin)/taxonomy',
    userDetail: '/(admin)/user-detail',
    users: '/(admin)/(tabs)/users',
    wellness: '/(admin)/wellness',
  },
} as const;

const LEGACY_TAB_ROUTE = /^\/\((student|admin)\)\/\((home|practice|learn|support|profile|users|review|payments)\)(?:\/([\w-]+))?$/;

/**
 * Routes saved server-side before the tab bar was hoisted (old notifications, admin-curated
 * update links) still carry the per-tab group, e.g. `/(student)/(practice)/test-history`.
 * Map them onto the current tree so they keep opening.
 */
export function normalizeRoute(route: string): string {
  // Explore was folded into Home / Practice / Learn.
  if (route === '/(student)' + '/explore') return ROUTES.student.home;
  const m = LEGACY_TAB_ROUTE.exec(route);
  if (!m) return route;
  const [, role, tab, name] = m;
  if (!name || name === 'index') return `/(${role})/(tabs)/${tab}`;
  if (name === 'hierarchy') return `/(${role})/${tab}-hierarchy`;
  return `/(${role})/${name}`;
}
