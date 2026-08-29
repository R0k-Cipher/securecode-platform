import { Controller, Post } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';

import {
  JOB_NAMES,
  QUEUE_NAMES,
  type RepositorySyncJobData,
} from '@securecode-platform/queue-contracts';

@ApiTags('Tests techniques')
@Controller('internal/queue-test')
export class QueueTestController {
  constructor(
    @InjectQueue(QUEUE_NAMES.REPOSITORY_SYNC)
    private readonly repositorySyncQueue: Queue<
      RepositorySyncJobData
    >,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Ajouter un job BullMQ temporaire',
  })
  async createTestJob() {
    try {
      const correlationId = randomUUID();

      const jobData: RepositorySyncJobData = {
        organizationId: randomUUID(),
        projectId: randomUUID(),
        repositoryId: randomUUID(),
        repositorySyncId: randomUUID(),
        gitConnectionId: randomUUID(),
        provider: 'GITHUB',
        repositoryExternalId: 'test-repository-id',
        repositoryFullName: 'securecode/test-repository',
        branch: 'main',
        commitSha: '0123456789abcdef',
        trigger: 'MANUAL',
        eventType: null,
        eventId: randomUUID(),
        triggeredById: null,
        requestedAt: new Date().toISOString(),
        correlationId,
      };

      const job = await this.repositorySyncQueue.add(
        JOB_NAMES.SYNC_REPOSITORY,
        jobData,
        {
          jobId: `repository-sync:${jobData.repositorySyncId}`,
        },
      );

      return {
        queued: true,
        jobId: job.id,
        queue: QUEUE_NAMES.REPOSITORY_SYNC,
        correlationId,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}
