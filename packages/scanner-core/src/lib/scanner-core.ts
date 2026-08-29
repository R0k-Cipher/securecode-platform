import type {
  ChangeSet,
} from './contracts/change-set';

import type {
  ScanPlan,
} from './contracts/scan-plan';

import type {
  ScanPlannerOptions,
} from './planning/scan-planner';

import {
  ScanPlanner,
} from './planning/scan-planner';

export class ScannerCore {
  private readonly planner:
    ScanPlanner;

  constructor() {
    this.planner =
      new ScanPlanner();
  }

  planScan(
    changeSet: ChangeSet,
    options?: ScanPlannerOptions,
  ): ScanPlan {
    return this.planner.createPlan(
      changeSet,
      options,
    );
  }
}
