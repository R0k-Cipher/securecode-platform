export class ExternalProviderUnavailableError
  extends Error
{
  constructor(
    public readonly provider:
      string,

    message:
      string,
  ) {
    super(message);

    this.name =
      ExternalProviderUnavailableError.name;
  }
}
