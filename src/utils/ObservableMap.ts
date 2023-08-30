export class ObservableMap<K, V> extends Map<K, V> {
  private listeners: Set<(value: any) => void> = new Set();

  override set(key: K, value: V): any {
    super.set(key, value);

    this.listeners.forEach((listener) => listener(this));
  }

  override get(key: K) {
    return super.get(key);
  }

  addListener(listener: (value: any) => void) {
    this.listeners.add(listener);
  }

  removeListener(listener: (value: any) => void) {
    this.listeners.delete(listener);
  }
}
