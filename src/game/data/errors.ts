export class DataValidationError extends Error {
  public readonly details: string[];

  public constructor(message: string, details: string[] = []) {
    super(message);
    this.name = "DataValidationError";
    this.details = details;
  }
}
