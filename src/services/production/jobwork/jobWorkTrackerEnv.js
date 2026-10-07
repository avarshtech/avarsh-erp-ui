/**
 * Job Work Tracker data source. UI mock round 1: every call is served by the in-browser demo
 * (trackerMock*.js). When /api/v1/job-work lands, the facades below switch their delegate to the
 * API and this flag goes; the screens do not change.
 */
export const USE_MOCK_JOB_WORK_TRACKER = true;
