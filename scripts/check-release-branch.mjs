// Fails a release-branch build whose name does not match package.json.
//
// Release branches are named avarsh/release/v<MAJOR.MONTH.DAY>_R<yyyy-mm-dd>, where MONTH and DAY
// are the release date's, e.g. avarsh/release/v1.10.15_R2026-10-15. The branch is cut from a
// "Release <version>" commit on dev, so package.json must already carry the same version.
//
// Usage: node scripts/check-release-branch.mjs <branch name>
import { readFileSync } from 'node:fs';

const fail = (message) => {
  console.error(`Release branch check failed: ${message}`);
  process.exit(1);
};

const branch = process.argv[2] || '';
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const match = branch.match(/^avarsh\/release\/v(\d+)\.(\d+)\.(\d+)_R(\d{4})-(\d{2})-(\d{2})$/);
if (!match) fail(`"${branch}" is not avarsh/release/v<MAJOR.MONTH.DAY>_R<yyyy-mm-dd>`);

const [, major, month, day, year, releaseMonth, releaseDay] = match;
const branchVersion = `${Number(major)}.${Number(month)}.${Number(day)}`;
if (branchVersion !== version) {
  fail(`the branch says ${branchVersion} but package.json says ${version}; commit "npm version ${branchVersion} --no-git-tag-version" first`);
}
if (Number(month) !== Number(releaseMonth) || Number(day) !== Number(releaseDay)) {
  fail(`version ${branchVersion} does not carry the month and day of the release date ${year}-${releaseMonth}-${releaseDay}`);
}

console.log(`Release branch ${branch} matches package.json ${version}.`);
