export type QueryOperators<T> = {
  eq?: T;
  neq?: T;
  in?: T[];
  nin?: T[];
  gt?: T;
  gte?: T;
  lt?: T;
  lte?: T;
};

export type DataFilter = {
  [key: string]: QueryOperators<string | number | boolean>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const operatorMap: Record<keyof QueryOperators<any>, string> = {
  eq: '=',
  neq: '!=',
  in: 'IN',
  nin: 'NOT IN',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
};
