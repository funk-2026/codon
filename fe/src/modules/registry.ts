/**
 * Module registry (CM-E1 / FE-0.3). One place that knows every assessment
 * "module" (Q Bank, Test Series, Practice, Custom, …): its labels, whether a
 * finished test can be retaken, whether teachers can author it, and which
 * feature flag gates it. Screens ask the registry instead of hard-coding
 * `'qbank' | 'test_series' | 'practice'` switches, so adding a module (Custom
 * today, Flashcards tomorrow) is a registry entry, not a hunt through screens.
 */
export type ModuleKey = 'qbank' | 'test_series' | 'practice' | 'custom';

export type ModuleDefinition = {
  key: string;
  label: string;
  /** Short label for pills/filters. */
  shortLabel: string;
  descriptor: string;
  /** Can a finished test of this module be retaken (same questions)? */
  canRetake: boolean;
  /** Can a teacher author a test of this module? (custom tests are generated only) */
  teacherCreatable: boolean;
  /** Feature flag that must be on for the module to appear (undefined = always). */
  flag?: string;
  /** Where the module's hub card leads. */
  hubRoute: { pathname: string; params?: Record<string, string> };
};

const DEFINITIONS: Record<ModuleKey, ModuleDefinition> = {
  qbank: {
    key: 'qbank', label: 'Q Bank', shortLabel: 'Q Bank',
    descriptor: 'Topic-wise questions to build your foundation, chapter by chapter.',
    canRetake: true, teacherCreatable: true,
    hubRoute: { pathname: '/(student)/(practice)/hierarchy', params: { kind: 'qbank' } },
  },
  test_series: {
    key: 'test_series', label: 'Test Series', shortLabel: 'Test Series',
    descriptor: 'Full-length, exam-pattern tests that simulate the real thing.',
    canRetake: false, teacherCreatable: true,
    hubRoute: { pathname: '/(student)/(practice)/hierarchy', params: { kind: 'test_series' } },
  },
  practice: {
    key: 'practice', label: 'Practice', shortLabel: 'Practice',
    descriptor: 'Short, low-pressure sets to warm up or review a single topic.',
    canRetake: true, teacherCreatable: true,
    hubRoute: { pathname: '/(student)/(practice)/hierarchy', params: { kind: 'practice' } },
  },
  custom: {
    key: 'custom', label: 'Custom Test', shortLabel: 'Custom',
    descriptor: 'Build your own test — pick topics, difficulty, count and mode.',
    canRetake: true, teacherCreatable: false, flag: 'custom_test.enabled',
    hubRoute: { pathname: '/(student)/(practice)/custom-builder' },
  },
};

/** Modules in hub order. */
export const MODULE_ORDER: ModuleKey[] = ['qbank', 'test_series', 'practice', 'custom'];

/**
 * Look a module up by the backend's `module_type`. Unknown keys (an old app
 * build meeting a newer backend) get a generic definition instead of being
 * silently mislabelled as "Practice".
 */
export function getModule(key: string | undefined | null): ModuleDefinition {
  if (key && key in DEFINITIONS) return DEFINITIONS[key as ModuleKey];
  return {
    key: key ?? 'unknown', label: 'Test', shortLabel: 'Test', descriptor: '',
    canRetake: false, teacherCreatable: false,
    hubRoute: { pathname: '/(student)/(practice)' },
  };
}

/** Modules a teacher may author (excludes generated-only ones). */
export function teacherModules(): ModuleDefinition[] {
  return MODULE_ORDER.map((k) => DEFINITIONS[k]).filter((m) => m.teacherCreatable);
}

/** Modules visible to a user given the current flags. */
export function visibleModules(flagOn: (flag: string) => boolean): ModuleDefinition[] {
  return MODULE_ORDER.map((k) => DEFINITIONS[k]).filter((m) => !m.flag || flagOn(m.flag));
}
