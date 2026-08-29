import {
  Injectable,
} from '@nestjs/common';

import type {
  FileInventory,
  RepositoryLanguageSummary,
  SupportedLanguage,
} from '@securecode-platform/scanner-core';

@Injectable()
export class RepositoryLanguageSummaryService {
  summarize(
    inventory:
      FileInventory,
  ): RepositoryLanguageSummary {
    const counters =
      new Map<
        SupportedLanguage,
        {
          files: number;
          sizeBytes: number;
        }
      >();

    for (
      const file of
        inventory.files
    ) {
      if (
        file.isBinary ||
        file.language ===
          'UNKNOWN'
      ) {
        continue;
      }

      const current =
        counters.get(
          file.language,
        ) ?? {
          files:
            0,

          sizeBytes:
            0,
        };

      current.files +=
        1;

      current.sizeBytes +=
        file.sizeBytes;

      counters.set(
        file.language,
        current,
      );
    }

    const languages =
      [
        ...counters.entries(),
      ]
        .map(
          (
            [
              language,
              stats,
            ],
          ) => ({
            language,

            files:
              stats.files,

            sizeBytes:
              stats.sizeBytes,
          }),
        )
        .sort(
          (
            first,
            second,
          ) =>
            second.sizeBytes -
            first.sizeBytes,
        );

    return {
      languages,

      primaryLanguage:
        languages[0]
          ?.language ??
        null,

      totalSourceFiles:
        languages.reduce(
          (
            total,
            item,
          ) =>
            total +
            item.files,
          0,
        ),
    };
  }
}
