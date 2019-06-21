
const store = new Map<any, any>();

/**
 * a simple DI tool
 */
const Registry = {
  naming: <T extends new () => any>(constructor: T) => {
    store.set(constructor, new constructor())
  },
  lookup: <T extends new () => any>(constructor: T) => {
    return store.get(constructor) as InstanceType<T>
  },
  inject: <T>(target: T, propertyKey: string | symbol) => {
    const key = Reflect.getMetadata("design:type", target, propertyKey);
    (target as any)[propertyKey] = store.get(key)
  }
}


export default Registry