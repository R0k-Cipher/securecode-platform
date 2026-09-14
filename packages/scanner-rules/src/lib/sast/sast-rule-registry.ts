export interface GenericSastRule {
  id: string;

  language:
    string;

  category:
    string;

  severity:
    'INFO' |
    'LOW' |
    'MEDIUM' |
    'HIGH' |
    'CRITICAL';

  cweId?:
    string;

  owaspCategory?:
    string;

  enabled:
    boolean;
}

export class SastRuleRegistry {
  private readonly rules =
    new Map<
      string,
      GenericSastRule
    >();

  register(
    rule:
      GenericSastRule,
  ): void {
    if (
      this.rules.has(
        rule.id,
      )
    ) {
      throw new Error(
        `Règle SAST dupliquée : ${rule.id}`,
      );
    }

    this.rules.set(
      rule.id,
      rule,
    );
  }

  isEnabled(
    ruleId:
      string,
  ): boolean {
    return (
      this.rules.get(
        ruleId,
      )
        ?.enabled ??
      false
    );
  }

  list():
    GenericSastRule[] {
    return [
      ...this.rules.values(),
    ];
  }
}
