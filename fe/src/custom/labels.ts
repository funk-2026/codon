/** User-facing names for blueprint options — shared by the builder and the admin preset editor. */
export const STRATEGY_LABEL: Record<string, string> = {
  random: 'Random', unseen_first: 'New questions first', weak_first: 'My weak areas', spaced: 'Due for revision',
};
export const ORDER_LABEL: Record<string, string> = {
  random: 'Random', syllabus: 'Syllabus order', easy_first: 'Easy → hard', hard_first: 'Hard → easy', unattempted_first: 'Unattempted first',
};
