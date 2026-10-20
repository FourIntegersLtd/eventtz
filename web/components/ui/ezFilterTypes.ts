/** One row in {@link EzFilterOptionsModal}. */
export type EzFilterOption<T extends string = string> = {
  id: T;
  title: string;
  subtitle?: string;
};
