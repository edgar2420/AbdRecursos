export abstract class Entity {
  protected constructor(public readonly id: string) {}

  equals(other?: Entity | null): boolean {
    if (!other) return false;
    return this.id === other.id;
  }
}
