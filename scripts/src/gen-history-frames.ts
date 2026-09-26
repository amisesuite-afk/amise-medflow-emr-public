/**
 * pnpm --filter @workspace/scripts run gen:history-frames                  # Swift twin (HistoryFrameData.swift)
 * pnpm --filter @workspace/scripts run gen:history-frames -- --record-only # record-only.ts from the mapping audit
 *
 * After --record-only, run it again without the flag: the Swift twin carries the iOS marks.
 */

import { writeFileSync } from 'node:fs';
import { RECORD_ONLY_PATH, SWIFT_DATA_PATH, generateRecordOnly, generateSwift } from './history-frames-generate';

if (process.argv.includes('--record-only')) {
  writeFileSync(RECORD_ONLY_PATH, await generateRecordOnly());
  console.log(`Wrote ${RECORD_ONLY_PATH}`);
} else {
  writeFileSync(SWIFT_DATA_PATH, generateSwift());
  console.log(`Wrote ${SWIFT_DATA_PATH}`);
}
