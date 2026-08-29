import {
  Injectable,
} from '@nestjs/common';

interface CircuitState {
  failures: number;

  openedAt:
    number | null;
}

@Injectable()
export class ExternalServiceCircuitBreakerService {
  private readonly states =
    new Map<
      string,
      CircuitState
    >();

  private readonly failureThreshold =
    5;

  private readonly resetTimeoutMs =
    60_000;

  canExecute(
    service:
      string,
  ): boolean {
    const state =
      this.states.get(
        service,
      );

    if (!state) {
      return true;
    }

    if (
      state.openedAt ===
      null
    ) {
      return true;
    }

    if (
      Date.now() -
        state.openedAt >=
      this.resetTimeoutMs
    ) {
      /*
       * HALF-OPEN simplifié.
       * Le prochain appel servira de test.
       */
      state.openedAt =
        null;

      state.failures =
        0;

      return true;
    }

    return false;
  }

  recordSuccess(
    service:
      string,
  ): void {
    this.states.set(
      service,
      {
        failures:
          0,

        openedAt:
          null,
      },
    );
  }

  recordFailure(
    service:
      string,
  ): void {
    const state =
      this.states.get(
        service,
      ) ?? {
        failures:
          0,

        openedAt:
          null,
      };

    state.failures +=
      1;

    if (
      state.failures >=
      this.failureThreshold
    ) {
      state.openedAt =
        Date.now();
    }

    this.states.set(
      service,
      state,
    );
  }
}
