import { Share } from 'react-native';
import { shareBlueprint, type Blueprint } from '@/src/api/customTests';
import { summarizeBlueprint } from './blueprint';

/**
 * Creates a share code for a blueprint and opens the OS share sheet.
 *
 * Call it while any bottom sheet is still OPEN and close the sheet afterwards:
 * iOS silently refuses to present the share sheet while a Modal is mid-dismiss,
 * which made "Share this setup" look like it did nothing.
 *
 * Resolves `true` once the share sheet was shown; throws if the code couldn't be created.
 */
export async function shareSetup(bp: Blueprint, subjects?: Record<string, string>): Promise<boolean> {
  const r = await shareBlueprint(bp);
  await Share.share({
    message: `Try this custom test on Codon: ${summarizeBlueprint(bp, { subjects })}\nOpen: ${r.deep_link}\nCode: ${r.code}`,
  });
  return true;
}
